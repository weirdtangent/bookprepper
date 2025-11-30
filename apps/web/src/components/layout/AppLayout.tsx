import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { debugLog, isDebugEnabled } from "../../lib/debug";

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

