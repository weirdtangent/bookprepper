import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeIsbn } from "./isbn.js";

const OPEN_LIBRARY_BASE = "https://covers.openlibrary.org/b/isbn";
const COVER_ASSET_PREFIX = (process.env.COVER_ASSET_PREFIX ?? "/assets/covers").replace(/\/$/, "");
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST_PATH = path.resolve(
  moduleDir,
  "../../.cover-cache/cover-manifest.generated.json"
);
const manifestPath = process.env.COVER_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;

type CoverManifest = {
  generatedAt?: string;
  files: Record<string, string>;
};

const cachedCoverFiles = loadCoverManifest(manifestPath);

export function buildOpenLibraryCoverUrl(
  isbn?: string | null,
  size: "S" | "M" | "L" = "M"
): string | null {
  const normalized = normalizeIsbn(isbn);
  if (!normalized) {
    return null;
  }
  return `${OPEN_LIBRARY_BASE}/${normalized}-${size}.jpg?default=false`;
}

export function resolveCoverImageUrl<
  T extends { coverImageUrl: string | null; isbn?: string | null }
>(book: T, size: "S" | "M" | "L" = "M") {
  if (book.coverImageUrl) {
    return book.coverImageUrl;
  }

  const normalized = normalizeIsbn(book.isbn);
  if (normalized) {
    const fileName = cachedCoverFiles.get(normalized);
    if (fileName) {
      return `${COVER_ASSET_PREFIX}/${fileName}`;
    }
  }

  return buildOpenLibraryCoverUrl(book.isbn, size);
}

function loadCoverManifest(targetPath: string) {
  if (!existsSync(targetPath)) {
    return new Map<string, string>();
  }

  try {
    const contents = readFileSync(targetPath, "utf8");
    const parsed = JSON.parse(contents) as CoverManifest;
    return new Map<string, string>(Object.entries(parsed.files ?? {}));
  } catch (error) {
    console.warn(
      `"Failed to read cached cover manifest from ${targetPath}: ${(error as Error).message}"`
    );
    return new Map<string, string>();
  }
}
