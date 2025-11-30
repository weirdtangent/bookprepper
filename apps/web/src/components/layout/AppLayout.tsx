import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../hooks/useTheme";

export function AppLayout() {
  const auth = useAuth();
  const [theme, toggleTheme] = useTheme();

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
          </nav>
          <div className="app-header__actions">
            <label className="theme-toggle">
              <input type="checkbox" checked={theme === "dark"} onChange={toggleTheme} />
              <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
            </label>
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

