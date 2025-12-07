import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ReadingNowPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const readingQuery = useQuery({
    queryKey: ["reading-now"],
    enabled: auth.isAuthenticated && Boolean(auth.token),
    queryFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.listReadingNow(auth.token);
    }
  });

  const finishMutation = useMutation({
    mutationFn: async (slug: string) => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.finishReading({ slug, token: auth.token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reading-now"] });
    }
  });

  const entries = readingQuery.data?.entries ?? [];
  const isEmpty = useMemo(() => entries.length === 0, [entries.length]);

  if (!auth.isAuthenticated) {
    return (
      <section className="page narrow">
        <div className="panel">
          <h1>Reading Now</h1>
          <p>Sign in to track the books you are currently reading.</p>
          <button type="button" className="primary-button" onClick={auth.requireAuth}>
            Sign in
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Reading Now</h1>
          <p>Jump back into books you are tracking and mark them finished when you are done.</p>
        </div>
        <button type="button" className="link-button" onClick={() => readingQuery.refetch()} disabled={readingQuery.isFetching}>
          {readingQuery.isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {readingQuery.isLoading && <p>Loading your reading list...</p>}
      {readingQuery.isError && (
        <p role="alert">We couldn&rsquo;t load your reading list. Please try again.</p>
      )}

      {!readingQuery.isLoading && !readingQuery.isError && isEmpty && (
        <div className="empty-state">
          <p>No books in progress yet. Visit a book page and select &ldquo;Start reading&rdquo; to add one.</p>
        </div>
      )}

      {!readingQuery.isLoading && !readingQuery.isError && !isEmpty && (
        <ul className="reading-list">
          {entries.map((entry) => (
            <li key={entry.id} className="reading-card">
              <div className="reading-card__body">
                <p className="reading-card__eyebrow">
                  Added {new Date(entry.startedAt).toLocaleDateString()}
                </p>
                <h3>{entry.book.title}</h3>
                <p className="reading-card__author">{entry.book.author.name}</p>
                {entry.book.synopsis && <p className="reading-card__synopsis">{entry.book.synopsis}</p>}
                {entry.book.keywords && entry.book.keywords.length > 0 && (
                  <div className="reading-card__keywords">
                    {entry.book.keywords.map((keyword) => (
                      <Link
                        key={keyword.id}
                        className="reading-card__keyword-link"
                        to={`/?prep=${keyword.slug}`}
                      >
                        {keyword.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="reading-card__actions">
                <Link to={`/books/${entry.book.slug}`} className="primary-button">
                  View book
                </Link>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={finishMutation.isPending}
                  onClick={() => finishMutation.mutate(entry.book.slug)}
                >
                  {finishMutation.isPending ? "Updating..." : "Mark finished"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
