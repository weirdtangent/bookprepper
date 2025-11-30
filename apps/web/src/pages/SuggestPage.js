import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
export default function SuggestPage() {
    const auth = useAuth();
    const [title, setTitle] = useState("");
    const [authorName, setAuthorName] = useState("");
    const [notes, setNotes] = useState("");
    const [genreIdeas, setGenreIdeas] = useState("");
    const [prepIdeas, setPrepIdeas] = useState("");
    const suggestionMutation = useMutation({
        mutationFn: async () => {
            if (!auth.token) {
                throw new Error("Authentication required");
            }
            return api.suggestBook({
                title,
                authorName,
                notes: notes || undefined,
                genreIdeas: parseList(genreIdeas),
                prepIdeas: parseList(prepIdeas),
                token: auth.token
            });
        },
        onSuccess: () => {
            setTitle("");
            setAuthorName("");
            setNotes("");
            setGenreIdeas("");
            setPrepIdeas("");
        }
    });
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!auth.isAuthenticated) {
            const allowed = auth.requireAuth();
            if (!allowed) {
                return;
            }
        }
        suggestionMutation.mutate();
    };
    return (_jsxs("section", { className: "page narrow", children: [_jsx("h1", { children: "Nominate a book" }), _jsx("p", { children: "Help us expand the classics list with spoiler-free prep suggestions." }), _jsxs("form", { className: "form", onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Book title", _jsx("input", { required: true, value: title, onChange: (event) => setTitle(event.target.value), placeholder: "Ex: The Buried Giant" })] }), _jsxs("label", { children: ["Author", _jsx("input", { required: true, value: authorName, onChange: (event) => setAuthorName(event.target.value), placeholder: "Ex: Kazuo Ishiguro" })] }), _jsxs("label", { children: ["Why should we add it?", _jsx("textarea", { value: notes, onChange: (event) => setNotes(event.target.value), placeholder: "Share spoiler-free context, themes, or why it belongs here." })] }), _jsxs("label", { children: ["Genre ideas ", _jsx("small", { children: "(comma-separated)" }), _jsx("input", { value: genreIdeas, onChange: (event) => setGenreIdeas(event.target.value), placeholder: "fantasy, literary fiction" })] }), _jsxs("label", { children: ["Prep ideas ", _jsx("small", { children: "(comma-separated)" }), _jsx("input", { value: prepIdeas, onChange: (event) => setPrepIdeas(event.target.value), placeholder: "found family, unreliable memory" })] }), _jsx("button", { type: "submit", disabled: suggestionMutation.isPending, children: suggestionMutation.isPending ? "Submitting..." : "Submit suggestion" }), suggestionMutation.isSuccess && (_jsx("p", { role: "status", className: "success", children: "Thanks! We received your suggestion." })), suggestionMutation.isError && (_jsx("p", { role: "alert", className: "error", children: "Unable to submit your suggestion. Please try again." }))] })] }));
}
function parseList(value) {
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
