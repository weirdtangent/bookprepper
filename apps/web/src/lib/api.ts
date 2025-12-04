import { config } from "./config";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  query?: Record<string, string | number | (string | number)[] | undefined>;
};

export type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type BookSummary = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  coverImageUrl: string | null;
  author: {
    name: string;
    slug: string;
  };
  genres: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  prepCount: number;
};

export type BookListResponse = {
  pagination: Pagination;
  results: BookSummary[];
};

export type Prep = {
  id: string;
  heading: string;
  summary: string;
  watchFor: string | null;
  colorHint: string | null;
  keywords: Array<{
    slug: string;
    name: string;
  }>;
  votes: {
    agree: number;
    disagree: number;
  };
};

export type BookDetail = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  coverImageUrl: string | null;
  author: {
    id: string;
    name: string;
    slug: string;
  };
  genres: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  preps: Prep[];
};

export type Keyword = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type Genre = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type Author = {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  bookCount: number;
};

export type CatalogStats = {
  books: number;
  authors: number;
  preps: number;
  years: {
    earliest: number | null;
    latest: number | null;
  };
};

export type BookQueryParams = {
  search?: string;
  author?: string;
  genres?: string[];
  prep?: string[];
  page?: number;
  pageSize?: number;
};

export type AdminBookListItem = {
  id: string;
  slug: string;
  title: string;
  author: {
    id: string;
    name: string;
  };
  synopsis: string | null;
  prepCount: number;
  updatedAt: string;
};

export type AdminPrepDetail = {
  id: string;
  heading: string;
  summary: string;
  watchFor: string | null;
  colorHint: string | null;
  keywords: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  votes: Prep["votes"];
  updatedAt: string;
};

export type AdminBookDetail = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  synopsis: string | null;
  coverImageUrl: string | null;
  publishedYear: number | null;
  author: {
    id: string;
    name: string;
    slug: string;
  };
  genres: Genre[];
  preps: AdminPrepDetail[];
  updatedAt: string;
};

export type AdminCreateBookInput = {
  title: string;
  subtitle?: string;
  slug?: string;
  synopsis?: string;
  coverImageUrl?: string;
  publishedYear?: number | null;
  authorId?: string;
  authorName?: string;
  genreIds?: string[];
};

export type AdminUpdateBookInput = {
  title?: string;
  subtitle?: string | null;
  synopsis?: string | null;
  coverImageUrl?: string | null;
  publishedYear?: number | null;
  genreIds?: string[];
};

export type AdminPrepInput = {
  heading: string;
  summary: string;
  watchFor?: string | null;
  colorHint?: string | null;
  keywords?: string[];
};

export type SubmittedBySummary = {
  id: string;
  displayName: string;
} | null;

export type AdminMetadataSuggestion = {
  id: string;
  book: {
    id: string;
    slug: string;
    title: string;
  };
  submittedBy: SubmittedBySummary;
  synopsis: string | null;
  genres: string[];
  status: string;
  createdAt: string;
};

export type AdminPrepSuggestion = {
  id: string;
  book: {
    id: string;
    slug: string;
    title: string;
  };
  submittedBy: SubmittedBySummary;
  title: string;
  description: string;
  keywordHints: string[];
  status: string;
  createdAt: string;
};

