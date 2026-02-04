/**
 * Admin book CRUD routes.
 */
import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";
import {
  adminBookCreateSchema,
  adminBookUpdateSchema,
  adminListBooksQuerySchema,
  bookSlugParamsSchema,
} from "../../schemas.js";
import { normalizeIsbn } from "../../utils/isbn.js";
import { truncateSynopsis } from "../../utils/strings.js";
import {
  adminBookDetailInclude,
  buildBookSearchWhere,
  ensureUniqueSlug,
  mapAdminBook,
  resolveAuthorId,
  syncBookGenres,
  validateGenreIds,
} from "./helpers.js";

const adminBooksRoutes: FastifyPluginAsync = async (fastify) => {
  const guardHooks = { onRequest: [fastify.verifyJwt, fastify.requireAdmin] };

  fastify.get("/admin/books", guardHooks, async (request) => {
    const query = adminListBooksQuerySchema.parse(request.query);
    const where = buildBookSearchWhere(query.search);

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          author: true,
          _count: {
            select: { preps: true },
          },
        },
      }),
    ]);

    return {
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      },
      results: books.map((book) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
        author: {
          id: book.author.id,
          name: book.author.name,
        },
        synopsis: book.synopsis,
        isbn: book.isbn,
        prepCount: book._count.preps,
        updatedAt: book.updatedAt,
      })),
    };
  });

  fastify.get("/admin/books/:slug", guardHooks, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      ...adminBookDetailInclude,
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found.");
    }

    return {
      book: mapAdminBook(book),
    };
  });

  fastify.post(
    "/admin/books",
    {
      ...guardHooks,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request) => {
      const body = adminBookCreateSchema.parse(request.body);
      const authorId = await resolveAuthorId(body.authorId, body.authorName);
      const slug = await ensureUniqueSlug("book", body.slug ?? body.title);
      const isbn = normalizeIsbn(body.isbn);

      const createdBook = await prisma.book.create({
        data: {
          title: body.title,
          subtitle: body.subtitle ?? null,
          slug,
          synopsis: truncateSynopsis(body.synopsis),
          coverImageUrl: body.coverImageUrl ?? null,
          publishedYear: body.publishedYear ?? null,
          isbn,
          authorId,
        },
      });

      if (body.genreIds?.length) {
        const genreIds = await validateGenreIds(fastify, body.genreIds);
        await syncBookGenres(createdBook.id, genreIds);
      }

      const fullBook = await prisma.book.findUnique({
        where: { id: createdBook.id },
        ...adminBookDetailInclude,
      });

      return {
        book: mapAdminBook(fullBook!),
      };
    }
  );

  fastify.patch("/admin/books/:slug", guardHooks, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);
    const body = adminBookUpdateSchema.parse(request.body ?? {});

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found.");
    }

    const updates: Prisma.BookUpdateInput = {};

    if (body.title !== undefined) {
      updates.title = body.title;
    }
    if (body.subtitle !== undefined) {
      updates.subtitle = body.subtitle ?? null;
    }
    if (body.synopsis !== undefined) {
      updates.synopsis = truncateSynopsis(body.synopsis);
    }
    if (body.coverImageUrl !== undefined) {
      updates.coverImageUrl = body.coverImageUrl ?? null;
    }
    if (body.publishedYear !== undefined) {
      updates.publishedYear = body.publishedYear ?? null;
    }
    if (body.isbn !== undefined) {
      updates.isbn = normalizeIsbn(body.isbn);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.book.update({
        where: { id: book.id },
        data: updates,
      });
    }

    if (body.genreIds) {
      const genreIds = await validateGenreIds(fastify, body.genreIds);
      await syncBookGenres(book.id, genreIds);
    }

    const fullBook = await prisma.book.findUnique({
      where: { id: book.id },
      ...adminBookDetailInclude,
    });

    return {
      book: mapAdminBook(fullBook!),
    };
  });
};

export default adminBooksRoutes;
