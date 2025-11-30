import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PrepCard } from "../components/preps/PrepCard";
import { useAuth } from "../lib/auth";
export default function BookDetailPage() {
    const { slug = "" } = useParams();
    const auth = useAuth();
    const queryClient = useQueryClient();
    const [prepTitle, setPrepTitle] = useState("");
    const [prepDescription, setPrepDescription] = useState("");
    const [prepKeywords, setPrepKeywords] = useState("");
    useEffect(() => {
        setPrepTitle("");
        setPrepDescription("");
        setPrepKeywords("");
    }, [slug]);
    const bookQuery = useQuery({
        queryKey: ["book", slug],
        queryFn: ({ signal }) => api.getBook(slug, signal),
        enabled: Boolean(slug)
    });
    const voteMutation = useMutation({
        mutationFn: async ({ prepId, value }) => {
            if (!auth.token) {
                throw new Error("Authentication required");
            }
            return api.voteOnPrep({ slug, prepId, value, token: auth.token });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["book", slug] });
        }
    });
    const suggestPrepMutation = useMutation({
        mutationFn: async () => {
            if (!auth.token) {
                throw new Error("Authentication required");
            }
            return api.suggestPrep({
                slug,
                title: prepTitle,
                description: prepDescription,
                keywordHints: prepKeywords
                    .split(",")
                    .map((keyword) => keyword.trim())
                    .filter(Boolean),
                token: auth.token
            });
        },
        onSuccess: () => {
            setPrepTitle("");
            setPrepDescription("");
            setPrepKeywords("");
        }
    });
    const handleVote = (prepId, value) => {
        if (!auth.isAuthenticated) {
            const allowed = auth.requireAuth();
            if (!allowed) {
                return;
            }
        }
        voteMutation.mutate({ prepId, value });
    };
    const handleSuggestPrep = (event) => {
        event.preventDefault();
        if (!auth.isAuthenticated) {
            const allowed = auth.requireAuth();
            if (!allowed) {
                return;
            }
        }
        suggestPrepMutation.mutate();
    };
    if (bookQuery.isLoading) {
        return (_jsx("section", { className: "page", children: _jsx("p", { children: "Loading book..." }) }));
    }
    if (bookQuery.isError || !bookQuery.data) {
        return (_jsxs("section", { className: "page", children: [_jsx("p", { role: "alert", children: "We couldn\u2019t load this book. Please try again." }), _jsx(Link, { to: "/", className: "link-button", children: "Back to library" })] }));
    }
    const book = bookQuery.data;
    const votingDisabled = !auth.isAuthenticated;
    const votingPrepId = voteMutation.variables?.prepId;
    return (_jsxs("section", { className: "page", children: [_jsx(Link, { to: "/", className: "link-button", children: "\u2190 Back to library" }), _jsxs("div", { className: "book-hero", children: [_jsxs("div", { children: [_jsx("p", { className: "book-hero__eyebrow", children: book.author.name }), _jsx("h1", { children: book.title }), book.synopsis && _jsx("p", { children: book.synopsis })] }), _jsxs("div", { className: "book-hero__meta", children: [_jsx("h4", { children: "Genres" }), _jsx("div", { className: "chip-grid", children: book.genres.map((genre) => (_jsx("span", { className: "chip chip--static", children: genre.name }, genre.id))) })] })] }), _jsxs("section", { className: "preps-section", children: [_jsxs("header", { className: "section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Prep notes" }), _jsx("p", { children: "See what veteran readers track while they read this title." })] }), _jsxs("span", { children: [book.preps.length, " prep", book.preps.length === 1 ? "" : "s"] })] }), book.preps.length === 0 && _jsx("p", { children: "No preps yet. Be the first to suggest one!" }), _jsx("div", { className: "prep-grid", children: book.preps.map((prep) => (_jsx(PrepCard, { prep: prep, votingDisabled: votingDisabled, isVoting: voteMutation.isPending && votingPrepId === prep.id, onVote: (value) => handleVote(prep.id, value) }, prep.id))) })] }), _jsxs("section", { className: "panel", children: [_jsx("h3", { children: "Suggest another prep" }), _jsx("p", { children: "Add the themes, motifs, or signals you track for this book." }), _jsxs("form", { className: "form", onSubmit: handleSuggestPrep, children: [_jsxs("label", { children: ["Prep title", _jsx("input", { required: true, minLength: 3, value: prepTitle, onChange: (event) => setPrepTitle(event.target.value), placeholder: "Ex: Trace colonial pressure points" })] }), _jsxs("label", { children: ["Details", _jsx("textarea", { required: true, minLength: 10, value: prepDescription, onChange: (event) => setPrepDescription(event.target.value), placeholder: "Describe what to watch for without spoiling the plot." })] }), _jsxs("label", { children: ["Keyword hints", _jsx("input", { value: prepKeywords, onChange: (event) => setPrepKeywords(event.target.value), placeholder: "Comma-separated keywords (optional)" })] }), _jsx("button", { type: "submit", disabled: suggestPrepMutation.isPending, children: suggestPrepMutation.isPending ? "Submitting..." : "Submit prep suggestion" })] })] })] }));
}
