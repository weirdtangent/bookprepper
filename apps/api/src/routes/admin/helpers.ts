/**
 * Shared helper functions for admin routes.
 */
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";
import {
  calculatePromptScore,
  createEmptyDimensionBreakdown,
  summaryFromScoreRecord,
  toVotesPayload,
} from "../../utils/promptScores.js";
import { tokenizeSearch, slugify } from "../../utils/strings.js";

// Prisma include configurations
export const adminBookDetailInclude = {
  include: {
    author: true,
    genres: {
      include: {
        genre: true,
      },
      orderBy: {
        genre: {
          name: "asc",
        },
      },
    },
    preps: {
      include: {
        keywords: {
          include: {
            keyword: true,
          },
        },
        votes: true,
        score: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    },
  },
} as const;

export const adminPrepInclude = {
  include: {
    keywords: {
      include: {
        keyword: true,
      },
    },
    votes: true,
    score: true,
  },
} as const;

// Types
export type AdminBookDetail = Prisma.BookGetPayload<typeof adminBookDetailInclude>;
export type AdminPrepDetail = Prisma.BookPrepGetPayload<typeof adminPrepInclude>;

// Search helpers
export function buildBookSearchWhere(search?: string) {
  if (!search) {
    return {};
  }

  const tokens = tokenizeSearch(search);
  if (tokens.length === 0) {
    const fallback = search.trim();
    return {
      OR: [
        { title: { contains: fallback, mode: "insensitive" } },
        { slug: { contains: fallback.toLowerCase() } },
        {
          author: {
            name: { contains: fallback, mode: "insensitive" },
          },
        },
      ],
    };
  }

  return {
    AND: tokens.map((token) => ({
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { slug: { contains: token } },
        {
          author: {
            name: { contains: token, mode: "insensitive" },
          },
        },
      ],
    })),
  };
}

// Mappers
export function mapAdminBook(book: AdminBookDetail) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    synopsis: book.synopsis,
    coverImageUrl: book.coverImageUrl,
    isbn: book.isbn,
    publishedYear: book.publishedYear,
    author: {
      id: book.author.id,
      name: book.author.name,
      slug: book.author.slug,
    },
    genres: book.genres.map((entry) => ({
      id: entry.genre.id,
      name: entry.genre.name,
      slug: entry.genre.slug,
    })),
    preps: book.preps.map(mapAdminPrep),
    updatedAt: book.updatedAt,
  };
}

export function mapAdminPrep(prep: AdminPrepDetail) {
  const legacyAgree = prep.votes.filter((vote) => vote.value === "AGREE").length;
  const legacyDisagree = prep.votes.filter((vote) => vote.value === "DISAGREE").length;
  const fallbackSummary = {
    agree: legacyAgree,
    disagree: legacyDisagree,
    total: legacyAgree + legacyDisagree,
    score: calculatePromptScore(legacyAgree, legacyDisagree),
    dimensions: createEmptyDimensionBreakdown(),
  };
  const summary = summaryFromScoreRecord(prep.score) ?? fallbackSummary;

  return {
    id: prep.id,
    heading: prep.heading,
    summary: prep.summary,
    watchFor: prep.watchFor,
    colorHint: prep.colorHint,
    keywords: prep.keywords.map((entry) => ({
      id: entry.keyword.id,
      slug: entry.keyword.slug,
      name: entry.keyword.name,
    })),
    votes: toVotesPayload(summary),
    updatedAt: prep.updatedAt,
  };
}

// Database helpers
export async function resolveAuthorId(authorId?: string, authorName?: string) {
  if (authorId) {
    return authorId;
  }

  if (!authorName) {
    throw new Error("Author name required.");
  }

  const normalizedName = authorName.trim();
  const baseSlug = slugify(normalizedName);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.author.findUnique({ where: { slug } });
    if (!existing) {
      break;
    }
    if (existing.name.toLowerCase() === normalizedName.toLowerCase()) {
      return existing.id;
    }
    slug = `${baseSlug}-${suffix++}`;
  }

  const author = await prisma.author.create({
    data: {
      name: normalizedName,
      slug,
    },
  });

  return author.id;
}

export async function validateGenreIds(fastify: FastifyInstance, genreIds: string[]) {
  const uniqueIds = [...new Set(genreIds)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const genres = await prisma.genre.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (genres.length !== uniqueIds.length) {
    throw fastify.httpErrors.badRequest("One or more genres do not exist.");
  }

  return uniqueIds;
}

export async function syncBookGenres(bookId: string, genreIds: string[]) {
  await prisma.bookGenre.deleteMany({
    where: { bookId },
  });

  if (genreIds.length === 0) {
    return;
  }

  await prisma.bookGenre.createMany({
    data: genreIds.map((genreId) => ({
      bookId,
      genreId,
    })),
    skipDuplicates: true,
  });
}

export async function upsertKeywords(keywordNames: string[]) {
  const cleaned = Array.from(new Set(keywordNames.map((name) => name.trim()).filter(Boolean)));

  if (cleaned.length === 0) {
    return [];
  }

  return Promise.all(
    cleaned.map((name) => {
      const slug = slugify(name);
      return prisma.prepKeyword.upsert({
        where: { slug },
        update: { name },
        create: { name, slug },
      });
    })
  );
}

export async function ensureUniqueSlug(type: "book" | "author" | "genre", rawValue: string) {
  const baseSlug = slugify(rawValue);
  let candidate = baseSlug;
  let suffix = 2;

  while (await slugExists(type, candidate)) {
    candidate = `${baseSlug}-${suffix++}`;
  }

  return candidate;
}

async function slugExists(type: "book" | "author" | "genre", slug: string) {
  switch (type) {
    case "book":
      return Boolean(await prisma.book.findUnique({ where: { slug } }));
    case "author":
      return Boolean(await prisma.author.findUnique({ where: { slug } }));
    case "genre":
      return Boolean(await prisma.genre.findUnique({ where: { slug } }));
    default:
      return false;
  }
}

export async function ensureGenresFromNames(names: string[]) {
  const cleaned = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));

  if (cleaned.length === 0) {
    return [];
  }

  const genres = [];

  for (const name of cleaned) {
    let slug = slugify(name);
    let genre = await prisma.genre.findUnique({ where: { slug } });
    if (!genre) {
      slug = await ensureUniqueSlug("genre", slug);
      genre = await prisma.genre.create({
        data: {
          name,
          slug,
        },
      });
    }
    genres.push(genre);
  }

  return genres;
}
