type ResolvableKeyword = {
  id: string;
  name: string;
  slug: string;
  status: "CANONICAL" | "PENDING" | "ALIAS";
  aliasOf: { id: string; name: string; slug: string } | null;
};

export type ResolvedKeyword = { id: string; name: string; slug: string };

/**
 * Follows a keyword's alias pointer to the keyword a prep should actually link to.
 *
 * Resolution is a single hop by design; aliasKeywordInto re-points existing
 * aliases when it merges, so chains are prevented at write time rather than
 * walked at read time.
 */
export function resolveKeyword(keyword: ResolvableKeyword): ResolvedKeyword {
  if (keyword.status === "ALIAS" && keyword.aliasOf) {
    return keyword.aliasOf;
  }

  return { id: keyword.id, name: keyword.name, slug: keyword.slug };
}

/**
 * Collapses resolved keywords to one entry per id.
 *
 * Two different spellings can alias onto the same canonical keyword, and
 * attaching it to a prep twice would violate PrepKeywordOnPrep's composite
 * primary key.
 */
export function dedupeKeywords(keywords: ResolvedKeyword[]): ResolvedKeyword[] {
  return Array.from(new Map(keywords.map((keyword) => [keyword.id, keyword])).values());
}
