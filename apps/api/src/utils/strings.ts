/**
 * Shared string utility functions for the API.
 * These are extracted from route files to avoid duplication.
 */

/**
 * Tokenizes a search string into normalized lowercase words.
 * Removes all non-alphanumeric characters and splits by whitespace.
 *
 * @param value - The raw search string
 * @returns Array of normalized tokens
 */
export function tokenizeSearch(value: string): string[] {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return [];
  }

  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * Converts a string into a URL-safe slug.
 * Handles special characters, multiple dashes, and edge cases.
 *
 * @param value - The string to slugify
 * @returns A URL-safe slug, or "item" if the result would be empty
 */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");

  return slug || "item";
}

/**
 * Truncates a synopsis to the maximum allowed length.
 *
 * @param value - The synopsis text to truncate
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Truncated string or null if input is empty
 */
export function truncateSynopsis(value?: string | null, maxLength = 10000): string | null {
  if (!value) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Safely extracts a string array from an unknown JSON value.
 * Used for parsing JSON columns that store string arrays.
 *
 * @param value - The unknown value to extract from
 * @returns Array of trimmed, non-empty strings
 */
export function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}
