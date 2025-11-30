import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { BookCard } from "../components/books/BookCard";
import { useDebounce } from "../hooks/useDebounce";
const PAGE_SIZE = 12;
export default function HomePage() {
    const [search, setSearch] = useState("");
    const [authorSlug, setAuthorSlug] = useState("");
    const [genreFilters, setGenreFilters] = useState([]);
    const [prepFilters, setPrepFilters] = useState([]);
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search, 350);
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, authorSlug, genreFilters, prepFilters]);
    const genresQuery = useQuery({
        queryKey: ["genres"],
        queryFn: () => api.listGenres()
    });
    const authorsQuery = useQuery({
        queryKey: ["authors"],
        queryFn: () => api.listAuthors()
    });
    const keywordsQuery = useQuery({
        queryKey: ["prep-keywords"],
        queryFn: () => api.listPrepKeywords()
    });
    const booksQuery = useQuery({
        queryKey: ["books", { debouncedSearch, authorSlug, genreFilters, prepFilters, page }],
        queryFn: ({ signal }) => api.listBooks({
            search: debouncedSearch || undefined,
            author: authorSlug || undefined,
            genres: genreFilters,
            prep: prepFilters,
            page,
            pageSize: PAGE_SIZE
        }, signal),
        placeholderData: keepPreviousData
    });
    const toggleFilter = (value, setter) => {
        setter((current) => {
            const alreadySelected = current.includes(value);
            if (alreadySelected) {
                return current.filter((item) => item !== value);
            }
            return [...current, value];
        });
    };
    const hasResults = (booksQuery.data?.results.length ?? 0) > 0;
    const totalPages = booksQuery.data?.pagination.totalPages ?? 1;
    const selectedFilterCount = genreFilters.length + prepFilters.length + (authorSlug ? 1 : 0);
    const canGoBack = page > 1;
    const canGoForward = page < totalPages;
    const keywords = useMemo(() => keywordsQuery.data?.keywords ?? [], [keywordsQuery.data]);
    const genres = useMemo(() => genresQuery.data?.genres ?? [], [genresQuery.data]);
    const authors = useMemo(() => authorsQuery.data?.authors ?? [], [authorsQuery.data]);
    const resetFilters = () => {
        setGenreFilters([]);
        setPrepFilters([]);
        setAuthorSlug("");
        setSearch("");
    };
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "page-header", children: [_jsxs("div", { children: [_jsx("h1", { children: "Prep your next reading adventure" }), _jsx("p", { children: "Browse curated classics, filter by genre or prep keyword, and see what other readers watch for before they start." })] }), selectedFilterCount > 0 && (_jsxs("button", { className: "link-button", onClick: resetFilters, children: ["Clear ", selectedFilterCount, " filter", selectedFilterCount === 1 ? "" : "s"] }))] }), _jsxs("section", { className: "filters-panel", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "search", children: "Search the library" }), _jsx("input", { id: "search", type: "search", placeholder: "Search by title, synopsis, or author", value: search, onChange: (event) => setSearch(event.target.value) })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "author", children: "Author" }), _jsxs("select", { id: "author", value: authorSlug, onChange: (event) => setAuthorSlug(event.target.value), children: [_jsx("option", { value: "", children: "All authors" }), authors.map((author) => (_jsxs("option", { value: author.slug, children: [author.name, " (", author.bookCount, ")"] }, author.id)))] })] }), _jsxs("div", { className: "filter-group", children: [_jsxs("div", { className: "filter-group__header", children: [_jsx("span", { children: "Genres" }), _jsxs("small", { children: [genreFilters.length, " selected"] })] }), _jsx("div", { className: "chip-grid", children: genres.map((genre) => {
                                    const isSelected = genreFilters.includes(genre.slug);
                                    return (_jsx("button", { type: "button", className: `chip ${isSelected ? "chip--selected" : ""}`, onClick: () => toggleFilter(genre.slug, setGenreFilters), children: genre.name }, genre.id));
                                }) })] }), _jsxs("div", { className: "filter-group", children: [_jsxs("div", { className: "filter-group__header", children: [_jsx("span", { children: "Prep keywords" }), _jsxs("small", { children: [prepFilters.length, " selected"] })] }), _jsx("div", { className: "chip-grid", children: keywords.map((keyword) => {
                                    const isSelected = prepFilters.includes(keyword.slug);
                                    return (_jsx("button", { type: "button", className: `chip ${isSelected ? "chip--selected" : ""}`, title: keyword.description ?? undefined, onClick: () => toggleFilter(keyword.slug, setPrepFilters), children: keyword.name }, keyword.id));
                                }) })] })] }), _jsxs("section", { className: "results-panel", children: [booksQuery.isLoading && _jsx("p", { children: "Loading books..." }), booksQuery.isError && (_jsx("p", { role: "alert", children: "Something went wrong while loading books. Please try again." })), !booksQuery.isLoading && hasResults && (_jsxs(_Fragment, { children: [_jsx("div", { className: "book-grid", children: booksQuery.data?.results.map((book) => (_jsx(BookCard, { book: book }, book.id))) }), _jsxs("div", { className: "pagination", children: [_jsx("button", { disabled: !canGoBack, onClick: () => canGoBack && setPage((p) => p - 1), children: "Previous" }), _jsxs("span", { children: ["Page ", booksQuery.data?.pagination.page, " of ", totalPages] }), _jsx("button", { disabled: !canGoForward, onClick: () => canGoForward && setPage((p) => p + 1), children: "Next" })] })] })), !booksQuery.isLoading && !hasResults && (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No books match these filters yet. Try removing a filter or submit a new suggestion." }) }))] })] }));
}
