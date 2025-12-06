import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  type AdminBookListItem,
  type AdminCreateBookInput,
  type AdminPrepDetail,
  type AdminPrepInput,
  type AdminUpdateBookInput
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDebounce } from "../hooks/useDebounce";

type PrepDraft = {
  heading: string;
  summary: string;
  watchFor: string;
  colorHint: string;
  keywords: string;
};

const emptyPrepDraft: PrepDraft = {
  heading: "",
  summary: "",
  watchFor: "",
  colorHint: "",
  keywords: ""
};

const emptyBookForm = {
  title: "",
  authorName: "",
  slug: "",
  synopsis: "",
  coverImageUrl: "",
  isbn: "",
  publishedYear: ""
};

const SYNOPSIS_LIMIT = 1024;

export default function AdminPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramSlug = searchParams.get("book");

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<{ search: string }>({ search: "" });
  const [page, setPage] = useState(1);
  const [selectedSlug, setSelectedSlugState] = useState<string | null>(paramSlug);
  const [synopsisDraft, setSynopsisDraft] = useState("");
  const [coverDraft, setCoverDraft] = useState("");
  const [isbnDraft, setIsbnDraft] = useState("");
  const [publishedYearDraft, setPublishedYearDraft] = useState("");
  const [genreSelection, setGenreSelection] = useState<string[]>([]);
  const [prepDrafts, setPrepDrafts] = useState<Record<string, PrepDraft>>({});
  const [newPrepDraft, setNewPrepDraft] = useState<PrepDraft>(emptyPrepDraft);
  const [bookFormState, setBookFormState] = useState(emptyBookForm);
  const [bookFormGenres, setBookFormGenres] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paramSlug && paramSlug !== selectedSlug) {
      setSelectedSlugState(paramSlug);
    }
  }, [paramSlug, selectedSlug]);

  const selectBook = useCallback(
    (slug: string) => {
      setSelectedSlugState(slug);
      setSearchParams({ book: slug }, { replace: true });
    },
    [setSearchParams]
  );

  const isAuthorized = auth.isAdmin && Boolean(auth.token);
  const pageSize = 12;

  const debouncedSearch = useDebounce(searchInput, 200);

  const booksQuery = useQuery({
    queryKey: ["admin-books", filters.search, page],
    queryFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminListBooks({
        search: filters.search || undefined,
        page,
        pageSize,
        token: auth.token
      });
    },
    enabled: isAuthorized
  });

  const typeaheadQuery = useQuery({
    queryKey: ["admin-book-suggestions", debouncedSearch],
    queryFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminListBooks({
        search: debouncedSearch.trim() || undefined,
        page: 1,
        pageSize: 6,
        token: auth.token
      });
    },
    enabled: isAuthorized && debouncedSearch.trim().length >= 2
  });

  const bookDetailQuery = useQuery({
    queryKey: ["admin-book", selectedSlug],
    queryFn: async () => {
      if (!auth.token || !selectedSlug) {
        throw new Error("Missing selection.");
      }
      return api.adminGetBook(selectedSlug, auth.token);
    },
    enabled: isAuthorized && Boolean(selectedSlug)
  });

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: () => api.listGenres()
  });

  const metadataSuggestionsQuery = useQuery({
    queryKey: ["admin-suggestions", "metadata"],
    queryFn: () => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminListMetadataSuggestions(auth.token);
    },
    enabled: isAuthorized
  });

  const prepSuggestionsQuery = useQuery({
    queryKey: ["admin-suggestions", "preps"],
    queryFn: () => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminListPrepSuggestions(auth.token);
    },
    enabled: isAuthorized
  });

  const bookSuggestionsQuery = useQuery({
    queryKey: ["admin-suggestions", "books"],
    queryFn: () => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminListBookSuggestions(auth.token);
    },
    enabled: isAuthorized
  });

  useEffect(() => {
    if (!selectedSlug && booksQuery.data?.results.length) {
      selectBook(booksQuery.data.results[0].slug);
    }
  }, [booksQuery.data, selectedSlug, selectBook]);

  const bookDetail = bookDetailQuery.data?.book ?? null;
  const genres = genresQuery.data?.genres ?? [];
  const suggestionResults = typeaheadQuery.data?.results ?? [];
  const showTypeahead =
    isSearchFocused && searchInput.trim().length >= 2 && suggestionResults.length > 0;

  useEffect(() => {
    if (!bookDetail) {
      setSynopsisDraft("");
      setCoverDraft("");
      setIsbnDraft("");
      setPublishedYearDraft("");
      setGenreSelection([]);
      setPrepDrafts({});
      return;
    }

    setSynopsisDraft(bookDetail.synopsis ?? "");
    setCoverDraft(bookDetail.coverImageUrl ?? "");
    setIsbnDraft(bookDetail.isbn ?? "");
    setPublishedYearDraft(bookDetail.publishedYear?.toString() ?? "");
    setGenreSelection(bookDetail.genres.map((genre) => genre.id));
    setPrepDrafts(
      bookDetail.preps.reduce<Record<string, PrepDraft>>((acc, prep) => {
        acc[prep.id] = {
          heading: prep.heading,
          summary: prep.summary,
          watchFor: prep.watchFor ?? "",
          colorHint: prep.colorHint ?? "",
          keywords: prep.keywords.map((keyword) => keyword.name).join(", ")
        };
        return acc;
      }, {})
    );
  }, [bookDetail]);

  const updateBookMutation = useMutation({
    mutationFn: async (variables: { slug: string; body: AdminUpdateBookInput }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminUpdateBook(variables.slug, variables.body, auth.token);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-book", variables.slug] });
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
    }
  });

  const createBookMutation = useMutation({
    mutationFn: async (payload: AdminCreateBookInput) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminCreateBook(payload, auth.token);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      setBookFormState(emptyBookForm);
      setBookFormGenres([]);
      if (response.book.slug) {
        selectBook(response.book.slug);
      }
    }
  });

  const createPrepMutation = useMutation({
    mutationFn: async (variables: { slug: string; body: AdminPrepInput }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminCreatePrep({
        slug: variables.slug,
        body: variables.body,
        token: auth.token
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-book", variables.slug] });
      setNewPrepDraft(emptyPrepDraft);
    }
  });

  const updatePrepMutation = useMutation({
    mutationFn: async (variables: { slug: string; prepId: string; body: AdminPrepInput }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminUpdatePrep({
        slug: variables.slug,
        prepId: variables.prepId,
        body: variables.body,
        token: auth.token
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-book", variables.slug] });
    }
  });

  const deletePrepMutation = useMutation({
    mutationFn: async (variables: { slug: string; prepId: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminDeletePrep({
        slug: variables.slug,
        prepId: variables.prepId,
        token: auth.token
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-book", variables.slug] });
    }
  });

  const metadataApproveMutation = useMutation({
    mutationFn: async (variables: { id: string; bookSlug: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminApproveMetadataSuggestion({ id: variables.id, token: auth.token });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions", "metadata"] });
      queryClient.invalidateQueries({ queryKey: ["admin-book", variables.bookSlug] });
    }
  });

  const metadataRejectMutation = useMutation({
    mutationFn: async (variables: { id: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminRejectMetadataSuggestion({ id: variables.id, token: auth.token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions", "metadata"] });
    }
  });

  const prepApproveMutation = useMutation({
    mutationFn: async (variables: { id: string; bookSlug: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminApprovePrepSuggestion({ id: variables.id, token: auth.token });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions", "preps"] });
      queryClient.invalidateQueries({ queryKey: ["admin-book", variables.bookSlug] });
    }
  });

  const prepRejectMutation = useMutation({
    mutationFn: async (variables: { id: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminRejectPrepSuggestion({ id: variables.id, token: auth.token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions", "preps"] });
    }
  });

  const bookApproveMutation = useMutation({
    mutationFn: async (variables: { id: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminApproveBookSuggestion({ id: variables.id, token: auth.token });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions", "books"] });
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      if (response.book.slug) {
        selectBook(response.book.slug);
      }
    }
  });

  const bookRejectMutation = useMutation({
    mutationFn: async (variables: { id: string }) => {
      if (!auth.token) {
        throw new Error("Authentication required.");
      }
      return api.adminRejectBookSuggestion({ id: variables.id, token: auth.token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions", "books"] });
    }
  });

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ search: searchInput.trim() });
    setPage(1);
  };

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
    }, 100);
  };

  const handleSuggestionSelect = (book: AdminBookListItem) => {
    if (searchBlurTimeout.current) {
      clearTimeout(searchBlurTimeout.current);
    }
    setSearchInput(book.title);
    setFilters({ search: book.title });
    selectBook(book.slug);
    setIsSearchFocused(false);
  };

  const handleMetadataSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlug) {
      return;
    }
    updateBookMutation.mutate({
      slug: selectedSlug,
      body: {
        synopsis: synopsisDraft.trim() || null,
        coverImageUrl: coverDraft.trim() || null,
        isbn: isbnDraft.trim() || null,
        publishedYear: parseYear(publishedYearDraft),
        genreIds: genreSelection
      }
    });
  };

  const handlePrepDraftChange = (prepId: string, field: keyof PrepDraft, value: string) => {
    setPrepDrafts((current) => ({
      ...current,
      [prepId]: {
        ...(current[prepId] ?? emptyPrepDraft),
        [field]: value
      }
    }));
  };

  const handlePrepSave = (event: React.FormEvent<HTMLFormElement>, prep: AdminPrepDetail) => {
    event.preventDefault();
    if (!selectedSlug) {
      return;
    }
    const draft = prepDrafts[prep.id];
    if (!draft) {
      return;
    }

    updatePrepMutation.mutate({
      slug: selectedSlug,
      prepId: prep.id,
      body: {
        heading: draft.heading,
        summary: draft.summary,
        watchFor: draft.watchFor.trim() || null,
        colorHint: draft.colorHint.trim() || null,
        keywords: splitKeywords(draft.keywords)
      }
    });
  };

  const handlePrepDelete = (prep: AdminPrepDetail) => {
    if (!selectedSlug) {
      return;
    }
    if (!window.confirm(`Delete prep "${prep.heading}"?`)) {
      return;
    }
    deletePrepMutation.mutate({
      slug: selectedSlug,
      prepId: prep.id
    });
  };

  const handleNewPrepSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlug) {
      return;
    }
    createPrepMutation.mutate({
      slug: selectedSlug,
      body: {
        heading: newPrepDraft.heading,
        summary: newPrepDraft.summary,
        watchFor: newPrepDraft.watchFor.trim() || null,
        colorHint: newPrepDraft.colorHint.trim() || null,
        keywords: splitKeywords(newPrepDraft.keywords)
      }
    });
  };

  const handleCreateBook = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: AdminCreateBookInput = {
      title: bookFormState.title,
      authorName: bookFormState.authorName,
      slug: bookFormState.slug || undefined,
      synopsis: bookFormState.synopsis || undefined,
      coverImageUrl: bookFormState.coverImageUrl || undefined,
      isbn: bookFormState.isbn?.trim() ? bookFormState.isbn.trim() : undefined,
      publishedYear: parseYear(bookFormState.publishedYear) ?? undefined,
      genreIds: bookFormGenres.length > 0 ? bookFormGenres : undefined
    };
    createBookMutation.mutate(payload);
  };

  if (auth.isLoading) {
    return (
      <section className="page">
        <p>Loading admin tools…</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="page">
        <h1>Admin</h1>
        <p>Sign in with your admin account to manage the library.</p>
        <button className="primary-button" onClick={auth.signIn}>
          Sign in
        </button>
      </section>
    );
  }

  if (!auth.isAdmin) {
    return (
      <section className="page">
        <h1>Admin</h1>
        <p>You need the configured admin account to access this area.</p>
      </section>
    );
  }

  const metadataSuggestions = metadataSuggestionsQuery.data?.suggestions ?? [];
  const prepSuggestions = prepSuggestionsQuery.data?.suggestions ?? [];
  const bookSuggestions = bookSuggestionsQuery.data?.suggestions ?? [];

  return (
    <section className="page admin-page">
      <header className="page-header">
        <div>
          <h1>Admin dashboard</h1>
          <p>Manage the catalog, prep notes, and community submissions.</p>
        </div>
      </header>

      <div className="admin-grid">
        <div className="admin-panel">
          <div className="admin-panel__header">
            <h2>Catalog</h2>
            <small>{booksQuery.data?.pagination.total ?? 0} books</small>
          </div>
          <form className="admin-form" onSubmit={handleSearchSubmit} autoComplete="off">
            <label>
              Search catalog
              <div className="typeahead-wrapper">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Title or author"
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                />
                {showTypeahead && (
                  <ul className="typeahead-panel" role="listbox">
                    {suggestionResults.map((book) => (
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
            </label>
            <div className="admin-form__row">
              <button type="submit" className="primary-button" disabled={booksQuery.isLoading}>
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setFilters({ search: "" });
                  setPage(1);
                }}
                disabled={!filters.search && !searchInput}
              >
                Clear
              </button>
            </div>
          </form>
          {booksQuery.isLoading && <p>Loading books…</p>}
          {booksQuery.isError && <p role="alert">Unable to load catalog.</p>}
          {booksQuery.data && (
            <>
              <ul className="admin-book-list">
                {booksQuery.data.results.map((book) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      className={book.slug === selectedSlug ? "active" : ""}
                      onClick={() => selectBook(book.slug)}
                    >
                      <span className="admin-book-list__title">{book.title}</span>
                      <span className="admin-book-list__meta">
                        {book.author.name} · {book.prepCount} prep{book.prepCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </button>
                <span>
                  Page {page} / {booksQuery.data.pagination.totalPages || 1}
                </span>
                <button
                  disabled={page >= (booksQuery.data.pagination.totalPages || 1)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}

          <div className="admin-divider" />

          <form className="admin-form" onSubmit={handleCreateBook}>
            <h3>Add a book</h3>
            <label>
              Title
              <input
                required
                value={bookFormState.title}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              Author
              <input
                required
                value={bookFormState.authorName}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, authorName: event.target.value }))
                }
              />
            </label>
            <label>
              Custom slug
              <input
                value={bookFormState.slug}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <label>
              Synopsis
              <textarea
                value={bookFormState.synopsis}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, synopsis: event.target.value }))
                }
                placeholder="Optional"
                maxLength={SYNOPSIS_LIMIT}
              />
              <div className="char-counter" aria-live="polite">
                {bookFormState.synopsis.length}/{SYNOPSIS_LIMIT}
              </div>
            </label>
            <label>
              Cover image URL
              <input
                value={bookFormState.coverImageUrl}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, coverImageUrl: event.target.value }))
                }
                placeholder="https://…"
              />
            </label>
            <label>
              ISBN
              <input
                value={bookFormState.isbn}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, isbn: event.target.value }))
                }
                placeholder="978…"
              />
              <small>Used for Open Library cover fallbacks.</small>
            </label>
            <label>
              Published year
              <input
                type="number"
                value={bookFormState.publishedYear}
                onChange={(event) =>
                  setBookFormState((current) => ({ ...current, publishedYear: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <div className="admin-form__group">
              <span>Genres</span>
              <div className="chip-grid">
                {genres.map((genre) => {
                  const isSelected = bookFormGenres.includes(genre.id);
                  return (
                    <button
                      type="button"
                      key={genre.id}
                      className={`chip ${isSelected ? "chip--selected" : ""}`}
                      onClick={() => toggleSelection(genre.id, setBookFormGenres)}
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="submit" className="primary-button" disabled={createBookMutation.isPending}>
              {createBookMutation.isPending ? "Adding…" : "Add book"}
            </button>
          </form>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__header admin-panel__header--spread">
            <h2>Book detail</h2>
            {bookDetail && (
              <div className="admin-panel__header-meta">
                <Link to={`/books/${bookDetail.slug}`} className="admin-panel__book-title">
                  {bookDetail.title}
                </Link>
                <small>{bookDetail.updatedAt ? new Date(bookDetail.updatedAt).toLocaleString() : ""}</small>
              </div>
            )}
          </div>
          {!bookDetail && <p>Select a book to edit it.</p>}
          {bookDetail && (
            <>
              <form className="admin-form" onSubmit={handleMetadataSave}>
                <label>
                  Synopsis
                  <textarea
                    value={synopsisDraft}
                    onChange={(event) => setSynopsisDraft(event.target.value)}
                  maxLength={SYNOPSIS_LIMIT}
                    placeholder="Add a spoiler-free synopsis"
                  />
                <div className="char-counter" aria-live="polite">
                  {synopsisDraft.length}/{SYNOPSIS_LIMIT}
                </div>
                </label>
                <label>
                  Cover image URL
                  <input
                    value={coverDraft}
                    onChange={(event) => setCoverDraft(event.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <label>
                  ISBN
                  <input
                    value={isbnDraft}
                    onChange={(event) => setIsbnDraft(event.target.value)}
                    placeholder="978…"
                  />
                  <small>Uses Open Library covers when no custom image is set.</small>
                </label>
                <label>
                  Published year
                  <input
                    type="number"
                    value={publishedYearDraft}
                    onChange={(event) => setPublishedYearDraft(event.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <div className="admin-form__group">
                  <span>Genres</span>
                  <div className="chip-grid">
                    {genres.map((genre) => {
                      const isSelected = genreSelection.includes(genre.id);
                      return (
                        <button
                          type="button"
                          key={genre.id}
                          className={`chip ${isSelected ? "chip--selected" : ""}`}
                          onClick={() => toggleSelection(genre.id, setGenreSelection)}
                        >
                          {genre.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="submit" className="primary-button" disabled={updateBookMutation.isPending}>
                  {updateBookMutation.isPending ? "Saving…" : "Save metadata"}
                </button>
              </form>

              <div className="admin-divider" />

              <section>
                <h3>Existing preps ({bookDetail.preps.length})</h3>
                {bookDetail.preps.length === 0 && <p>No preps yet.</p>}
                <div className="admin-prep-list">
                  {bookDetail.preps.map((prep) => {
                    const draft = prepDrafts[prep.id] ?? {
                      heading: prep.heading,
                      summary: prep.summary,
                      watchFor: prep.watchFor ?? "",
                      colorHint: prep.colorHint ?? "",
                      keywords: prep.keywords.map((keyword) => keyword.name).join(", ")
                    };
                    return (
                      <form
                        key={prep.id}
                        className="admin-form admin-form--stacked"
                        onSubmit={(event) => handlePrepSave(event, prep)}
                      >
                        <label>
                          Heading
                          <input
                            value={draft.heading}
                            onChange={(event) => handlePrepDraftChange(prep.id, "heading", event.target.value)}
                          />
                        </label>
                        <label>
                          Summary
                          <textarea
                            value={draft.summary}
                            onChange={(event) => handlePrepDraftChange(prep.id, "summary", event.target.value)}
                          />
                        </label>
                        <label>
                          Watch for
                          <textarea
                            value={draft.watchFor}
                            onChange={(event) => handlePrepDraftChange(prep.id, "watchFor", event.target.value)}
                          />
                        </label>
                        <label>
                          Color hint
                          <input
                            value={draft.colorHint}
                            onChange={(event) => handlePrepDraftChange(prep.id, "colorHint", event.target.value)}
                          />
                        </label>
                        <label>
                          Keywords <small>(comma separated)</small>
                          <input
                            value={draft.keywords}
                            onChange={(event) => handlePrepDraftChange(prep.id, "keywords", event.target.value)}
                          />
                        </label>
                        <div className="admin-form__row">
                          <button type="submit" className="primary-button" disabled={updatePrepMutation.isPending}>
                            {updatePrepMutation.isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrepDelete(prep)}
                            disabled={deletePrepMutation.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </form>
                    );
                  })}
                </div>
              </section>

              <div className="admin-divider" />

              <form className="admin-form" onSubmit={handleNewPrepSubmit}>
                <h3>Add prep</h3>
                <label>
                  Heading
                  <input
                    required
                    value={newPrepDraft.heading}
                    onChange={(event) => setNewPrepDraft((draft) => ({ ...draft, heading: event.target.value }))}
                  />
                </label>
                <label>
                  Summary
                  <textarea
                    required
                    value={newPrepDraft.summary}
                    onChange={(event) => setNewPrepDraft((draft) => ({ ...draft, summary: event.target.value }))}
                  />
                </label>
                <label>
                  Watch for
                  <textarea
                    value={newPrepDraft.watchFor}
                    onChange={(event) => setNewPrepDraft((draft) => ({ ...draft, watchFor: event.target.value }))}
                  />
                </label>
                <label>
                  Color hint
                  <input
                    value={newPrepDraft.colorHint}
                    onChange={(event) => setNewPrepDraft((draft) => ({ ...draft, colorHint: event.target.value }))}
                  />
                </label>
                <label>
                  Keywords <small>(comma separated)</small>
                  <input
                    value={newPrepDraft.keywords}
                    onChange={(event) => setNewPrepDraft((draft) => ({ ...draft, keywords: event.target.value }))}
                  />
                </label>
                <button type="submit" className="primary-button" disabled={createPrepMutation.isPending}>
                  {createPrepMutation.isPending ? "Adding…" : "Add prep"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel__header">
          <h2>Suggestion queue</h2>
        </div>
        <div className="admin-suggestions">
          <SuggestionColumn
            title={`Metadata (${metadataSuggestions.length})`}
            isLoading={metadataSuggestionsQuery.isLoading}
            emptyLabel="No pending metadata suggestions."
          >
            {metadataSuggestions.map((suggestion) => (
              <article key={suggestion.id} className="suggestion-card">
                <header>
                  <strong>{suggestion.book.title}</strong>
                  <small>Submitted by {suggestion.submittedBy?.displayName ?? "anon"}</small>
                </header>
                {suggestion.synopsis && <p>{suggestion.synopsis}</p>}
                {suggestion.genres.length > 0 && (
                  <p>
                    Genres:{" "}
                    {suggestion.genres.map((genre) => (
                      <span key={genre} className="suggestion-chip">
                        {genre}
                      </span>
                    ))}
                  </p>
                )}
                <div className="admin-form__row">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={metadataApproveMutation.isPending}
                    onClick={() =>
                      metadataApproveMutation.mutate({ id: suggestion.id, bookSlug: suggestion.book.slug })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={metadataRejectMutation.isPending}
                    onClick={() => metadataRejectMutation.mutate({ id: suggestion.id })}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </SuggestionColumn>

          <SuggestionColumn
            title={`Preps (${prepSuggestions.length})`}
            isLoading={prepSuggestionsQuery.isLoading}
            emptyLabel="No pending prep suggestions."
          >
            {prepSuggestions.map((suggestion) => (
              <article key={suggestion.id} className="suggestion-card">
                <header>
                  <strong>{suggestion.title}</strong>
                  <small>{suggestion.book.title}</small>
                </header>
                <p>{suggestion.description}</p>
                {suggestion.keywordHints.length > 0 && (
                  <p>
                    Keywords:{" "}
                    {suggestion.keywordHints.map((keyword) => (
                      <span key={keyword} className="suggestion-chip">
                        {keyword}
                      </span>
                    ))}
                  </p>
                )}
                <div className="admin-form__row">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={prepApproveMutation.isPending}
                    onClick={() =>
                      prepApproveMutation.mutate({ id: suggestion.id, bookSlug: suggestion.book.slug })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={prepRejectMutation.isPending}
                    onClick={() => prepRejectMutation.mutate({ id: suggestion.id })}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </SuggestionColumn>

          <SuggestionColumn
            title={`Book ideas (${bookSuggestions.length})`}
            isLoading={bookSuggestionsQuery.isLoading}
            emptyLabel="No pending book nominations."
          >
            {bookSuggestions.map((suggestion) => (
              <article key={suggestion.id} className="suggestion-card">
                <header>
                  <strong>{suggestion.title}</strong>
                  <small>By {suggestion.authorName}</small>
                </header>
                {suggestion.notes && <p>{suggestion.notes}</p>}
                {suggestion.genreIdeas.length > 0 && (
                  <p>
                    Genres:{" "}
                    {suggestion.genreIdeas.map((genre) => (
                      <span key={genre} className="suggestion-chip">
                        {genre}
                      </span>
                    ))}
                  </p>
                )}
                {suggestion.prepIdeas.length > 0 && (
                  <p>
                    Prep ideas:{" "}
                    {suggestion.prepIdeas.map((idea) => (
                      <span key={idea} className="suggestion-chip">
                        {idea}
                      </span>
                    ))}
                  </p>
                )}
                <div className="admin-form__row">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={bookApproveMutation.isPending}
                    onClick={() => bookApproveMutation.mutate({ id: suggestion.id })}
                  >
                    Approve & add
                  </button>
                  <button
                    type="button"
                    disabled={bookRejectMutation.isPending}
                    onClick={() => bookRejectMutation.mutate({ id: suggestion.id })}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </SuggestionColumn>
        </div>
      </div>
    </section>
  );
}

type SuggestionColumnProps = {
  title: string;
  isLoading: boolean;
  emptyLabel: string;
  children: React.ReactNode;
};

function SuggestionColumn({ title, isLoading, emptyLabel, children }: SuggestionColumnProps) {
  const content = useMemo(() => {
    if (isLoading) {
      return <p>Loading…</p>;
    }
    if (!children) {
      return <p>{emptyLabel}</p>;
    }
    if (Array.isArray(children) && children.length === 0) {
      return <p>{emptyLabel}</p>;
    }
    return children;
  }, [children, emptyLabel, isLoading]);

  return (
    <section className="suggestion-column">
      <h3>{title}</h3>
      {content}
    </section>
  );
}

function toggleSelection(value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
  setter((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]));
}

function splitKeywords(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseYear(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

