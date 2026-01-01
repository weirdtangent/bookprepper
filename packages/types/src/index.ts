/**
 * Shared types for BookPrepper API responses.
 * These types are used by both the API (for response shaping) and the web app (for type-safe consumption).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Entities
// ─────────────────────────────────────────────────────────────────────────────

export type Author = {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  bookCount?: number;
};

export type Genre = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type Keyword = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Feedback
// ─────────────────────────────────────────────────────────────────────────────

export type PromptFeedbackDimension =
  | "CORRECT"
  | "INCORRECT"
  | "FUN"
  | "BORING"
  | "USEFUL"
  | "SURPRISING"
  | "NOT_USEFUL"
  | "CONFUSING"
  | "COMMON"
  | "SPARSE";

export type PromptVoteDimensionBreakdown = {
  dimension: PromptFeedbackDimension;
  agree: number;
  disagree: number;
  total: number;
};

export type PromptVoteSummary = {
  agree: number;
  disagree: number;
  total: number;
  score: number;
  dimensions: PromptVoteDimensionBreakdown[];
};

export type QuoteVotes = {
  agree: number;
  disagree: number;
  total: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────────────────

export type PrepQuote = {
  id: string;
  text: string;
  pageNumber: string | null;
  chapter: string | null;
  verified: boolean;
  verifiedSource: string | null;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
  };
  votes: QuoteVotes;
};

export type GoogleBooksSearchResult = {
  bookId: string;
  title: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  previewLink?: string;
  infoLink?: string;
  textSnippet?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Preps
// ─────────────────────────────────────────────────────────────────────────────

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
  votes: PromptVoteSummary;
  quotes: PrepQuote[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Books
// ─────────────────────────────────────────────────────────────────────────────

export type BookSummary = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  coverImageUrl: string | null;
  isbn: string | null;
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
  keywords?: Keyword[];
};

export type BookDetail = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  coverImageUrl: string | null;
  isbn: string | null;
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
  prepCount: number;
  preps: Prep[];
};

export type BookListResponse = {
  pagination: Pagination;
  results: BookSummary[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Stats
// ─────────────────────────────────────────────────────────────────────────────

export type CatalogStats = {
  books: number;
  authors: number;
  preps: number;
  years: {
    earliest: number | null;
    latest: number | null;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// User Profile
// ─────────────────────────────────────────────────────────────────────────────

export type UserPreferences = {
  shuffleDefault?: boolean;
};

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  preferences: UserPreferences;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reading Status
// ─────────────────────────────────────────────────────────────────────────────

export type ReadingStatus = "READING" | "DONE";

export type ReadingEntry = {
  id: string;
  status: ReadingStatus;
  startedAt: string;
  updatedAt?: string;
  finishedAt?: string;
  book: BookSummary;
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin Types
// ─────────────────────────────────────────────────────────────────────────────

export type AdminBookListItem = {
  id: string;
  slug: string;
  title: string;
  author: {
    id: string;
    name: string;
  };
  synopsis: string | null;
  isbn: string | null;
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
  votes: PromptVoteSummary;
  updatedAt: string;
};

export type AdminBookDetail = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  synopsis: string | null;
  coverImageUrl: string | null;
  isbn: string | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Feedback Insights
// ─────────────────────────────────────────────────────────────────────────────

export type PromptInsightSummary = {
  prepId: string;
  heading: string;
  summary: string;
  book: {
    id: string;
    title: string;
    slug: string;
  };
  votes: PromptVoteSummary;
};

export type PromptFeedbackInsights = {
  topPrompts: PromptInsightSummary[];
  needsAttention: PromptInsightSummary[];
  recentFeedback: Array<{
    id: string;
    dimension: PromptFeedbackDimension;
    value: "AGREE" | "DISAGREE";
    note: string | null;
    createdAt: string;
    prep: {
      id: string;
      heading: string;
    };
    book: {
      id: string;
      title: string;
      slug: string;
    };
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin Input Types
// ─────────────────────────────────────────────────────────────────────────────

export type AdminCreateBookInput = {
  title: string;
  subtitle?: string;
  slug?: string;
  synopsis?: string;
  coverImageUrl?: string;
  isbn?: string;
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
  isbn?: string | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Admin Suggestions
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Query Parameters
// ─────────────────────────────────────────────────────────────────────────────

export type BookQueryParams = {
  search?: string;
  author?: string;
  genres?: string[];
  prep?: string[];
  page?: number;
  pageSize?: number;
  shuffle?: boolean;
};
