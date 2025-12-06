import coverManifest from "../data/cover-manifest.json" with { type: "json" };
import { normalizeIsbn } from "./isbn.js";

const OPEN_LIBRARY_BASE = "https://covers.openlibrary.org/b/isbn";
const COVER_ASSET_PREFIX = (process.env.COVER_ASSET_PREFIX ?? "/assets/covers").replace(/\/$/, "");

type CoverManifest = {
  generatedAt?: string;
  files: Record<string, string>;
};

const cachedCoverFiles = new Map<string, string>(
  Object.entries((coverManifest as CoverManifest).files ?? {})
);

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
