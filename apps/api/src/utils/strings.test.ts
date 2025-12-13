import { describe, it, expect } from "vitest";
import { tokenizeSearch, slugify, truncateSynopsis, extractStringArray } from "./strings.js";

describe("tokenizeSearch", () => {
  it("returns empty array for empty string", () => {
    expect(tokenizeSearch("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(tokenizeSearch("   ")).toEqual([]);
  });

  it("converts to lowercase", () => {
    expect(tokenizeSearch("Hello World")).toEqual(["hello", "world"]);
  });

  it("removes special characters", () => {
    expect(tokenizeSearch("hello! world?")).toEqual(["hello", "world"]);
  });

  it("handles multiple spaces", () => {
    expect(tokenizeSearch("hello   world")).toEqual(["hello", "world"]);
  });

  it("handles mixed alphanumeric and special chars", () => {
    expect(tokenizeSearch("book-prep_test 123")).toEqual(["book", "prep", "test", "123"]);
  });

  it("trims leading and trailing whitespace", () => {
    expect(tokenizeSearch("  hello world  ")).toEqual(["hello", "world"]);
  });

  it("handles string with only special characters", () => {
    expect(tokenizeSearch("!@#$%^&*()")).toEqual([]);
  });

  it("preserves numbers", () => {
    expect(tokenizeSearch("Year 2024")).toEqual(["year", "2024"]);
  });
});

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with dashes", () => {
    expect(slugify("my book title")).toBe("my-book-title");
  });

  it("removes special characters", () => {
    expect(slugify("Hello! World?")).toBe("hello-world");
  });

  it("handles multiple dashes", () => {
    expect(slugify("hello---world")).toBe("hello-world");
  });

  it("removes leading dashes", () => {
    expect(slugify("---hello")).toBe("hello");
  });

  it("removes trailing dashes", () => {
    expect(slugify("hello---")).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  it("returns 'item' for empty string", () => {
    expect(slugify("")).toBe("item");
  });

  it("returns 'item' for special-char-only string", () => {
    expect(slugify("!@#$%^&*()")).toBe("item");
  });

  it("handles numbers", () => {
    expect(slugify("Book 123")).toBe("book-123");
  });

  it("handles apostrophes and quotes", () => {
    expect(slugify("The Reader's Guide")).toBe("the-reader-s-guide");
  });
});

describe("truncateSynopsis", () => {
  it("returns null for undefined", () => {
    expect(truncateSynopsis(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(truncateSynopsis(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(truncateSynopsis("")).toBeNull();
  });

  it("returns string unchanged if under limit", () => {
    const short = "A short synopsis.";
    expect(truncateSynopsis(short)).toBe(short);
  });

  it("truncates string at default limit (10000)", () => {
    const long = "a".repeat(10005);
    const result = truncateSynopsis(long);
    expect(result).toHaveLength(10000);
    expect(result).toBe("a".repeat(10000));
  });

  it("respects custom max length", () => {
    const text = "This is a test string.";
    const result = truncateSynopsis(text, 10);
    expect(result).toBe("This is a ");
    expect(result).toHaveLength(10);
  });

  it("returns full string if exactly at limit", () => {
    const exact = "a".repeat(10000);
    expect(truncateSynopsis(exact)).toBe(exact);
    expect(truncateSynopsis(exact)).toHaveLength(10000);
  });
});

describe("extractStringArray", () => {
  it("returns empty array for null", () => {
    expect(extractStringArray(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(extractStringArray(undefined)).toEqual([]);
  });

  it("returns empty array for non-array values", () => {
    expect(extractStringArray("string")).toEqual([]);
    expect(extractStringArray(123)).toEqual([]);
    expect(extractStringArray({ key: "value" })).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(extractStringArray([])).toEqual([]);
  });

  it("extracts string values", () => {
    expect(extractStringArray(["one", "two", "three"])).toEqual(["one", "two", "three"]);
  });

  it("trims whitespace from strings", () => {
    expect(extractStringArray(["  one  ", " two ", "three"])).toEqual(["one", "two", "three"]);
  });

  it("filters out empty strings", () => {
    expect(extractStringArray(["one", "", "two", "   ", "three"])).toEqual(["one", "two", "three"]);
  });

  it("filters out non-string values", () => {
    expect(extractStringArray(["one", 123, "two", null, "three"])).toEqual(["one", "two", "three"]);
  });

  it("handles mixed array with all edge cases", () => {
    const input = ["valid", "", "  spaced  ", null, 42, undefined, "end"];
    expect(extractStringArray(input)).toEqual(["valid", "spaced", "end"]);
  });
});
