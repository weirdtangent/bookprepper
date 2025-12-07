import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PromptFeedbackDimension } from "../lib/api";
import type { Genre } from "../lib/api";
import { PrepCard, type PrepFeedbackDraft } from "../components/preps/PrepCard";
import { useAuth } from "../lib/auth";

const DEFAULT_FEEDBACK_DIMENSION: PromptFeedbackDimension = "CORRECT";

const ensureDraft = (draft?: PrepFeedbackDraft): PrepFeedbackDraft =>
  draft ?? {
    dimension: DEFAULT_FEEDBACK_DIMENSION,
    note: ""
  };

export default function BookDetailPage() {
  const { slug = "" } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [prepTitle, setPrepTitle] = useState("");
  const [prepDescription, setPrepDescription] = useState("");
  const [prepKeywords, setPrepKeywords] = useState("");
  const [synopsisSuggestion, setSynopsisSuggestion] = useState("");
  const [genreSuggestions, setGenreSuggestions] = useState<string[]>([]);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, PrepFeedbackDraft>>({});
  const SYNOPSIS_LIMIT = 1024;

  useEffect(() => {
    setPrepTitle("");
    setPrepDescription("");
    setPrepKeywords("");
    setSynopsisSuggestion("");
    setGenreSuggestions([]);
    setMetadataError(null);
    setFeedbackDrafts({});
  }, [slug]);

  const getFeedbackDraft = (prepId: string) => ensureDraft(feedbackDrafts[prepId]);

  const updateFeedbackDraft = (prepId: string, updates: Partial<PrepFeedbackDraft>) => {
    setFeedbackDrafts((current) => ({
      ...current,
      [prepId]: {
        ...ensureDraft(current[prepId]),
        ...updates
      }
    }));
  };

  const bookQuery = useQuery({
    queryKey: ["book", slug],
    queryFn: ({ signal }) => api.getBook(slug, signal),
    enabled: Boolean(slug)
  });

  const genresQuery = useQuery<{ genres: Genre[] }>({
    queryKey: ["genres"],
    queryFn: () => api.listGenres()
  });

  const availableGenres = useMemo(() => genresQuery.data?.genres ?? [], [genresQuery.data]);

  const voteMutation = useMutation({
    mutationFn: async ({
      prepId,
      value,
      dimension,
      note
    }: {
      prepId: string;
      value: "AGREE" | "DISAGREE";
      dimension: PromptFeedbackDimension;
      note?: string;
    }) => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.voteOnPrep({ slug, prepId, value, dimension, note, token: auth.token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", slug] });
      const lastPrepId = voteMutation.variables?.prepId;
      if (lastPrepId) {
        setFeedbackDrafts((current) => ({
          ...current,
          [lastPrepId]: {
            ...ensureDraft(current[lastPrepId]),
            note: ""
          }
        }));
      }
    }
  });

  const suggestPrepMutation = useMutation({
    mutationFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.suggestPrep({
        slug,
        title: prepTitle,
        description: prepDescription,
        keywordHints: prepKeywords
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        token: auth.token
      });
    },
    onSuccess: () => {
      setPrepTitle("");
      setPrepDescription("");
      setPrepKeywords("");
    }
  });

  const metadataMutation = useMutation({
    mutationFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.suggestBookMetadata({
        slug,
        synopsis: synopsisSuggestion.trim() || undefined,
        genres: genreSuggestions,
        token: auth.token
      });
    },
    onSuccess: () => {
      setSynopsisSuggestion("");
      setGenreSuggestions([]);
      setMetadataError(null);
    }
  });

  const handleVote = (
    prepId: string,
    payload: { value: "AGREE" | "DISAGREE"; dimension: PromptFeedbackDimension; note?: string }
  ) => {
    if (auth.isLoading) {
      return;
    }
    if (!auth.isAuthenticated) {
      const allowed = auth.requireAuth();
      if (!allowed) {
        return;
      }
    }
    voteMutation.mutate({
      prepId,
      value: payload.value,
      dimension: payload.dimension,
      note: payload.note
    });
  };

  const handleSuggestPrep = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (auth.isLoading) {
      return;
    }
    if (!auth.isAuthenticated) {
      const allowed = auth.requireAuth();
      if (!allowed) {
        return;
      }
    }
    suggestPrepMutation.mutate();
  };

  const toggleGenreSuggestion = (slug: string) => {
    setGenreSuggestions((current) => {
      const exists = current.includes(slug);
      return exists ? current.filter((entry) => entry !== slug) : [...current, slug];
    });
  };

  const handleMetadataSuggest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!synopsisSuggestion.trim() && genreSuggestions.length === 0) {
      setMetadataError("Add a synopsis or select at least one genre.");
      return;
    }
    if (auth.isLoading) {
      return;
    }
    if (!auth.isAuthenticated) {
      const allowed = auth.requireAuth();
      if (!allowed) {
        return;
      }
    }
    metadataMutation.mutate();
  };

  useEffect(() => {
    if (!bookQuery.data) {
      setCoverError(false);
      return;
    }
    setCoverError(false);
  }, [bookQuery.data?.coverImageUrl, bookQuery.data?.id]);

  if (bookQuery.isLoading) {
    return (
      <section className="page">
        <p>Loading book...</p>
      </section>
    );
  }

  if (bookQuery.isError || !bookQuery.data) {
    return (
      <section className="page">
        <p role="alert">We couldn&rsquo;t load this book. Please try again.</p>
        <Link to="/" className="link-button">
          Back to library
        </Link>
      </section>
    );
  }

  const book = bookQuery.data;
  const votingDisabled = !auth.isAuthenticated || auth.isLoading;
  const votingPrepId = voteMutation.variables?.prepId;
  const adminEditLink = `/admin?book=${encodeURIComponent(book.slug)}`;

  return (
    <section className="page">
      <div className="page-actions">
        <Link to="/" className="link-button">
          &larr; Back to library
        </Link>
        {auth.isAdmin && (
          <Link to={adminEditLink} className="admin-edit-link">
            Edit in Admin
          </Link>
        )}
      </div>

      <div className="book-hero">
        <div className="book-hero__media" aria-hidden={!book.coverImageUrl}>
          {!book.coverImageUrl || coverError ? (
            <div className="book-hero__media-placeholder">
              {book.title.charAt(0).toUpperCase()}
            </div>
          ) : (
            <img
              src={book.coverImageUrl}
              alt={`${book.title} cover`}
              loading="lazy"
              onError={() => setCoverError(true)}
            />
          )}
        </div>
        <div className="book-hero__content">
          <p className="book-hero__eyebrow">
            <Link to={`/?author=${book.author.slug}`} className="book-hero__author-link">
              {book.author.name}
            </Link>
          </p>
          <h1>{book.title}</h1>
          {book.synopsis && <p>{book.synopsis}</p>}
        </div>
        <div className="book-hero__meta">
          <h4>Genres</h4>
          <div className="chip-grid">
            {book.genres.map((genre) => (
              <span key={genre.id} className="chip chip--static">
                {genre.name}
              </span>
            ))}
          </div>
          {book.isbn && (
            <div className="book-hero__detail-row">
              <span className="book-hero__detail-label">ISBN</span>
              <code className="book-hero__detail-value">{book.isbn}</code>
            </div>
          )}
        </div>
      </div>

      <section className="preps-section">
        <header className="section-header">
          <div>
            <h2>Prep notes</h2>
            <p>See what veteran readers track while they read this title.</p>
          </div>
          <span>
            {book.prepCount} prep{book.prepCount === 1 ? "" : "s"}
          </span>
        </header>

        {book.prepCount > book.preps.length && (
          <p className="helper-text">
            Showing the top {book.preps.length} prompts right now. Vote to help reorder the list.
          </p>
        )}

        {book.preps.length === 0 && <p>No preps yet. Be the first to suggest one!</p>}

        <div className="prep-grid">
          {book.preps.map((prep) => (
            <PrepCard
              key={prep.id}
              prep={prep}
              feedbackDraft={getFeedbackDraft(prep.id)}
              onFeedbackDraftChange={(updates) => updateFeedbackDraft(prep.id, updates)}
              votingDisabled={votingDisabled}
              isVoting={voteMutation.isPending && votingPrepId === prep.id}
              onVote={(payload) => handleVote(prep.id, payload)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Suggest another prep</h3>
        <p>Add the themes, motifs, or signals you track for this book.</p>
        <form className="form" onSubmit={handleSuggestPrep}>
          <label>
            Prep title
            <input
              required
              minLength={3}
              value={prepTitle}
              onChange={(event) => setPrepTitle(event.target.value)}
              placeholder="Ex: Trace colonial pressure points"
            />
          </label>
          <label>
            Details
            <textarea
              required
              minLength={10}
              value={prepDescription}
              onChange={(event) => setPrepDescription(event.target.value)}
              placeholder="Describe what to watch for without spoiling the plot."
            />
          </label>
          <label>
            Keyword hints
            <input
              value={prepKeywords}
              onChange={(event) => setPrepKeywords(event.target.value)}
              placeholder="Comma-separated keywords (optional)"
            />
          </label>
          <button type="submit" disabled={suggestPrepMutation.isPending}>
            {suggestPrepMutation.isPending ? "Submitting..." : "Submit prep suggestion"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h3>Suggest a synopsis or genre</h3>
        <p>Help fill in missing metadata so future readers know what to expect.</p>
        <form className="form" onSubmit={handleMetadataSuggest}>
          <label>
            Synopsis (optional)
            <textarea
              minLength={40}
              maxLength={SYNOPSIS_LIMIT}
              value={synopsisSuggestion}
              onChange={(event) => setSynopsisSuggestion(event.target.value)}
              placeholder="Write a spoiler-free synopsis for this book."
            />
            <div className="char-counter" aria-live="polite">
              {synopsisSuggestion.length}/{SYNOPSIS_LIMIT}
            </div>
          </label>
          <div className="filter-group">
            <div className="filter-group__header">
              <span>Genres (optional)</span>
              <small>{genreSuggestions.length} selected</small>
            </div>
            <div className="chip-grid">
              {availableGenres.map((genre) => {
                const isSelected = genreSuggestions.includes(genre.slug);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    className={`chip ${isSelected ? "chip--selected" : ""}`}
                    onClick={() => toggleGenreSuggestion(genre.slug)}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </div>
          {metadataError && (
            <p className="error-text" role="alert">
              {metadataError}
            </p>
          )}
          {metadataMutation.isSuccess && !metadataError && (
            <p className="success-text" role="status">
              Thanks! Your suggestion is waiting for moderator review.
            </p>
          )}
          <button type="submit" disabled={metadataMutation.isPending}>
            {metadataMutation.isPending ? "Submitting..." : "Submit metadata suggestion"}
          </button>
        </form>
      </section>
    </section>
  );
}

