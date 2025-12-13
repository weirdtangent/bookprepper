import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tab = "reading" | "finished";

export default function MyBooksPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("reading");

  const readingQuery = useQuery({
    queryKey: ["reading-now"],
    enabled: auth.isAuthenticated && Boolean(auth.token),
    queryFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.listReadingNow(auth.token);
    },
  });

  const finishedQuery = useQuery({
    queryKey: ["finished-books"],
    enabled: auth.isAuthenticated && Boolean(auth.token),
    queryFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.listFinishedBooks(auth.token);
    },
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
      queryClient.invalidateQueries({ queryKey: ["finished-books"] });
    },
  });

  const readingEntries = readingQuery.data?.entries ?? [];
  const finishedEntries = finishedQuery.data?.entries ?? [];

  const currentEntries = activeTab === "reading" ? readingEntries : finishedEntries;
  const currentQuery = activeTab === "reading" ? readingQuery : finishedQuery;
  const isEmpty = useMemo(() => currentEntries.length === 0, [currentEntries.length]);

  if (!auth.isAuthenticated) {
    return (
      <section className="page narrow">
        <div className="panel">
          <h1>My Books</h1>
          <p>Sign in to track the books you are reading and have finished.</p>
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
          <h1>My Books</h1>
          <p>Track your reading journey and revisit books you have finished.</p>
        </div>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            readingQuery.refetch();
            finishedQuery.refetch();
          }}
          disabled={readingQuery.isFetching || finishedQuery.isFetching}
        >
          {readingQuery.isFetching || finishedQuery.isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === "reading" ? "tab--active" : ""}`}
          onClick={() => setActiveTab("reading")}
        >
          Reading
          {readingEntries.length > 0 && (
            <span className="tab__count">{readingEntries.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "finished" ? "tab--active" : ""}`}
          onClick={() => setActiveTab("finished")}
        >
          Finished
          {finishedEntries.length > 0 && (
            <span className="tab__count">{finishedEntries.length}</span>
          )}
        </button>
      </div>

      {currentQuery.isLoading && <p>Loading your books...</p>}
      {currentQuery.isError && (
        <p role="alert">We couldn&rsquo;t load your books. Please try again.</p>
      )}

      {!currentQuery.isLoading && !currentQuery.isError && isEmpty && (
        <div className="empty-state">
          {activeTab === "reading" ? (
            <p>
              No books in progress yet. Visit a book page and select &ldquo;Start reading&rdquo; to
              add one.
            </p>
          ) : (
            <p>
              No finished books yet. Mark a book as finished when you complete it.
            </p>
          )}
        </div>
      )}

      {!currentQuery.isLoading && !currentQuery.isError && !isEmpty && (
        <ul className="reading-list">
          {currentEntries.map((entry) => (
            <li key={entry.id} className="reading-card">
              <div className="reading-card__body">
                <p className="reading-card__eyebrow">
                  {activeTab === "reading"
                    ? `Started ${new Date(entry.startedAt).toLocaleDateString()}`
                    : `Finished ${new Date(entry.updatedAt).toLocaleDateString()}`}
                </p>
                <h3>{entry.book.title}</h3>
                <p className="reading-card__author">{entry.book.author.name}</p>
                {entry.book.synopsis && (
                  <p className="reading-card__synopsis">{entry.book.synopsis}</p>
                )}
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
                {activeTab === "reading" && (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={finishMutation.isPending}
                    onClick={() => finishMutation.mutate(entry.book.slug)}
                  >
                    {finishMutation.isPending ? "Updating..." : "Mark finished"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
