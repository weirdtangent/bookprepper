import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Link } from "react-router-dom";
export function BookCard({ book }) {
    return (_jsxs(Link, { to: `/books/${book.slug}`, className: "book-card", children: [_jsxs("div", { className: "book-card__body", children: [_jsxs("p", { className: "book-card__eyebrow", children: [book.author.name, " \u00B7 ", book.prepCount, " prep", book.prepCount === 1 ? "" : "s"] }), _jsx("h3", { children: book.title }), book.synopsis && _jsx("p", { className: "book-card__synopsis", children: book.synopsis })] }), _jsx("div", { className: "book-card__tags", children: book.genres.map((genre) => (_jsx("span", { children: genre.name }, genre.id))) })] }));
}
