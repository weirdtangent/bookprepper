import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import {
  bookSlugParamsSchema,
  prepParamsSchema,
  prepSuggestionBodySchema,
  voteBodySchema
} from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";

const prepsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/preps/keywords", async () => {
    const keywords = await prisma.prepKeyword.findMany({
      orderBy: { name: "asc" }
    });

    return {
      keywords: keywords.map((keyword) => ({
        id: keyword.id,
        name: keyword.name,
        slug: keyword.slug,
        description: keyword.description
      }))
    };
  });

  fastify.post(
    "/books/:slug/preps/:prepId/vote",
    { onRequest: [fastify.verifyJwt] },
    async (request) => {
      const params = prepParamsSchema.parse(request.params);
      const body = voteBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true }
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const prep = await prisma.bookPrep.findFirst({
        where: { id: params.prepId, bookId: book.id },
        select: { id: true }
      });

      if (!prep) {
        throw fastify.httpErrors.notFound("Prep not found");
      }

      const user = await ensureUserProfile(request);

      await prisma.prepVote.upsert({
        where: {
          prepId_userId: {
            prepId: prep.id,
            userId: user.id
          }
        },
        update: { value: body.value },
        create: {
          prepId: prep.id,
          userId: user.id,
          value: body.value
        }
      });

      const [agree, disagree] = await Promise.all([
        prisma.prepVote.count({ where: { prepId: prep.id, value: "AGREE" } }),
        prisma.prepVote.count({ where: { prepId: prep.id, value: "DISAGREE" } })
      ]);

      fastify.log.info(`"Recorded ${body.value.toLowerCase()} vote for prep ${prep.id}"`);

      return {
        prepId: prep.id,
        votes: {
          agree,
          disagree
        }
      };
    }
  );

  fastify.post(
    "/books/:slug/preps/suggest",
    { onRequest: [fastify.verifyJwt] },
    async (request) => {
      const params = bookSlugParamsSchema.parse(request.params);
      const body = prepSuggestionBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true, title: true }
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const user = await ensureUserProfile(request);

      const suggestion = await prisma.prepSuggestion.create({
        data: {
          bookId: book.id,
          submittedById: user.id,
          title: body.title,
          description: body.description,
          keywordHints: body.keywordHints ?? [],
          status: "PENDING"
        }
      });

      fastify.log.info(`"Received prep suggestion ${suggestion.id} for book ${book.id}"`);

      return {
        message: "Prep suggestion submitted",
        suggestionId: suggestion.id,
        status: suggestion.status
      };
    }
  );
};

export default prepsRoutes;

