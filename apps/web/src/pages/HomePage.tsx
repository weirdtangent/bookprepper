import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/api";
import type { Author, BookListResponse, GenreFacet, KeywordFacet } from "../lib/api";
import { BookCard } from "../components/books/BookCard";
import { useDebounce } from "../hooks/useDebounce";
import { useAuth } from "../lib/auth";

const PAGE_SIZE = 12;
const labelFromSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
const parseListParam = (value: string | null) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [authorSlug, setAuthorSlug] = useState(() => searchParams.get("author") ?? "");
  const [genreFilters, setGenreFilters] = useState<string[]>([]);
  const [prepFilters, setPrepFilters] = useState<string[]>(() =>
    parseListParam(searchParams.get("prep"))
  );
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);
  const typeaheadSearch = useDebounce(search, 200);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, authorSlug, genreFilters, prepFilters]);

  const authorParam = searchParams.get("author") ?? "";
  const prepParam = searchParams.get("prep") ?? "";

  useEffect(() => {
    setAuthorSlug((current) => (current === authorParam ? current : authorParam));
  }, [authorParam]);

  useEffect(() => {
    const parsed = parseListParam(prepParam);
    setPrepFilters((current) => (areArraysEqual(current, parsed) ? current : parsed));
  }, [prepParam]);

  const genresQuery = useQuery<{ genres: GenreFacet[] }>({
    queryKey: ["genres"],
    queryFn: () => api.listGenres(),
  });

  const authorsQuery = useQuery<{ authors: Author[] }>({
    queryKey: ["authors"],
    queryFn: () => api.listAuthors(),
  });

  const keywordsQuery = useQuery<{ keywords: KeywordFacet[] }>({
    queryKey: ["prep-keywords"],
    queryFn: () => api.listPrepKeywords(),
  });

  const shuffleEnabled = auth.preferences.shuffleDefault ?? true;

  const booksQuery = useQuery<BookListResponse>({
    queryKey: [
      "books",
      { debouncedSearch, authorSlug, genreFilters, prepFilters, page, shuffleEnabled },
    ],
    queryFn: ({ signal }) =>
      api.listBooks(
        {
          search: debouncedSearch || undefined,
          author: authorSlug || undefined,
          genres: genreFilters,
          prep: prepFilters,
          page,
          pageSize: PAGE_SIZE,
          shuffle: shuffleEnabled,
        },
        signal
      ),
    placeholderData: keepPreviousData,
  });

  const typeaheadQuery = useQuery<BookListResponse>({
    queryKey: ["home-typeahead", typeaheadSearch],
    queryFn: ({ signal }) =>
      api.listBooks(
        {
          search: typeaheadSearch.trim() || undefined,
          page: 1,
          pageSize: 6,
        },
        signal
      ),
    enabled: typeaheadSearch.trim().length >= 2,
  });

  const updateAuthorFilter = (value: string) => {
    setAuthorSlug(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set("author", value);
      } else {
        next.delete("author");
      }
      return next;
    });
  };

  const updateListParam = (key: string, values: string[]) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (values.length > 0) {
        next.set(key, values.join(","));
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const toggleFilter = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) => {
      const alreadySelected = current.includes(value);
      if (alreadySelected) {
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  };

  const togglePrepFilter = (value: string) => {
    setPrepFilters((current) => {
      const alreadySelected = current.includes(value);
      const next = alreadySelected ? current.filter((item) => item !== value) : [...current, value];
      updateListParam("prep", next);
      return next;
    });
  };

  const hasResults = (booksQuery.data?.results.length ?? 0) > 0;

  const totalPages = booksQuery.data?.pagination.totalPages ?? 1;

  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  const keywords = useMemo(() => keywordsQuery.data?.keywords ?? [], [keywordsQuery.data]);

  // The endpoint returns exactly the curated vocabulary, so there is nothing left
  // to gate on here — a keyword reaching few books is shown when a curator has
  // decided it belongs.
  //
  // A ?prep=<slug> URL can still name a keyword outside that list: prep cards link
  // every keyword they carry, including ones awaiting review. Those slugs filter
  // server-side, so render them as chips or the only way out is "Reset filters".
  const unknownPrepFilters = useMemo(() => {
    const known = new Set(keywords.map((keyword) => keyword.slug));
    return prepFilters.filter((slug) => !known.has(slug));
  }, [keywords, prepFilters]);
  const genres = useMemo(() => genresQuery.data?.genres ?? [], [genresQuery.data]);
  const authors = useMemo(() => authorsQuery.data?.authors ?? [], [authorsQuery.data]);

  // Selecting a second genre widens the results while adding a keyword narrows
  // them, because filters OR within a group and AND across groups. Nothing on the
  // page says so, so state the active query in words instead of leaving the
  // reader to infer the rule from the result count moving the wrong way.
  const filterClauses = useMemo(() => {
    const nameFor = <T extends { name: string; slug: string }>(list: T[], slug: string) =>
      list.find((entry) => entry.slug === slug)?.name ?? labelFromSlug(slug);

    const clauses: string[] = [];

    if (debouncedSearch.trim()) {
      clauses.push(`matching \u201c${debouncedSearch.trim()}\u201d`);
    }

    const authorName = authors.find((author) => author.slug === authorSlug)?.name;
    if (authorName) {
      clauses.push(`by ${authorName}`);
    }

    if (genreFilters.length > 0) {
      clauses.push(`in ${genreFilters.map((slug) => nameFor(genres, slug)).join(" or ")}`);
    }

    if (prepFilters.length > 0) {
      const names = prepFilters.map((slug) => nameFor(keywords, slug));
      clauses.push(`with ${names.length === 1 ? "a prep" : "preps"} about ${names.join(" or ")}`);
    }

    return clauses;
  }, [debouncedSearch, authors, authorSlug, genreFilters, genres, prepFilters, keywords]);

  const resultTotal = booksQuery.data?.pagination.total ?? 0;
  const typeaheadResults = typeaheadQuery.data?.results ?? [];
  const showTypeahead = isSearchFocused && search.trim().length >= 2 && typeaheadResults.length > 0;

  const handleSearchFocus = () => {
    if (searchBlurTimeout.current) {
      clearTimeout(searchBlurTimeout.current);
    }
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    if (searchBlurTimeout.current) {
      clearTimeout(searchBlurTimeout.current);
    }
    searchBlurTimeout.current = setTimeout(() => {
      setIsSearchFocused(false);
    }, 120);
  };

  const handleSuggestionSelect = (book: BookListResponse["results"][number]) => {
    if (searchBlurTimeout.current) {
      clearTimeout(searchBlurTimeout.current);
    }
    setSearch(book.title);
    setIsSearchFocused(false);
    navigate(`/books/${book.slug}`);
  };

  const resetFilters = () => {
    setGenreFilters([]);
    setPrepFilters([]);
    updateListParam("prep", []);
    updateAuthorFilter("");
    setSearch("");
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Prep your next reading adventure</h1>
          <p>
            Browse our collection of books, narrow by genre and prep keyword, and see what other
            readers watch for before they start.
          </p>
        </div>
      </div>

      <section className="filters-panel">
        <div className="filter-group">
          <label htmlFor="search">Search the library</label>
          <div className="typeahead-wrapper">
            <input
              id="search"
              type="search"
              placeholder="Search by title, synopsis, or author"
              value={search}
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            {showTypeahead && (
              <ul className="typeahead-panel" role="listbox">
                {typeaheadResults.map((book) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      className="typeahead-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSuggestionSelect(book)}
                    >
                      <span className="typeahead-item__title">{book.title}</span>
                      <span className="typeahead-item__meta">
                        {book.author.name} · {book.prepCount} prep{book.prepCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="author">Author</label>
          <select
            id="author"
            value={authorSlug}
            onChange={(event) => updateAuthorFilter(event.target.value)}
          >
            <option value="">All authors</option>
            {authors.map((author) => (
              <option key={author.id} value={author.slug}>
                {author.name} ({author.bookCount})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-group__header">
            <span>Genres</span>
            <small>
              {genreFilters.length > 0 && "match any · "}
              {genreFilters.length} selected
            </small>
          </div>
          <div className="chip-grid">
            {genres.map((genre) => {
              const isSelected = genreFilters.includes(genre.slug);
              return (
                <button
                  key={genre.id}
                  type="button"
                  className={`chip ${isSelected ? "chip--selected" : ""}`}
                  title={genre.description ?? undefined}
                  onClick={() => toggleFilter(genre.slug, setGenreFilters)}
                >
                  {genre.name}
                  <span className="chip__count">{genre.bookCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group__header">
            <span>Prep keywords</span>
            <small>
              {prepFilters.length > 0 && "match any · "}
              {prepFilters.length} selected
            </small>
          </div>
          <div className="chip-grid">
            {keywords.map((keyword) => {
              const isSelected = prepFilters.includes(keyword.slug);
              return (
                <button
                  key={keyword.id}
                  type="button"
                  className={`chip ${isSelected ? "chip--selected" : ""}`}
                  title={keyword.description ?? undefined}
                  onClick={() => togglePrepFilter(keyword.slug)}
                >
                  {keyword.name}
                  <span className="chip__count">{keyword.bookCount}</span>
                </button>
              );
            })}
            {unknownPrepFilters.map((slug) => (
              <button
                key={slug}
                type="button"
                className="chip chip--selected"
                title="Not part of the curated keyword list. Select to remove it from your filters."
                onClick={() => togglePrepFilter(slug)}
              >
                {labelFromSlug(slug)}
                <span className="chip__remove" aria-hidden="true">
                  &times;
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="results-panel">
        {filterClauses.length > 0 && (
          <div className="filter-summary">
            <p>
              Showing {resultTotal} book{resultTotal === 1 ? "" : "s"} {filterClauses.join(", ")}.
            </p>
            <button type="button" className="link-button" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        )}
        {booksQuery.isLoading && (
          <p>{shuffleEnabled ? "Gathering random reading suggestions..." : "Loading books..."}</p>
        )}
        {booksQuery.isError && (
          <p role="alert">Something went wrong while loading books. Please try again.</p>
        )}

        {!booksQuery.isLoading && hasResults && (
          <>
            <div className="book-grid">
              {booksQuery.data?.results.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
            {shuffleEnabled ? (
              <div className="shuffle-controls">
                <button
                  type="button"
                  onClick={() => booksQuery.refetch()}
                  disabled={booksQuery.isFetching}
                >
                  {booksQuery.isFetching ? "Shuffling..." : "Shuffle again"}
                </button>
                <span className="shuffle-hint">Showing random picks</span>
              </div>
            ) : (
              <div className="pagination">
                <button disabled={!canGoBack} onClick={() => canGoBack && setPage((p) => p - 1)}>
                  Previous
                </button>
                <span>
                  Page {booksQuery.data?.pagination.page} of {totalPages}
                </span>
                <button
                  disabled={!canGoForward}
                  onClick={() => canGoForward && setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {!booksQuery.isLoading && !hasResults && (
          <div className="empty-state">
            <p>
              No books match these filters yet. Try removing a filter or submit a new suggestion.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

function areArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
