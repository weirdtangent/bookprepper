import { normalizeIsbn } from "./isbn.js";

const OPEN_LIBRARY_BASE = "https://covers.openlibrary.org/b/isbn";

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
  return book.coverImageUrl ?? buildOpenLibraryCoverUrl(book.isbn, size);
}
