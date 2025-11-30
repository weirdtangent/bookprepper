import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
export function AppLayout() {
    const auth = useAuth();
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "app-header", children: _jsxs("div", { className: "app-header__content", children: [_jsx(NavLink, { to: "/", className: "logo", children: "BookPrepper" }), _jsxs("nav", { className: "app-nav", children: [_jsx(NavLink, { to: "/", className: ({ isActive }) => (isActive ? "active" : ""), children: "Library" }), _jsx(NavLink, { to: "/suggest", className: ({ isActive }) => (isActive ? "active" : ""), children: "Suggest a Book" })] }), _jsx("button", { className: "auth-button", onClick: auth.isAuthenticated ? auth.signOut : auth.signIn, children: auth.isAuthenticated ? "Sign out" : "Sign in" })] }) }), _jsx("main", { className: "app-main", children: _jsx(Outlet, {}) }), _jsx("footer", { className: "app-footer", children: _jsx("p", { children: "BookPrepper \u00B7 Prep smarter, read deeper." }) })] }));
}
export default AppLayout;
