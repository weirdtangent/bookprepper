import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PrepCard } from "../components/preps/PrepCard";
import { useAuth } from "../lib/auth";

export default function BookDetailPage() {
  const { slug = "" } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [prepTitle, setPrepTitle] = useState("");
  const [prepDescription, setPrepDescription] = useState("");
  const [prepKeywords, setPrepKeywords] = useState("");

  useEffect(() => {
    setPrepTitle("");
    setPrepDescription("");
    setPrepKeywords("");
  }, [slug]);

  const bookQuery = useQuery({
    queryKey: ["book", slug],
    queryFn: ({ signal }) => api.getBook(slug, signal),
    enabled: Boolean(slug)
  });

  const voteMutation = useMutation({
    mutationFn: async ({ prepId, value }: { prepId: string; value: "AGREE" | "DISAGREE" }) => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.voteOnPrep({ slug, prepId, value, token: auth.token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book", slug] });
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

  const handleVote = (prepId: string, value: "AGREE" | "DISAGREE") => {
    if (auth.isLoading) {
      return;
    }
    if (!auth.isAuthenticated) {
      const allowed = auth.requireAuth();
      if (!allowed) {
        return;
      }
    }
    voteMutation.mutate({ prepId, value });
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

  return (
    <section className="page">
      <Link to="/" className="link-button">
        &larr; Back to library
      </Link>

      <div className="book-hero">
        <div className="book-hero__media" aria-hidden={!book.coverImageUrl}>
          {book.coverImageUrl ? (
            <img src={book.coverImageUrl} alt={`${book.title} cover`} loading="lazy" />
          ) : (
            <div className="book-hero__media-placeholder">{book.title.charAt(0).toUpperCase()}</div>
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
        </div>
      </div>

      <section className="preps-section">
        <header className="section-header">
          <div>
            <h2>Prep notes</h2>
            <p>See what veteran readers track while they read this title.</p>
          </div>
          <span>{book.preps.length} prep{book.preps.length === 1 ? "" : "s"}</span>
        </header>

        {book.preps.length === 0 && <p>No preps yet. Be the first to suggest one!</p>}

        <div className="prep-grid">
          {book.preps.map((prep) => (
            <PrepCard
              key={prep.id}
              prep={prep}
              votingDisabled={votingDisabled}
              isVoting={voteMutation.isPending && votingPrepId === prep.id}
              onVote={(value) => handleVote(prep.id, value)}
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
    </section>
  );
}

