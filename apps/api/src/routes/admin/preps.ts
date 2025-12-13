/**
 * Admin prep management routes.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import { adminPrepUpsertSchema, bookSlugParamsSchema, prepParamsSchema } from "../../schemas.js";
import { adminPrepInclude, mapAdminPrep, upsertKeywords } from "./helpers.js";

const adminPrepsRoutes: FastifyPluginAsync = async (fastify) => {
  const guardHooks = { onRequest: [fastify.verifyJwt, fastify.requireAdmin] };

  fastify.post("/admin/books/:slug/preps", guardHooks, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);
    const body = adminPrepUpsertSchema.parse(request.body);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found.");
    }

    const keywords = await upsertKeywords(body.keywords ?? []);

    const prep = await prisma.bookPrep.create({
      data: {
        bookId: book.id,
        heading: body.heading,
        summary: body.summary,
        watchFor: body.watchFor ?? null,
        colorHint: body.colorHint ?? null,
        keywords: {
          create: keywords.map((keyword) => ({
            keywordId: keyword.id,
          })),
        },
      },
      ...adminPrepInclude,
    });

    return {
      prep: mapAdminPrep(prep),
    };
  });

  fastify.put("/admin/books/:slug/preps/:prepId", guardHooks, async (request) => {
    const params = prepParamsSchema.parse(request.params);
    const body = adminPrepUpsertSchema.parse(request.body);

    const prep = await prisma.bookPrep.findFirst({
      where: { id: params.prepId, book: { slug: params.slug } },
      select: { id: true },
    });

    if (!prep) {
      throw fastify.httpErrors.notFound("Prep not found for that book.");
    }

    const keywords = await upsertKeywords(body.keywords ?? []);

    const updatedPrep = await prisma.bookPrep.update({
      where: { id: prep.id },
      data: {
        heading: body.heading,
        summary: body.summary,
        watchFor: body.watchFor ?? null,
        colorHint: body.colorHint ?? null,
        keywords: {
          deleteMany: {},
          create: keywords.map((keyword) => ({
            keywordId: keyword.id,
          })),
        },
      },
      ...adminPrepInclude,
    });

    return {
      prep: mapAdminPrep(updatedPrep),
    };
  });

  fastify.delete("/admin/books/:slug/preps/:prepId", guardHooks, async (request) => {
    const params = prepParamsSchema.parse(request.params);

    const prep = await prisma.bookPrep.findFirst({
      where: { id: params.prepId, book: { slug: params.slug } },
      select: { id: true },
    });

    if (!prep) {
      throw fastify.httpErrors.notFound("Prep not found for that book.");
    }

    await prisma.bookPrep.delete({
      where: { id: prep.id },
    });

    return {
      message: "Prep removed.",
    };
  });
};

export default adminPrepsRoutes;
