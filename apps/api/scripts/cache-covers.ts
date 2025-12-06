import { config as loadEnv } from "dotenv";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
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

loadEnv({ path: path.resolve(repoRoot, ".env") });
loadEnv();

type BookRecord = {
  id: string;
  title: string;
  isbn: string | null;
};

type CoverManifest = {
  generatedAt: string;
  files: Record<string, string>;
};

let prismaClient: PrismaClient | null = null;

async function main() {
  await ensureDir(publicCoverDir);
  await ensureDir(path.dirname(apiManifestPath));

  const manifestFiles = await hydrateCovers();
  await writeManifest(manifestFiles);
}

async function hydrateCovers(): Promise<Record<string, string>> {
  if (!process.env.DATABASE_URL) {
    console.warn("\"DATABASE_URL is not set; using existing cached covers\"");
    return scanExistingFiles();
  }

  const dbModule = await import("db");
  prismaClient = dbModule.prisma;

  const books = await prismaClient.book.findMany({
    where: { isbn: { not: null } },
    select: { id: true, title: true, isbn: true },
    orderBy: { title: "asc" }
  });

  if (books.length === 0) {
    console.warn("\"No ISBN data found; skipping cover download\"");
    return scanExistingFiles();
  }

  let downloaded = 0;
  for (const book of books) {
    const normalized = normalizeIsbn(book.isbn);
    if (!normalized) {
      continue;
    }
    const destination = path.join(publicCoverDir, `${normalized}.jpg`);
    if (await fileExists(destination)) {
      continue;
    }
    const success = await downloadCover(normalized, destination);
    if (success) {
      downloaded += 1;
      await sleep(200);
    }
  }

  console.log(`"Ensured ${books.length} ISBN entries with ${downloaded} new downloads"`);

  return scanFilesForBooks(books);
}

async function downloadCover(isbn: string, destination: string) {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`"Failed to fetch cover for ISBN ${isbn} (status ${response.status})"`);
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destination, buffer);
    return true;
  } catch (error) {
    console.warn(`"Error downloading ISBN ${isbn}: ${(error as Error).message}"`);
    return false;
  }
}

async function writeManifest(files: Record<string, string>) {
  const manifest: CoverManifest = {
    generatedAt: new Date().toISOString(),
    files
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
  .catch((error) => {
    console.error(`"Cover cache run failed: ${(error as Error).message}"`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });
