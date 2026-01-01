import { createHash } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { normalizeIsbn } from "../src/utils/isbn.js";

type PrismaClient = import("@prisma/client").PrismaClient;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const publicCoverDir = path.resolve(repoRoot, "apps/web/public/assets/covers");
const publicManifestPath = path.resolve(publicCoverDir, "manifest.generated.json");
const apiCoverCacheDir = path.resolve(repoRoot, "apps/api/.cover-cache");
const apiManifestPath = path.resolve(apiCoverCacheDir, "cover-manifest.generated.json");
const failedIsbnsPath = path.resolve(apiCoverCacheDir, "failed-isbns.json");

// Only retry failed ISBNs after 24 hours
const FAILED_RETRY_MS = 24 * 60 * 60 * 1000;

loadEnv({ path: path.resolve(repoRoot, ".env") });
loadEnv();

type BookRecord = {
  id: string;
  title: string;
  isbn: string | null;
  coverImageUrl: string | null;
};

type CoverManifest = {
  generatedAt: string;
  files: Record<string, string>;
  urlHashes?: Record<string, string>; // isbn -> hash of coverImageUrl
};

type FailedIsbnsCache = {
  // ISBN -> timestamp of when it failed
  [isbn: string]: number;
};

let prismaClient: PrismaClient | null = null;
let failedIsbns: FailedIsbnsCache = {};
let previousManifest: CoverManifest | null = null;

