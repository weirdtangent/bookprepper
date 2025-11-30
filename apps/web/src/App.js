import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import BookDetailPage from "./pages/BookDetailPage";
import SuggestPage from "./pages/SuggestPage";
export default function App() {
    return (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(AppLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/books/:slug", element: _jsx(BookDetailPage, {}) }), _jsx(Route, { path: "/suggest", element: _jsx(SuggestPage, {}) })] }) }));
}
