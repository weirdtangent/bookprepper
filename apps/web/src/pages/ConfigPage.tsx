import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useTheme } from "../hooks/useTheme";
import { debugLog, isDebugEnabled } from "../lib/debug";
import { api, type PromptFeedbackInsights, type PromptVoteSummary } from "../lib/api";
import { getPromptFeedbackLabel } from "../lib/promptFeedback";

export default function ConfigPage() {
  const auth = useAuth();
  const { isAuthenticated, isLoading, requireAuth } = auth;
  const [theme, toggleTheme] = useTheme();
  const [nickname, setNickname] = useState(auth.user?.name ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shuffleDefault, setShuffleDefault] = useState(auth.preferences.shuffleDefault ?? true);
  const [shuffleStatus, setShuffleStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [shuffleError, setShuffleError] = useState<string | null>(null);
  const insightsQuery = useQuery({
    queryKey: ["prompt-feedback-insights"],
    enabled: auth.isAdmin && Boolean(auth.token),
    queryFn: async () => {
      if (!auth.token) {
        throw new Error("Authentication required");
      }
      return api.getPromptFeedbackInsights(auth.token);
    }
  });

  debugLog("ConfigPage: render", {
    isAuthenticated,
    isLoading,
    nickname,
    status,
    theme,
    shuffleDefault,
    shuffleStatus
  });

  useEffect(() => {
    setNickname(auth.user?.name ?? "");
  }, [auth.user?.name]);

  useEffect(() => {
    setShuffleDefault(auth.preferences.shuffleDefault ?? true);
  }, [auth.preferences.shuffleDefault]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      requireAuth();
    }
  }, [isLoading, isAuthenticated, requireAuth]);

  const isDisabled = useMemo(() => isLoading || !isAuthenticated || status === "saving", [
    isLoading,
    isAuthenticated,
    status
  ]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      await auth.updateNickname(nickname.trim());
      setStatus("success");
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Failed to update nickname";
      setError(message);
    }
  };

  const handleShuffleToggle = async (checked: boolean) => {
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    setShuffleStatus("saving");
    setShuffleError(null);
    try {
      await auth.updatePreferences({ shuffleDefault: checked });
      setShuffleDefault(checked);
      setShuffleStatus("success");
    } catch (err) {
      setShuffleStatus("error");
      const message =
        err instanceof Error ? err.message : "Failed to update shuffle preference. Please try again.";
      setShuffleError(message);
    }
  };

  useEffect(() => {
    if (isDebugEnabled()) {
      window.bookprepperConfigState = {
        isAuthenticated,
        isLoading,
        nickname,
        status,
        theme
      };
      debugLog("ConfigPage: state snapshot", window.bookprepperConfigState);
    } else if (window.bookprepperConfigState) {
      delete window.bookprepperConfigState;
    }
  }, [isAuthenticated, isLoading, nickname, status, theme]);

  const formatVoteSummary = (votes: PromptVoteSummary) => {
    const scorePercent = Math.round(((votes.score + 1) / 2) * 100);
    return `${scorePercent}% score · ${votes.total} votes`;
  };

  const renderInsightList = (title: string, items: PromptFeedbackInsights["topPrompts"]) => (
    <div className="config-insight-block">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="helper-text">No feedback captured yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.prepId}>
              <p className="insight-book">
                <strong>{item.book.title}</strong>
              </p>
              <p className="insight-heading">{item.heading}</p>
              <small>{formatVoteSummary(item.votes)}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="page narrow">
      <h1>Reader Preferences</h1>

      <form className="panel config-form" onSubmit={handleSubmit}>
        <div className="config-field">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="How should we address you?"
            disabled={auth.isLoading || !auth.isAuthenticated}
          />
          <p className="helper-text">This name appears in the header after you sign in.</p>
        </div>
        <button type="submit" className="primary-button" disabled={isDisabled}>
          {status === "saving" ? "Saving..." : "Save nickname"}
        </button>
        {status === "success" && <p className="success-text">Nickname updated.</p>}
        {status === "error" && error && <p className="error-text">{error}</p>}
      </form>

      <section className="panel config-theme">
        <h2>Appearance</h2>
        <label className="theme-toggle">
          <input type="checkbox" checked={theme === "dark"} onChange={toggleTheme} />
          <span>{theme === "dark" ? "Dark mode enabled" : "Dark mode disabled"}</span>
        </label>
      </section>

      <section className="panel config-preferences">
        <h2>Library defaults</h2>
        <label className="theme-toggle">
          <input
            type="checkbox"
            checked={shuffleDefault}
            onChange={(event) => handleShuffleToggle(event.target.checked)}
            disabled={shuffleStatus === "saving"}
          />
          <span>
            {shuffleDefault
              ? "Shuffle view enabled by default"
              : "Shuffle view disabled by default"}
          </span>
        </label>
        <p className="helper-text">
          This controls whether the Library page starts with randomized book picks or alphabetical
          results after you sign in.
        </p>
        {shuffleStatus === "success" && (
          <p className="success-text">Shuffle preference updated.</p>
        )}
        {shuffleStatus === "error" && shuffleError && (
          <p className="error-text" role="alert">
            {shuffleError}
          </p>
        )}
      </section>

      {auth.isAdmin && (
        <section className="panel config-feedback">
          <h2>Prompt feedback trends</h2>
          {insightsQuery.isLoading && <p>Loading feedback insights...</p>}
          {insightsQuery.isError && (
            <p className="error-text" role="alert">
              {insightsQuery.error instanceof Error
                ? insightsQuery.error.message
                : "Unable to load feedback insights."}
            </p>
          )}
          {insightsQuery.data && (
            <>
              <div className="insight-grid">
                {renderInsightList("Top prompts", insightsQuery.data.topPrompts)}
                {renderInsightList("Needs attention", insightsQuery.data.needsAttention)}
              </div>
              <div className="recent-feedback">
                <h3>Recent notes</h3>
                {insightsQuery.data.recentFeedback.length === 0 ? (
                  <p className="helper-text">No curator notes yet.</p>
                ) : (
                  <ul>
                    {insightsQuery.data.recentFeedback.map((entry) => (
                      <li key={entry.id}>
                        <p>
                          <strong>{entry.book.title}</strong> · {entry.prep.heading}
                        </p>
                        <small>
                          {getPromptFeedbackLabel(entry.dimension)} · {entry.value.toLowerCase()} ·{" "}
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </small>
                        {entry.note && <p className="insight-note">{entry.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

declare global {
  interface Window {
    bookprepperConfigState?: {
      isAuthenticated: boolean;
      isLoading: boolean;
      nickname: string;
      status: "idle" | "saving" | "success" | "error";
      theme: string;
    };
  }
}

