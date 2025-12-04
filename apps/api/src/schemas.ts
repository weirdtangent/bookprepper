import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

export const listBooksQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  genres: z.string().trim().optional(),
  prep: z.string().trim().optional()
});

export const bookSlugParamsSchema = z.object({
  slug: z.string().min(1)
});

export const prepParamsSchema = z.object({
  slug: z.string().min(1),
  prepId: z.string().cuid()
});

export const voteBodySchema = z.object({
  value: z.enum(["AGREE", "DISAGREE"])
});

export const prepSuggestionBodySchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  keywordHints: z.array(z.string().min(2).max(60)).max(10).optional(),
  colorHint: z.string().max(12).optional()
});

export const metadataSuggestionBodySchema = z
  .object({
    synopsis: z
      .string()
      .trim()
      .min(40, "Synopsis should be at least 40 characters.")
      .max(2000, "Synopsis too long.")
      .optional(),
    genres: z.array(z.string().min(2).max(60)).max(10).optional()
  })
  .refine(
    (value) => Boolean(value.synopsis) || Boolean(value.genres && value.genres.length > 0),
    "Provide a synopsis or at least one genre."
  );

export const bookSuggestionBodySchema = z.object({
  title: z.string().min(3).max(180),
  authorName: z.string().min(3).max(120),
  notes: z.string().max(2000).optional(),
  genreIdeas: z.array(z.string().min(2).max(60)).max(12).optional(),
  prepIdeas: z.array(z.string().min(2).max(120)).max(12).optional()
});

export const adminListBooksQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional()
});

export const adminBookCreateSchema = z
  .object({
    title: z.string().min(3).max(240),
    subtitle: z.string().max(240).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Slug can only include lowercase letters, numbers, and hyphens.")
      .min(3)
      .max(240)
      .optional(),
    synopsis: z.string().max(4000).optional(),
    coverImageUrl: z.string().url().optional(),
    publishedYear: z.coerce.number().int().min(0).max(9999).optional(),
    authorId: z.string().cuid().optional(),
    authorName: z.string().min(2).max(180).optional(),
    genreIds: z.array(z.string().cuid()).optional()
  })
  .refine(
    (value) => Boolean(value.authorId) || Boolean(value.authorName),
    "Provide authorId or authorName."
  );

export const adminBookUpdateSchema = z.object({
  title: z.string().min(3).max(240).optional(),
  subtitle: z.string().max(240).optional(),
  synopsis: z
    .union([z.string().max(4000), z.literal(""), z.null()])
    .transform((value) => (value === "" ? null : value ?? undefined))
    .optional(),
  coverImageUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .transform((value) => (value === "" ? null : value ?? undefined))
    .optional(),
  publishedYear: z
    .union([z.coerce.number().int().min(0).max(9999), z.literal(""), z.null()])
    .transform((value) => {
      if (value === "" || value === null) {
        return null;
      }
      return value;
    })
    .optional(),
  genreIds: z.array(z.string().cuid()).optional()
});

export const adminPrepUpsertSchema = z.object({
  heading: z.string().min(3).max(160),
  summary: z.string().min(10).max(2000),
  watchFor: z.string().max(2000).optional(),
  colorHint: z.string().max(32).optional(),
  keywords: z.array(z.string().min(2).max(60)).max(12).optional()
});

export const suggestionIdParamsSchema = z.object({
  id: z.string().cuid()
});

export const adminModerationNoteSchema = z.object({
  note: z.string().max(500).optional()
});

export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
export type BookSlugParams = z.infer<typeof bookSlugParamsSchema>;
export type PrepParams = z.infer<typeof prepParamsSchema>;
export type VoteBody = z.infer<typeof voteBodySchema>;
export type PrepSuggestionBody = z.infer<typeof prepSuggestionBodySchema>;
export type MetadataSuggestionBody = z.infer<typeof metadataSuggestionBodySchema>;
export type BookSuggestionBody = z.infer<typeof bookSuggestionBodySchema>;
export type AdminListBooksQuery = z.infer<typeof adminListBooksQuerySchema>;
export type AdminBookCreateBody = z.infer<typeof adminBookCreateSchema>;
export type AdminBookUpdateBody = z.infer<typeof adminBookUpdateSchema>;
export type AdminPrepUpsertBody = z.infer<typeof adminPrepUpsertSchema>;
export type SuggestionIdParams = z.infer<typeof suggestionIdParamsSchema>;

