/**
 * Admin suggestion moderation routes.
 */
import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "db";
import { adminModerationNoteSchema, suggestionIdParamsSchema } from "../../schemas.js";
import { truncateSynopsis, extractStringArray } from "../../utils/strings.js";
import {
  adminPrepInclude,
  ensureGenresFromNames,
  ensureUniqueSlug,
  mapAdminPrep,
  resolveAuthorId,
  syncBookGenres,
  upsertKeywords,
} from "./helpers.js";

const adminSuggestionsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
  });

  const guardHooks = { onRequest: [fastify.verifyJwt, fastify.requireAdmin] };
  const adminModerationRateLimit = {
    max: 20,
    timeWindow: "1 minute",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Suggestions
  // ─────────────────────────────────────────────────────────────────────────

  fastify.get("/admin/suggestions/metadata", guardHooks, async () => {
    const suggestions = await prisma.bookMetadataSuggestion.findMany({
      where: { status: "PENDING" },
      include: {
        book: {
          select: { id: true, slug: true, title: true },
        },
        submittedBy: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      suggestions: suggestions.map((suggestion) => ({
        id: suggestion.id,
        book: suggestion.book,
        submittedBy: suggestion.submittedBy,
        synopsis: suggestion.suggestedSynopsis,
        genres: extractStringArray(suggestion.suggestedGenres),
        status: suggestion.status,
        createdAt: suggestion.createdAt,
      })),
    };
  });

  fastify.post("/admin/suggestions/metadata/:id/approve", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    const body = adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.bookMetadataSuggestion.findUnique({
      where: { id: params.id },
    });

    if (!suggestion) {
      throw fastify.httpErrors.notFound("Suggestion not found.");
    }

    if (suggestion.status !== "PENDING") {
      throw fastify.httpErrors.badRequest("Suggestion already processed.");
    }

    const genreSlugs = extractStringArray(suggestion.suggestedGenres);

    await prisma.$transaction(async (tx) => {
      if (suggestion.suggestedSynopsis) {
        const truncatedSynopsis = truncateSynopsis(suggestion.suggestedSynopsis);
        await tx.book.update({
          where: { id: suggestion.bookId },
          data: {
            synopsis: truncatedSynopsis,
          },
        });
      }

      if (genreSlugs.length > 0) {
        const genres = await tx.genre.findMany({
          where: {
            slug: {
              in: genreSlugs,
            },
          },
          select: { id: true },
        });

        await tx.bookGenre.deleteMany({
          where: { bookId: suggestion.bookId },
        });

        if (genres.length > 0) {
          await tx.bookGenre.createMany({
            data: genres.map((genre) => ({
              bookId: suggestion.bookId,
              genreId: genre.id,
            })),
          });
        }
      }

      await tx.bookMetadataSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "APPROVED",
          moderatorNote: body.note ?? null,
          reviewedAt: new Date(),
        },
      });
    });

    return {
      suggestionId: suggestion.id,
      status: "APPROVED",
    };
  });

  fastify.post("/admin/suggestions/metadata/:id/reject", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    const body = adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.bookMetadataSuggestion.findUnique({
      where: { id: params.id },
    });

    if (!suggestion) {
      throw fastify.httpErrors.notFound("Suggestion not found.");
    }

    if (suggestion.status !== "PENDING") {
      throw fastify.httpErrors.badRequest("Suggestion already processed.");
    }

    await prisma.bookMetadataSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: "REJECTED",
        moderatorNote: body.note ?? null,
        reviewedAt: new Date(),
      },
    });

    return {
      suggestionId: suggestion.id,
      status: "REJECTED",
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Prep Suggestions
  // ─────────────────────────────────────────────────────────────────────────

  fastify.get("/admin/suggestions/preps", guardHooks, async () => {
    const suggestions = await prisma.prepSuggestion.findMany({
      where: { status: "PENDING" },
      include: {
        book: {
          select: { id: true, slug: true, title: true },
        },
        submittedBy: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      suggestions: suggestions.map((suggestion) => ({
        id: suggestion.id,
        book: suggestion.book,
        submittedBy: suggestion.submittedBy,
        title: suggestion.title,
        description: suggestion.description,
        keywordHints: extractStringArray(suggestion.keywordHints),
        status: suggestion.status,
        createdAt: suggestion.createdAt,
      })),
    };
  });

  fastify.post("/admin/suggestions/preps/:id/approve", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    const body = adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.prepSuggestion.findUnique({
      where: { id: params.id },
    });

    if (!suggestion) {
      throw fastify.httpErrors.notFound("Suggestion not found.");
    }

    if (suggestion.status !== "PENDING") {
      throw fastify.httpErrors.badRequest("Suggestion already processed.");
    }

    const keywords = await upsertKeywords(extractStringArray(suggestion.keywordHints));

    const prep = await prisma.bookPrep.create({
      data: {
        bookId: suggestion.bookId,
        heading: suggestion.title,
        summary: suggestion.description,
        keywords: {
          create: keywords.map((keyword) => ({
            keywordId: keyword.id,
          })),
        },
      },
      ...adminPrepInclude,
    });

    await prisma.prepSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: "APPROVED",
        moderatorNote: body.note ?? null,
        reviewedAt: new Date(),
      },
    });

    return {
      prep: mapAdminPrep(prep),
    };
  });

  fastify.post(
    "/admin/suggestions/preps/:id/reject",
    { ...guardHooks, config: { rateLimit: adminModerationRateLimit } },
    async (request) => {
      const params = suggestionIdParamsSchema.parse(request.params);
      const body = adminModerationNoteSchema.parse(request.body ?? {});

      const suggestion = await prisma.prepSuggestion.findUnique({
        where: { id: params.id },
      });

      if (!suggestion) {
        throw fastify.httpErrors.notFound("Suggestion not found.");
      }

      if (suggestion.status !== "PENDING") {
        throw fastify.httpErrors.badRequest("Suggestion already processed.");
      }

      await prisma.prepSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "REJECTED",
          moderatorNote: body.note ?? null,
          reviewedAt: new Date(),
        },
      });

      return {
        suggestionId: suggestion.id,
        status: "REJECTED",
      };
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Book Suggestions
  // ─────────────────────────────────────────────────────────────────────────

  fastify.get(
    "/admin/suggestions/books",
    { ...guardHooks, config: { rateLimit: adminModerationRateLimit } },
    async () => {
      const suggestions = await prisma.bookSuggestion.findMany({
        where: { status: "PENDING" },
        include: {
          submittedBy: {
            select: { id: true, displayName: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return {
        suggestions: suggestions.map((suggestion) => ({
          id: suggestion.id,
          title: suggestion.title,
          authorName: suggestion.authorName,
          notes: suggestion.notes,
          genreIdeas: extractStringArray(suggestion.genreIdeas),
          prepIdeas: extractStringArray(suggestion.prepIdeas),
          submittedBy: suggestion.submittedBy,
          status: suggestion.status,
          createdAt: suggestion.createdAt,
        })),
      };
    }
  );

  fastify.post(
    "/admin/suggestions/books/:id/approve",
    { ...guardHooks, config: { rateLimit: adminModerationRateLimit } },
    async (request) => {
      const params = suggestionIdParamsSchema.parse(request.params);
      adminModerationNoteSchema.parse(request.body ?? {});

      const suggestion = await prisma.bookSuggestion.findUnique({
        where: { id: params.id },
      });

      if (!suggestion) {
        throw fastify.httpErrors.notFound("Suggestion not found.");
      }

      if (suggestion.status !== "PENDING") {
        throw fastify.httpErrors.badRequest("Suggestion already processed.");
      }

      const authorId = await resolveAuthorId(undefined, suggestion.authorName);
      const slug = await ensureUniqueSlug("book", suggestion.title);

      const newBook = await prisma.book.create({
        data: {
          title: suggestion.title,
          slug,
          synopsis: truncateSynopsis(suggestion.notes),
          authorId,
        },
      });

      const genreIdeas = extractStringArray(suggestion.genreIdeas);
      if (genreIdeas.length > 0) {
        const genreRecords = await ensureGenresFromNames(genreIdeas);
        await syncBookGenres(
          newBook.id,
          genreRecords.map((genre) => genre.id)
        );
      }

      await prisma.bookSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });

      return {
        book: {
          id: newBook.id,
          slug: newBook.slug,
          title: newBook.title,
        },
      };
    }
  );

  fastify.post(
    "/admin/suggestions/books/:id/reject",
    { ...guardHooks, config: { rateLimit: adminModerationRateLimit } },
    async (request) => {
      const params = suggestionIdParamsSchema.parse(request.params);
      adminModerationNoteSchema.parse(request.body ?? {});

      const suggestion = await prisma.bookSuggestion.findUnique({
        where: { id: params.id },
      });

      if (!suggestion) {
        throw fastify.httpErrors.notFound("Suggestion not found.");
      }

      if (suggestion.status !== "PENDING") {
        throw fastify.httpErrors.badRequest("Suggestion already processed.");
      }

      await prisma.bookSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
        },
      });

      return {
        suggestionId: suggestion.id,
        status: "REJECTED",
      };
    }
  );
};

export default adminSuggestionsRoutes;
