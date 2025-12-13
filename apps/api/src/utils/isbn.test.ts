import { describe, it, expect } from "vitest";
import { normalizeIsbn } from "./isbn.js";

describe("normalizeIsbn", () => {
  it("returns null for undefined", () => {
    expect(normalizeIsbn(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizeIsbn(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeIsbn("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeIsbn("   ")).toBeNull();
  });

  it("removes hyphens from ISBN-13", () => {
    expect(normalizeIsbn("978-3-16-148410-0")).toBe("9783161484100");
  });

  it("removes spaces from ISBN", () => {
    expect(normalizeIsbn("978 3 16 148410 0")).toBe("9783161484100");
  });

  it("handles ISBN-10 with X check digit", () => {
    expect(normalizeIsbn("0-306-40615-X")).toBe("030640615X");
  });

  it("converts lowercase x to uppercase X", () => {
    expect(normalizeIsbn("0-306-40615-x")).toBe("030640615X");
  });

  it("handles clean ISBN-10", () => {
    expect(normalizeIsbn("0306406152")).toBe("0306406152");
  });

  it("handles clean ISBN-13", () => {
    expect(normalizeIsbn("9780306406157")).toBe("9780306406157");
  });

  it("removes all non-ISBN characters", () => {
    expect(normalizeIsbn("ISBN: 978-0-306-40615-7!")).toBe("9780306406157");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeIsbn("  978-0-306-40615-7  ")).toBe("9780306406157");
  });

  it("returns null if only non-ISBN characters remain", () => {
    expect(normalizeIsbn("ISBN: ")).toBeNull();
  });
});
