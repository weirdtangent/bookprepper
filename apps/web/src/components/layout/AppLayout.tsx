import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export function AppLayout() {
  const auth = useAuth();

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
          <button
            className="auth-button"
            disabled={auth.isLoading}
            onClick={auth.isAuthenticated ? auth.signOut : auth.signIn}
          >
            {auth.isAuthenticated ? "Sign out" : auth.isLoading ? "Loading..." : "Sign in"}
          </button>
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

