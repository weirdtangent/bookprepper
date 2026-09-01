type KeywordFacet = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bookCount: number;
};

type KeywordWithPreps = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  preps: { prep: { bookId: string } }[];
};

/**
 * Shapes prep keywords into library filter facets.
 *
 * A keyword's usefulness as a filter is how many distinct books it reaches, not
 * how many preps carry it — several preps on one book make a keyword look popular
 * while it still narrows the library to a single title.
 *
 * Which keywords belong in the filter is decided by curation (status CANONICAL);
 * this drops the zero-book ones on top of that, because a curated keyword whose
 * last prep was deleted would otherwise still be offered as a dead-end chip.
 */
export function toKeywordFacets(keywords: KeywordWithPreps[]): KeywordFacet[] {
  return keywords
    .map((keyword) => ({
      id: keyword.id,
      name: keyword.name,
      slug: keyword.slug,
      description: keyword.description,
      bookCount: new Set(keyword.preps.map((entry) => entry.prep.bookId)).size,
    }))
    .filter((keyword) => keyword.bookCount > 0)
    .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name));
}
