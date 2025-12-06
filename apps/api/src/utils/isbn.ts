export function normalizeIsbn(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/[^0-9Xx]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}