export type AdminBookSuggestion = {
  id: string;
  title: string;
  authorName: string;
  notes: string | null;
  genreIdeas: string[];
  prepIdeas: string[];
  submittedBy: SubmittedBySummary;
  status: string;
  createdAt: string;
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

  const headers = new Headers({
    "Content-Type": "application/json"
  });

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
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
        pageSize: params.pageSize
      },
      signal
    }),
  getBook: (slug: string, signal?: AbortSignal) =>
    apiFetch<BookDetail>(`/api/books/${slug}`, { signal }),
  listGenres: () => apiFetch<{ genres: Genre[] }>("/api/genres"),
  listAuthors: () => apiFetch<{ authors: Author[] }>("/api/authors"),
  listPrepKeywords: () => apiFetch<{ keywords: Keyword[] }>("/api/preps/keywords"),
  voteOnPrep: (params: { slug: string; prepId: string; value: "AGREE" | "DISAGREE"; token: string }) =>
    apiFetch<{ prepId: string; votes: Prep["votes"] }>(
      `/api/books/${params.slug}/preps/${params.prepId}/vote`,
      {
        method: "POST",
        body: { value: params.value },
        token: params.token
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
        keywordHints: params.keywordHints
      },
      token: params.token
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
        prepIdeas: params.prepIdeas
      },
      token: params.token
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
        genres: params.genres
      },
      token: params.token
    }),
  catalogStats: () => apiFetch<CatalogStats>("/api/stats"),
  adminListBooks: (params: {
    search?: string;
    page?: number;
    pageSize?: number;
    token: string;
  }) =>
    apiFetch<{ pagination: Pagination; results: AdminBookListItem[] }>("/api/admin/books", {
      query: {
        search: params.search,
        page: params.page,
        pageSize: params.pageSize
      },
      token: params.token
    }),
  adminGetBook: (slug: string, token: string) =>
    apiFetch<{ book: AdminBookDetail }>(`/api/admin/books/${slug}`, {
      token
    }),
  adminCreateBook: (payload: AdminCreateBookInput, token: string) =>
    apiFetch<{ book: AdminBookDetail }>(`/api/admin/books`, {
      method: "POST",
      body: payload,
      token
    }),
  adminUpdateBook: (slug: string, payload: AdminUpdateBookInput, token: string) =>
    apiFetch<{ book: AdminBookDetail }>(`/api/admin/books/${slug}`, {
      method: "PATCH",
      body: payload,
      token
    }),
  adminCreatePrep: (params: { slug: string; body: AdminPrepInput; token: string }) =>
    apiFetch<{ prep: AdminPrepDetail }>(`/api/admin/books/${params.slug}/preps`, {
      method: "POST",
      body: params.body,
      token: params.token
    }),
  adminUpdatePrep: (params: { slug: string; prepId: string; token: string; body: AdminPrepInput }) =>
    apiFetch<{ prep: AdminPrepDetail }>(`/api/admin/books/${params.slug}/preps/${params.prepId}`, {
      method: "PUT",
      body: params.body,
      token: params.token
    }),
  adminDeletePrep: (params: { slug: string; prepId: string; token: string }) =>
    apiFetch<{ message: string }>(`/api/admin/books/${params.slug}/preps/${params.prepId}`, {
      method: "DELETE",
      token: params.token
    }),
  adminListMetadataSuggestions: (token: string) =>
    apiFetch<{ suggestions: AdminMetadataSuggestion[] }>(
      "/api/admin/suggestions/metadata",
      {
        token
      }
    ),
  adminApproveMetadataSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/metadata/${params.id}/approve`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token
      }
    ),
  adminRejectMetadataSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/metadata/${params.id}/reject`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token
      }
    ),
  adminListPrepSuggestions: (token: string) =>
    apiFetch<{ suggestions: AdminPrepSuggestion[] }>("/api/admin/suggestions/preps", {
      token
    }),
  adminApprovePrepSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ prep: AdminPrepDetail }>(`/api/admin/suggestions/preps/${params.id}/approve`, {
      method: "POST",
      body: { note: params.note },
      token: params.token
    }),
  adminRejectPrepSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/preps/${params.id}/reject`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token
      }
    ),
  adminListBookSuggestions: (token: string) =>
    apiFetch<{ suggestions: AdminBookSuggestion[] }>(`/api/admin/suggestions/books`, {
      token
    }),
  adminApproveBookSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ book: { id: string; slug: string; title: string } }>(
      `/api/admin/suggestions/books/${params.id}/approve`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token
      }
    ),
  adminRejectBookSuggestion: (params: { id: string; note?: string; token: string }) =>
    apiFetch<{ suggestionId: string; status: string }>(
      `/api/admin/suggestions/books/${params.id}/reject`,
      {
        method: "POST",
        body: { note: params.note },
        token: params.token
      }
    )
};

