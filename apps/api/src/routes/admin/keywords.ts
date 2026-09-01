/**
 * Admin prep-keyword vocabulary management.
 *
 * The library filter offers only CANONICAL keywords. Everything authored as free
 * text lands as PENDING and waits here to be promoted, aliased onto an existing
 * keyword, or deleted.
 */
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import {
  adminKeywordAliasSchema,
  adminKeywordUpdateSchema,
  keywordIdParamsSchema,
} from "../../schemas.js";
import { aliasKeywordInto } from "./helpers.js";

const keywordWithUsage = {
  include: {
    aliasOf: { select: { id: true, name: true, slug: true } },
    preps: { select: { prep: { select: { bookId: true } } } },
    _count: { select: { aliases: true } },
  },
} as const;

type KeywordWithUsage = Awaited<
  ReturnType<typeof prisma.prepKeyword.findFirstOrThrow<typeof keywordWithUsage>>
>;

function mapAdminKeyword(keyword: KeywordWithUsage) {
  return {
    id: keyword.id,
    name: keyword.name,
    slug: keyword.slug,
    description: keyword.description,
    status: keyword.status,
    aliasOf: keyword.aliasOf,
    aliasCount: keyword._count.aliases,
    prepCount: keyword.preps.length,
    bookCount: new Set(keyword.preps.map((entry) => entry.prep.bookId)).size,
  };
}

const adminKeywordsRoutes: FastifyPluginAsync = async (fastify) => {
  const guardHooks = { onRequest: [fastify.verifyJwt, fastify.requireAdmin] };

  fastify.get("/admin/keywords", guardHooks, async () => {
    const keywords = await prisma.prepKeyword.findMany({ ...keywordWithUsage });

    // Curation works down from the keywords that reach the most books, since those
    // are the ones whose promotion or merge changes the filter the most.
    const mapped = keywords
      .map(mapAdminKeyword)
      .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name));

    return { keywords: mapped };
  });

  fastify.patch("/admin/keywords/:id", guardHooks, async (request) => {
    const params = keywordIdParamsSchema.parse(request.params);
    const body = adminKeywordUpdateSchema.parse(request.body);

    const existing = await prisma.prepKeyword.findUnique({ where: { id: params.id } });

    if (!existing) {
      throw fastify.httpErrors.notFound("Keyword not found.");
    }

    // Leaving ALIAS means the keyword stops redirecting, so the pointer has to go
    // with it or it would keep claiming a target it no longer forwards to.
    const clearsAlias = body.status !== undefined && existing.status === "ALIAS";

    const keyword = await prisma.prepKeyword.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(clearsAlias ? { aliasOfId: null } : {}),
      },
      ...keywordWithUsage,
    });

    return { keyword: mapAdminKeyword(keyword) };
  });

  fastify.post("/admin/keywords/:id/alias", guardHooks, async (request) => {
    const params = keywordIdParamsSchema.parse(request.params);
    const body = adminKeywordAliasSchema.parse(request.body);

    await aliasKeywordInto(fastify, params.id, body.aliasOfId);

    const keyword = await prisma.prepKeyword.findUniqueOrThrow({
      where: { id: params.id },
      ...keywordWithUsage,
    });

    return { keyword: mapAdminKeyword(keyword) };
  });

  fastify.delete("/admin/keywords/:id", guardHooks, async (request, reply) => {
    const params = keywordIdParamsSchema.parse(request.params);

    const keyword = await prisma.prepKeyword.findUnique({
      where: { id: params.id },
      include: { _count: { select: { preps: true, aliases: true } } },
    });

    if (!keyword) {
      throw fastify.httpErrors.notFound("Keyword not found.");
    }

    // Deleting a keyword that is still in use would strip it from those preps
    // silently. Aliasing it onto a canonical keyword is the non-destructive path.
    if (keyword._count.preps > 0) {
      throw fastify.httpErrors.badRequest(
        `Keyword is still attached to ${keyword._count.preps} prep(s). Alias it instead.`
      );
    }

    if (keyword._count.aliases > 0) {
      throw fastify.httpErrors.badRequest(
        `${keyword._count.aliases} keyword(s) alias to this one. Re-point them first.`
      );
    }

    await prisma.prepKeyword.delete({ where: { id: params.id } });

    return reply.code(204).send();
  });
};

export default adminKeywordsRoutes;
