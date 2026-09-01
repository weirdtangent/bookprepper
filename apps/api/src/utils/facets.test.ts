import { describe, it, expect } from "vitest";
import { rankFacets } from "./facets.js";

const facet = (name: string, bookCount: number) => ({ name, bookCount });

describe("rankFacets", () => {
  it("returns an empty array unchanged", () => {
    expect(rankFacets([])).toEqual([]);
  });

  it("withholds facets that reach no books", () => {
    expect(rankFacets([facet("Gothic", 0), facet("Fantasy", 29)])).toEqual([facet("Fantasy", 29)]);
  });

  it("orders by book count descending", () => {
    expect(rankFacets([facet("Horror", 2), facet("Fantasy", 29), facet("Dystopian", 9)])).toEqual([
      facet("Fantasy", 29),
      facet("Dystopian", 9),
      facet("Horror", 2),
    ]);
  });

  it("breaks ties alphabetically", () => {
    expect(
      rankFacets([facet("Romance", 3), facet("Urban Fantasy", 3), facet("Horror", 3)])
    ).toEqual([facet("Horror", 3), facet("Romance", 3), facet("Urban Fantasy", 3)]);
  });

  it("preserves fields beyond name and count", () => {
    const withExtras = { name: "Fantasy", bookCount: 29, slug: "fantasy", id: "g1" };
    expect(rankFacets([withExtras])).toEqual([withExtras]);
  });
});
