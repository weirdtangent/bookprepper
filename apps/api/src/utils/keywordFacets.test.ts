import { describe, it, expect } from "vitest";
import { toKeywordFacets } from "./keywordFacets.js";

const keyword = (name: string, bookIds: string[]) => ({
  id: `id-${name}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  description: null,
  preps: bookIds.map((bookId) => ({ prep: { bookId } })),
});

describe("toKeywordFacets", () => {
  it("returns an empty array for no keywords", () => {
    expect(toKeywordFacets([])).toEqual([]);
  });

  it("counts distinct books, not preps", () => {
    const [facet] = toKeywordFacets([keyword("Found Family", ["book-1", "book-1", "book-2"])]);
    expect(facet.bookCount).toBe(2);
  });

  it("drops keywords that reach no books", () => {
    const facets = toKeywordFacets([keyword("Queer Joy", []), keyword("War & Ethics", ["book-1"])]);
    expect(facets.map((facet) => facet.name)).toEqual(["War & Ethics"]);
  });

  it("orders by book count descending", () => {
    const facets = toKeywordFacets([
      keyword("Surveillance", ["book-1"]),
      keyword("Found Family", ["book-1", "book-2", "book-3"]),
      keyword("Magic Systems", ["book-1", "book-2"]),
    ]);
    expect(facets.map((facet) => facet.name)).toEqual([
      "Found Family",
      "Magic Systems",
      "Surveillance",
    ]);
  });

  it("breaks book-count ties alphabetically", () => {
    const facets = toKeywordFacets([
      keyword("Surveillance", ["book-1"]),
      keyword("Class & Labor", ["book-2"]),
      keyword("Magic Systems", ["book-3"]),
    ]);
    expect(facets.map((facet) => facet.name)).toEqual([
      "Class & Labor",
      "Magic Systems",
      "Surveillance",
    ]);
  });

  it("preserves the keyword's identifying fields", () => {
    const [facet] = toKeywordFacets([
      { ...keyword("Hopepunk Threads", ["book-1"]), description: "Small acts of repair." },
    ]);
    expect(facet).toEqual({
      id: "id-Hopepunk Threads",
      name: "Hopepunk Threads",
      slug: "hopepunk-threads",
      description: "Small acts of repair.",
      bookCount: 1,
    });
  });
});
