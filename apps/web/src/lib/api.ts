import { config } from "./config";

// Re-export all shared types for convenience
export type {
  Pagination,
  Author,
  Genre,
  Keyword,
  PromptFeedbackDimension,
  PromptVoteDimensionBreakdown,
  PromptVoteSummary,
  QuoteVotes,
  PrepQuote,
  GoogleBooksSearchResult,
  Prep,
  BookSummary,
  BookDetail,
  BookListResponse,
  CatalogStats,
  UserPreferences,
  UserProfile,
  ReadingEntry,
  AdminBookListItem,
  AdminPrepDetail,
  AdminBookDetail,
  PromptInsightSummary,
  PromptFeedbackInsights,
  AdminCreateBookInput,
  AdminUpdateBookInput,
  AdminPrepInput,
  SubmittedBySummary,
  AdminMetadataSuggestion,
  AdminPrepSuggestion,
  AdminBookSuggestion,
  BookQueryParams,
} from "types";

import type {
  Pagination,
  Genre,
  Keyword,
  Author,
  PromptFeedbackDimension,
  Prep,
  BookDetail,
  BookListResponse,
  BookQueryParams,
  CatalogStats,
  UserPreferences,
  UserProfile,
  ReadingEntry,
  AdminBookListItem,
  AdminPrepDetail,
  AdminBookDetail,
  PromptFeedbackInsights,
  AdminCreateBookInput,
  AdminUpdateBookInput,
  AdminPrepInput,
  AdminMetadataSuggestion,
  AdminPrepSuggestion,
  AdminBookSuggestion,
  PrepQuote,
  QuoteVotes,
  GoogleBooksSearchResult,
} from "types";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  query?: Record<string, string | number | (string | number)[] | undefined>;
};

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, config.apiBaseUrl);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        if (value.length > 0) {
          url.searchParams.set(key, value.join(","));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const hasBody = options.body !== undefined;

  const headers = new Headers({
    Accept: "application/json",
  });

  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request to ${path} failed`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  listBooks: (params: BookQueryParams, signal?: AbortSignal) =>
    apiFetch<BookListResponse>("/api/books", {
      query: {
        search: params.search,
        author: params.author,
        genres: params.genres,
        prep: params.prep,
        page: params.page,
        pageSize: params.pageSize,
        shuffle: params.shuffle ? "true" : undefined,
      },
      signal,
    }),
  getBook: (slug: string, signal?: AbortSignal) =>
    apiFetch<BookDetail>(`/api/books/${slug}`, { signal }),
  listGenres: () => apiFetch<{ genres: Genre[] }>("/api/genres"),
  listAuthors: () => apiFetch<{ authors: Author[] }>("/api/authors"),
  listPrepKeywords: () => apiFetch<{ keywords: Keyword[] }>("/api/preps/keywords"),
  voteOnPrep: (params: {
    slug: string;
    prepId: string;
    value: "AGREE" | "DISAGREE";
    dimension: PromptFeedbackDimension;
    note?: string;
    token: string;
  }) =>
    apiFetch<{ prepId: string; votes: Prep["votes"] }>(
      `/api/books/${params.slug}/preps/${params.prepId}/vote`,
      {
        method: "POST",
        body: {
          value: params.value,
          dimension: params.dimension,
          note: params.note,
        },
        token: params.token,
      }
    ),
  suggestPrep: (params: {
    slug: string;
    title: string;
    description: string;
    keywordHints?: string[];
    token: string;
  }) =>
    apiFetch<{ suggestionId: string }>(`/api/books/${params.slug}/preps/suggest`, {
      method: "POST",
      body: {
        title: params.title,
        description: params.description,
        keywordHints: params.keywordHints,
      },
      token: params.token,
    }),
  suggestBook: (params: {
    title: string;
    authorName: string;
    notes?: string;
    genreIdeas?: string[];
    prepIdeas?: string[];
    token: string;
  }) =>
    apiFetch<{ suggestionId: string }>(`/api/suggestions/books`, {
      method: "POST",
      body: {
        title: params.title,
        authorName: params.authorName,
        notes: params.notes,
        genreIdeas: params.genreIdeas,
        prepIdeas: params.prepIdeas,
      },
      token: params.token,
    }),
  suggestBookMetadata: (params: {
    slug: string;
    synopsis?: string;
    genres?: string[];
    token: string;
  }) =>
    apiFetch<{ suggestionId: string }>(`/api/books/${params.slug}/metadata/suggest`, {
      method: "POST",
      body: {
        synopsis: params.synopsis,
        genres: params.genres,
      },
      token: params.token,
    }),
  catalogStats: () => apiFetch<CatalogStats>("/api/stats"),
  adminListBooks: (params: { search?: string; page?: number; pageSize?: number; token: string }) =>
    apiFetch<{ pagination: Pagination; results: AdminBookListItem[] }>("/api/admin/books", {
      query: {
        search: params.search,
        page: params.page,
        pageSize: params.pageSize,
      },
      token: params.token,
    }),
  adminGetBook: (slug: string, token: string) =>
    apiFetch<{ book: AdminBookDetail }>(`/api/admin/books/${slug}`, {
      token,
    }),
  adminCreateBook: (payload: AdminCreateBookInput, token: string) =>
    apiFetch<{ book: AdminBookDetail }>(`/api/admin/books`, {
      method: "POST",
      body: payload,
      token,
    }),
  adminUpdateBook: (slug: string, payload: AdminUpdateBookInput, token: string) =>
    apiFetch<{ book: AdminBookDetail }>(`/api/admin/books/${slug}`, {
      method: "PATCH",
      body: payload,
      token,
    }),
  adminCreatePrep: (params: { slug: string; body: AdminPrepInput; token: string }) =>
    apiFetch<{ prep: AdminPrepDetail }>(`/api/admin/books/${params.slug}/preps`, {
      method: "POST",
      body: params.body,
      token: params.token,
    }),
  adminUpdatePrep: (params: {
    slug: string;
    prepId: string;
    token: string;
    body: AdminPrepInput;
  }) =>
    apiFetch<{ prep: AdminPrepDetail }>(`/api/admin/books/${params.slug}/preps/${params.prepId}`, {
      method: "PUT",
      body: params.body,
      token: params.token,
    }),
  adminDeletePrep: (params: { slug: string; prepId: string; token: string }) =>
    apiFetch<{ message: string }>(`/api/admin/books/${params.slug}/preps/${params.prepId}`, {
      method: "DELETE",
      token: params.token,
    }),
  adminListMetadataSuggestions: (token: string) =>
    apiFetch<{ suggestions: AdminMetadataSuggestion[] }>("/api/admin/suggestions/metadata", {
      token,
    }),
  adminApproveMetadataSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/metadata/${params.id}/approve`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token,
      }
    ),
  adminRejectMetadataSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/metadata/${params.id}/reject`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token,
      }
    ),
  adminListPrepSuggestions: (token: string) =>
    apiFetch<{ suggestions: AdminPrepSuggestion[] }>("/api/admin/suggestions/preps", {
      token,
    }),
  adminApprovePrepSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ prep: AdminPrepDetail }>(`/api/admin/suggestions/preps/${params.id}/approve`, {
      method: "POST",
      body: { note: params.note },
      token: params.token,
    }),
  adminRejectPrepSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/preps/${params.id}/reject`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token,
      }
    ),
  adminListBookSuggestions: (token: string) =>
    apiFetch<{ suggestions: AdminBookSuggestion[] }>(`/api/admin/suggestions/books`, {
      token,
    }),
  adminApproveBookSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ book: { id: string; slug: string; title: string } }>(
      `/api/admin/suggestions/books/${params.id}/approve`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token,
      }
    ),
  adminRejectBookSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/books/${params.id}/reject`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token,
      }
    ),
  getProfile: (token: string) =>
    apiFetch<{ profile: UserProfile }>("/api/profile", {
      token,
    }),
  updateProfile: (params: {
    token: string;
    displayName?: string;
    preferences?: Partial<UserPreferences>;
  }) => {
    const body: Record<string, unknown> = {};
    if (params.displayName) {
      body.displayName = params.displayName;
    }
    if (params.preferences) {
      body.preferences = params.preferences;
    }
    if (Object.keys(body).length === 0) {
      throw new Error("No profile fields provided");
    }

    return apiFetch<{ profile: UserProfile }>("/api/profile", {
      method: "PATCH",
      body,
      token: params.token,
    });
  },
  getPromptFeedbackInsights: (token: string) =>
    apiFetch<PromptFeedbackInsights>("/api/preps/feedback/insights", {
      token,
    }),
  listReadingNow: (token: string) =>
    apiFetch<{ entries: ReadingEntry[] }>("/api/reading", {
      token,
    }),
  startReading: (params: { slug: string; token: string; status?: "READING" | "DONE" }) =>
    apiFetch<{ id: string; status: "READING" | "DONE"; updatedAt: string }>(
      `/api/books/${params.slug}/reading`,
      {
        method: "POST",
        token: params.token,
        body: params.status ? { status: params.status } : undefined,
      }
    ),
  finishReading: (params: { slug: string; token: string }) =>
    apiFetch<{ id: string; status: "READING" | "DONE"; updatedAt: string }>(
      `/api/books/${params.slug}/reading`,
      {
        method: "DELETE",
        token: params.token,
      }
    ),
  listPrepQuotes: (params: { slug: string; prepId: string }) =>
    apiFetch<{ quotes: PrepQuote[] }>(`/api/books/${params.slug}/preps/${params.prepId}/quotes`),
  createPrepQuote: (params: {
    slug: string;
    prepId: string;
    text: string;
    pageNumber?: string;
    chapter?: string;
    token: string;
  }) =>
    apiFetch<{ quote: PrepQuote }>(`/api/books/${params.slug}/preps/${params.prepId}/quotes`, {
      method: "POST",
      body: {
        text: params.text,
        pageNumber: params.pageNumber,
        chapter: params.chapter,
      },
      token: params.token,
    }),
  deletePrepQuote: (params: { slug: string; prepId: string; quoteId: string; token: string }) =>
    apiFetch<{ message: string }>(
      `/api/books/${params.slug}/preps/${params.prepId}/quotes/${params.quoteId}`,
      {
        method: "DELETE",
        token: params.token,
      }
    ),
  voteOnQuote: (params: {
    slug: string;
    prepId: string;
    quoteId: string;
    value: "AGREE" | "DISAGREE";
    token: string;
  }) =>
    apiFetch<{ quoteId: string; votes: QuoteVotes }>(
      `/api/books/${params.slug}/preps/${params.prepId}/quotes/${params.quoteId}/vote`,
      {
        method: "POST",
        body: { value: params.value },
        token: params.token,
      }
    ),
  searchQuotes: (params: { text: string; bookTitle?: string; authorName?: string }) =>
    apiFetch<{ found: boolean; results: GoogleBooksSearchResult[] }>("/api/quotes/search", {
      query: {
        text: params.text,
        bookTitle: params.bookTitle,
        authorName: params.authorName,
      },
    }),
};