function hashUrl(url: string | null): string {
  if (!url) return "default";
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

async function loadFailedIsbns(): Promise<FailedIsbnsCache> {
  try {
    const content = await readFile(failedIsbnsPath, "utf-8");
    return JSON.parse(content) as FailedIsbnsCache;
  } catch {
    return {};
  }
}

async function saveFailedIsbns(): Promise<void> {
  const serialized = `${JSON.stringify(failedIsbns, null, 2)}\n`;
  await writeFile(failedIsbnsPath, serialized);
}

function shouldRetryIsbn(isbn: string): boolean {
  const failedAt = failedIsbns[isbn];
  if (!failedAt) {
    return true;
  }
  const now = Date.now();
  return now - failedAt > FAILED_RETRY_MS;
}

function markIsbnFailed(isbn: string): void {
  failedIsbns[isbn] = Date.now();
}

async function loadPreviousManifest(): Promise<CoverManifest | null> {
  try {
    const content = await readFile(apiManifestPath, "utf-8");
    return JSON.parse(content) as CoverManifest;
  } catch {
    return null;
  }
}

async function main() {
  await ensureDir(publicCoverDir);
  await ensureDir(path.dirname(apiManifestPath));

  failedIsbns = await loadFailedIsbns();
  previousManifest = await loadPreviousManifest();

  const existingFiles = await scanExistingFiles();
  const manifestFiles = await hydrateCovers(existingFiles);
  await writeManifest(manifestFiles);
  await saveFailedIsbns();
}

async function hydrateCovers(
  existingFiles: Record<string, string>
): Promise<Record<string, string>> {
  const knownIsbns = new Set(Object.keys(existingFiles));

  if (!process.env.DATABASE_URL) {
    console.warn('"DATABASE_URL is not set; using existing cached covers"');
    return existingFiles;
  }

  const dbModule = await import("db");
  prismaClient = dbModule.prisma;

  const books = await prismaClient.book.findMany({
    where: { isbn: { not: null } },
    select: { id: true, title: true, isbn: true, coverImageUrl: true },
    orderBy: { title: "asc" },
  });

  if (books.length === 0) {
    console.warn('"No ISBN data found; skipping cover download"');
    return existingFiles;
  }

  let downloaded = 0;
  let updated = 0;
  let skippedFailed = 0;

  for (const book of books) {
    const normalized = normalizeIsbn(book.isbn);
    if (!normalized) {
      continue;
    }

    const currentUrlHash = hashUrl(book.coverImageUrl);
    const previousUrlHash = previousManifest?.urlHashes?.[normalized];
    const urlChanged = previousUrlHash && previousUrlHash !== currentUrlHash;

    // Skip if file exists and URL hasn't changed
    if (knownIsbns.has(normalized) && !urlChanged) {
      continue;
    }

    if (!shouldRetryIsbn(normalized) && !urlChanged) {
      skippedFailed += 1;
      continue;
    }

    const destination = path.join(publicCoverDir, `${normalized}.jpg`);
    const coverUrl = book.coverImageUrl || `https://covers.openlibrary.org/b/isbn/${normalized}-L.jpg?default=false`;
    const result = await downloadCover(normalized, coverUrl, destination, urlChanged);

    if (result === "success") {
      if (urlChanged) {
        updated += 1;
      } else {
        downloaded += 1;
      }
      knownIsbns.add(normalized);
      existingFiles[normalized] = `${normalized}.jpg`;
      // Remove from failed cache if it was there
      delete failedIsbns[normalized];
      await sleep(200);
    } else if (result === "not-found") {
      markIsbnFailed(normalized);
      await sleep(100);
    }
  }

  if (skippedFailed > 0) {
    console.log(`"Skipped ${skippedFailed} ISBNs that recently returned 404"`);
  }
  if (updated > 0) {
    console.log(`"Updated ${updated} covers with new URLs"`);
  }
  console.log(`"Ensured ${books.length} ISBN entries with ${downloaded} new downloads"`);

  return scanFilesForBooks(books);
}

type DownloadResult = "success" | "not-found" | "error" | "exists";

async function downloadCover(
  isbn: string,
  url: string,
  destination: string,
  replacing: boolean = false
): Promise<DownloadResult> {
  try {
    const response = await fetch(url);
    if (response.status === 404) {
      // Don't log 404s since we're caching them
      return "not-found";
    }
    if (!response.ok) {
      console.warn(`"Failed to fetch cover for ISBN ${isbn} (status ${response.status})"`);
      return "error";
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    try {
      // If replacing, overwrite the existing file, otherwise use wx flag to prevent overwrites
      const writeFlag = replacing ? "w" : "wx";
      await writeFile(destination, buffer, { flag: writeFlag });
      if (replacing) {
        console.log(`"Replaced cover for ISBN ${isbn} with new URL"`);
      }
      return "success";
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code === "EEXIST") {
        return "exists";
      }
      throw writeError;
    }
  } catch (error) {
    console.warn(`"Error downloading ISBN ${isbn}: ${(error as Error).message}"`);
    return "error";
  }
}

async function writeManifest(files: Record<string, string>) {
  // Build URL hash map from current books
  const urlHashes: Record<string, string> = {};
  if (prismaClient) {
    const books = await prismaClient.book.findMany({
      where: { isbn: { not: null } },
      select: { isbn: true, coverImageUrl: true },
    });
    for (const book of books) {
      const normalized = normalizeIsbn(book.isbn);
      if (normalized) {
        urlHashes[normalized] = hashUrl(book.coverImageUrl);
      }
    }
  }

  const manifest: CoverManifest = {
    generatedAt: new Date().toISOString(),
    files,
    urlHashes,
  };
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(publicManifestPath, serialized);
  await writeFile(apiManifestPath, serialized);
  console.log(`"Updated cover manifest with ${Object.keys(files).length} entries"`);
}

async function scanExistingFiles() {
  const entries = await readdir(publicCoverDir, { withFileTypes: true });
  const files: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".jpg")) {
      continue;
    }
    const normalized = entry.name.replace(/\.jpg$/i, "");
    files[normalized] = entry.name;
  }
  return files;
}

async function scanFilesForBooks(books: BookRecord[]) {
  const files: Record<string, string> = {};
  for (const book of books) {
    const normalized = normalizeIsbn(book.isbn);
    if (!normalized) {
      continue;
    }
    const fileName = `${normalized}.jpg`;
    if (await fileExists(path.join(publicCoverDir, fileName))) {
      files[normalized] = fileName;
    }
  }
  return files;
}

async function ensureDir(target: string) {
  await mkdir(target, { recursive: true });
}

async function fileExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

main()
  .then(async () => {
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`"Cover cache run failed: ${(error as Error).message}"`);
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
    process.exit(1);
  });
