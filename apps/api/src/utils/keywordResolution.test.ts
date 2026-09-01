import { describe, it, expect } from "vitest";
import { resolveKeyword, dedupeKeywords } from "./keywordResolution.js";

const canonical = {
  id: "canonical-1",
  name: "Obsession & Desire",
  slug: "obsession-desire",
  status: "CANONICAL" as const,
  aliasOf: null,
};

describe("resolveKeyword", () => {
  it("returns a canonical keyword unchanged", () => {
    expect(resolveKeyword(canonical)).toEqual({
      id: "canonical-1",
      name: "Obsession & Desire",
      slug: "obsession-desire",
    });
  });

  it("returns a pending keyword unchanged, so the prep still records it", () => {
    const pending = { ...canonical, id: "pending-1", status: "PENDING" as const };
    expect(resolveKeyword(pending).id).toBe("pending-1");
  });

  it("redirects an alias to its target", () => {
    const alias = {
      id: "alias-1",
      name: "monomania",
      slug: "monomania",
      status: "ALIAS" as const,
      aliasOf: { id: "canonical-1", name: "Obsession & Desire", slug: "obsession-desire" },
    };
    expect(resolveKeyword(alias)).toEqual({
      id: "canonical-1",
      name: "Obsession & Desire",
      slug: "obsession-desire",
    });
  });

  it("falls back to the keyword itself when an alias has lost its target", () => {
    // aliasOfId is ON DELETE SET NULL, so this pairing is reachable in the data.
    const orphaned = { ...canonical, id: "alias-2", status: "ALIAS" as const, aliasOf: null };
    expect(resolveKeyword(orphaned).id).toBe("alias-2");
  });
});

describe("dedupeKeywords", () => {
  it("returns an empty array unchanged", () => {
    expect(dedupeKeywords([])).toEqual([]);
  });

  it("collapses two aliases that resolved onto the same canonical keyword", () => {
    const target = { id: "canonical-1", name: "Obsession & Desire", slug: "obsession-desire" };
    expect(dedupeKeywords([target, target])).toEqual([target]);
  });

  it("preserves distinct keywords and their order", () => {
    const a = { id: "a", name: "Found Family", slug: "found-family" };
    const b = { id: "b", name: "War & Ethics", slug: "war-ethics" };
    expect(dedupeKeywords([a, b, a])).toEqual([a, b]);
  });
});
