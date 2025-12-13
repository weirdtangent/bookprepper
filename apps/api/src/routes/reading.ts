import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import { ensureUserProfile } from "../utils/profile.js";
import { bookSlugParamsSchema, readingStatusBodySchema } from "../schemas.js";
import type { Prisma } from "@prisma/client";

const readingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/reading", { onRequest: [fastify.verifyJwt] }, async (request) => {
    const user = await ensureUserProfile(request);

    const entries = await prisma.readingStatus.findMany({
      where: { userId: user.id, status: "READING" },
      orderBy: { updatedAt: "desc" },
      include: {
        book: readingBookArgs,
      },
    });

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        status: entry.status,
        startedAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        book: mapReadingBook(entry.book),
      })),
    };
  });

  fastify.get("/reading/finished", { onRequest: [fastify.verifyJwt] }, async (request) => {
    const user = await ensureUserProfile(request);

    const entries = await prisma.readingStatus.findMany({
      where: { userId: user.id, status: "DONE" },
      orderBy: { updatedAt: "desc" },
      include: {
        book: readingBookArgs,
      },
    });

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        status: entry.status,
        startedAt: entry.createdAt.toISOString(),
        finishedAt: entry.updatedAt.toISOString(),
        book: mapReadingBook(entry.book),
      })),
    };
  });

  fastify.post("/books/:slug/reading", { onRequest: [fastify.verifyJwt] }, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);
    const body = readingStatusBodySchema.parse(request.body ?? {});
    const user = await ensureUserProfile(request);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found");
    }

    const status = body.status ?? "READING";

    const record = await prisma.readingStatus.upsert({
      where: {
        userId_bookId: {
          userId: user.id,
          bookId: book.id,
        },
      },
      update: {
        status,
      },
      create: {
        userId: user.id,
        bookId: book.id,
        status,
      },
    });

    return {
      id: record.id,
      status: record.status,
      updatedAt: record.updatedAt.toISOString(),
    };
  });

  fastify.delete("/books/:slug/reading", { onRequest: [fastify.verifyJwt] }, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);
    const user = await ensureUserProfile(request);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found");
    }

    const existing = await prisma.readingStatus.findFirst({
      where: {
        userId: user.id,
        bookId: book.id,
        status: "READING",
      },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    const updated = await prisma.readingStatus.update({
      where: { id: existing.id },
      data: {
        status: "DONE",
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
};

const readingBookArgs = {
  include: {
    author: true,
    genres: {
      include: {
        genre: true,
      },
    },
    preps: {
      select: {
        keywords: {
          select: {
            keyword: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    },
    _count: {
      select: { preps: true },
    },
  },
} satisfies Prisma.BookDefaultArgs;

function mapReadingBook(book: Prisma.BookGetPayload<typeof readingBookArgs>) {
  const keywordMap = new Map<
    string,
    {
      id: string;
      slug: string;
      name: string;
      description: string | null;
    }
  >();

  for (const prep of book.preps) {
    for (const entry of prep.keywords) {
      const keyword = entry.keyword;
      if (!keywordMap.has(keyword.id)) {
        keywordMap.set(keyword.id, {
          id: keyword.id,
          slug: keyword.slug,
          name: keyword.name,
          description: keyword.description ?? null,
        });
      }
    }
  }

  const keywords = Array.from(keywordMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    synopsis: book.synopsis,
    coverImageUrl: book.coverImageUrl,
    isbn: book.isbn,
    author: {
      name: book.author.name,
      slug: book.author.slug,
    },
    genres: book.genres.map((entry) => ({
      id: entry.genre.id,
      name: entry.genre.name,
      slug: entry.genre.slug,
    })),
    prepCount: book._count.preps,
    keywords,
  };
}

export default readingRoutes;
