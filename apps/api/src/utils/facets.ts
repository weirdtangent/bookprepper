/**
 * The shared rule for any filter facet the library offers.
 *
 * Ordering is by reach so the most useful filters come first, and anything
 * reaching zero books is withheld: such a chip can only ever filter to an empty
 * page, which is a dead end rather than a filter. Withholding is not deletion —
 * a designed-but-unused genre or keyword reappears on its own once content uses
 * it.
 */
export function rankFacets<T extends { name: string; bookCount: number }>(facets: T[]): T[] {
  return facets
    .filter((facet) => facet.bookCount > 0)
    .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name));
}
