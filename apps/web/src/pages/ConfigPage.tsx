import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../hooks/useTheme";

export default function ConfigPage() {
  const auth = useAuth();
  const { isAuthenticated, isLoading, requireAuth } = auth;
  const [theme, toggleTheme] = useTheme();
  const [nickname, setNickname] = useState(auth.user?.name ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(auth.user?.name ?? "");
  }, [auth.user?.name]);

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
    </div>
  );
}

