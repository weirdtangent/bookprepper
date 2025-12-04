import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import type { CatalogStats } from "../../lib/api";
import { debugLog, isDebugEnabled } from "../../lib/debug";

const numberFormatter = new Intl.NumberFormat("en-US");

export function AppLayout() {
  const auth = useAuth();
  debugLog("AppLayout: render", {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    userName: auth.user?.name,
    userEmail: auth.user?.email
  });

  useEffect(() => {
    if (isDebugEnabled()) {
      window.bookprepperLayoutState = {
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        userName: auth.user?.name,
        userEmail: auth.user?.email
      };
      debugLog("AppLayout: state snapshot", window.bookprepperLayoutState);
    } else if (window.bookprepperLayoutState) {
      delete window.bookprepperLayoutState;
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.user?.name, auth.user?.email]);

  const statsQuery = useQuery({
    queryKey: ["catalog-stats"],
    queryFn: () => api.catalogStats(),
    staleTime: 1000 * 60 * 10
  });

  const stats = statsQuery.data;
  const yearRangeLabel = stats ? formatYearRange(stats.years) : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__content">
          <NavLink to="/" className="logo">
            BookPrepper
          </NavLink>
          <nav className="app-nav">
            <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
              Library
            </NavLink>
            <NavLink to="/suggest" className={({ isActive }) => (isActive ? "active" : "")}>
              Suggest a Book
            </NavLink>
            {auth.isAuthenticated && (
              <NavLink to="/config" className={({ isActive }) => (isActive ? "active" : "")}>
                Config
              </NavLink>
            )}
          </nav>
          <div className="app-header__actions">
            {auth.isAuthenticated && (
              <span className="auth-user" aria-live="polite">
                {auth.user?.name ?? auth.user?.email ?? "Signed in"}
              </span>
            )}
            <button
              className="auth-button"
              disabled={auth.isLoading}
              onClick={auth.isAuthenticated ? auth.signOut : auth.signIn}
            >
              {auth.isAuthenticated ? "Sign out" : auth.isLoading ? "Loading..." : "Sign in"}
            </button>
          </div>
        </div>
        <div className="app-header__meta" aria-live="polite">
          <div className="app-header__meta-content">
            {statsQuery.isLoading && <span>Loading library stats…</span>}
            {statsQuery.isError && <span role="status">Library stats unavailable.</span>}
            {stats && !statsQuery.isError && (
              <ul className="library-stats" aria-label="Library statistics">
                <li>
                  <span className="library-stats__value">{numberFormatter.format(stats.books)}</span>
                  <span className="library-stats__label">books</span>
                </li>
                <li>
                  <span className="library-stats__value">{numberFormatter.format(stats.authors)}</span>
                  <span className="library-stats__label">authors</span>
                </li>
                <li>
                  <span className="library-stats__value">{numberFormatter.format(stats.preps)}</span>
                  <span className="library-stats__label">preps logged</span>
                </li>
                {yearRangeLabel && (
                  <li>
                    <span className="library-stats__value">{yearRangeLabel}</span>
                    <span className="library-stats__label">publication range</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>BookPrepper &middot; Prep smarter, read deeper.</p>
      </footer>
    </div>
  );
}

export default AppLayout;

declare global {
  interface Window {
    bookprepperLayoutState?: {
      isAuthenticated: boolean;
      isLoading: boolean;
      userName?: string | null;
      userEmail?: string | null;
    };
  }
}

function formatYearRange(years: CatalogStats["years"]) {
  const { earliest, latest } = years;
  const hasEarliest = typeof earliest === "number";
  const hasLatest = typeof latest === "number";

  if (hasEarliest && hasLatest) {
    return earliest === latest ? `${earliest}` : `${earliest}–${latest}`;
  }

  if (hasEarliest) {
    return `since ${earliest}`;
  }

  if (hasLatest) {
    return `through ${latest}`;
  }

  return null;
}

