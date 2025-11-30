import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function SuggestPage() {
  const auth = useAuth();
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [notes, setNotes] = useState("");
  const [genreIdeas, setGenreIdeas] = useState("");
  const [prepIdeas, setPrepIdeas] = useState("");

  const suggestionMutation = useMutation({
    mutationFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.suggestBook({
        title,
        authorName,
        notes: notes || undefined,
        genreIdeas: parseList(genreIdeas),
        prepIdeas: parseList(prepIdeas),
        token: auth.token
      });
    },
    onSuccess: () => {
      setTitle("");
      setAuthorName("");
      setNotes("");
      setGenreIdeas("");
      setPrepIdeas("");
    }
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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
    suggestionMutation.mutate();
  };

  return (
    <section className="page narrow">
      <h1>Nominate a book</h1>
      <p>Help us expand the classics list with spoiler-free prep suggestions.</p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Book title
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: The Buried Giant"
          />
        </label>

        <label>
          Author
          <input
            required
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Ex: Kazuo Ishiguro"
          />
        </label>

        <label>
          Why should we add it?
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Share spoiler-free context, themes, or why it belongs here."
          />
        </label>

        <label>
          Genre ideas <small>(comma-separated)</small>
          <input
            value={genreIdeas}
            onChange={(event) => setGenreIdeas(event.target.value)}
            placeholder="fantasy, literary fiction"
          />
        </label>

        <label>
          Prep ideas <small>(comma-separated)</small>
          <input
            value={prepIdeas}
            onChange={(event) => setPrepIdeas(event.target.value)}
            placeholder="found family, unreliable memory"
          />
        </label>

        <button type="submit" disabled={suggestionMutation.isPending}>
          {suggestionMutation.isPending ? "Submitting..." : "Submit suggestion"}
        </button>
        {suggestionMutation.isSuccess && (
          <p role="status" className="success">
            Thanks! We received your suggestion.
          </p>
        )}
        {suggestionMutation.isError && (
          <p role="alert" className="error">
            Unable to submit your suggestion. Please try again.
          </p>
        )}
      </form>
    </section>
  );
}

function parseList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

