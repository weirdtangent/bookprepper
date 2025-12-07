import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";
import {
  bookSlugParamsSchema,
  prepFeedbackBodySchema,
  prepParamsSchema,
  prepSuggestionBodySchema
} from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";
import {
  createEmptyDimensionBreakdown,
  summaryFromScoreRecord,
  syncPromptScore,
  toVotesPayload
} from "../utils/promptScores.js";

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
      const body = prepFeedbackBodySchema.parse(request.body);

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

      await Promise.all([
        prisma.prepVote.upsert({
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
        }),
        prisma.promptFeedback.upsert({
          where: {
            prepId_userId_dimension: {
              prepId: prep.id,
              userId: user.id,
              dimension: body.dimension
            }
          },
          update: {
            value: body.value,
            note: body.note ?? null
          },
          create: {
            prepId: prep.id,
            userId: user.id,
            value: body.value,
            dimension: body.dimension,
            note: body.note ?? null
          }
        })
      ]);

      const summary = await syncPromptScore(prep.id);

      fastify.log.info(
        `"Recorded ${body.value.toLowerCase()} ${body.dimension.toLowerCase()} feedback for prep ${prep.id}"`
      );

      return {
        prepId: prep.id,
        votes: toVotesPayload(summary)
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

  fastify.get(
    "/preps/feedback/insights",
    { onRequest: [fastify.verifyJwt] },
    async (request) => {
      const user = await ensureUserProfile(request);
      if (user.role === "MEMBER") {
        throw fastify.httpErrors.forbidden("Administrator access required");
      }

      const selectPrep = {
        select: {
          id: true,
          heading: true,
          summary: true,
          book: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      } as const;

      const [topScores, lowestScores, recentFeedback] = await Promise.all([
        prisma.promptScore.findMany({
          where: { totalCount: { gt: 0 } },
          take: 6,
          orderBy: [
            { score: "desc" },
            { totalCount: "desc" },
            { prepId: "asc" }
          ],
          include: {
            prep: selectPrep
          }
        }),
        prisma.promptScore.findMany({
          where: { totalCount: { gt: 0 } },
          take: 6,
          orderBy: [
            { score: "asc" },
            { totalCount: "desc" },
            { prepId: "asc" }
          ],
          include: {
            prep: selectPrep
          }
        }),
        prisma.promptFeedback.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            prep: {
              select: {
                id: true,
                heading: true,
                book: {
                  select: {
                    id: true,
                    title: true,
                    slug: true
                  }
                }
              }
            }
          }
        })
      ]);

      return {
        topPrompts: topScores.map(mapScoreEntry),
        needsAttention: lowestScores.map(mapScoreEntry),
        recentFeedback: recentFeedback.map((entry) => ({
          id: entry.id,
          dimension: entry.dimension,
          value: entry.value,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
          prep: {
            id: entry.prep.id,
            heading: entry.prep.heading
          },
          book: {
            id: entry.prep.book.id,
            title: entry.prep.book.title,
            slug: entry.prep.book.slug
          }
        }))
      };
    }
  );
};

export default prepsRoutes;

type PromptScoreWithPrep = Prisma.PromptScoreGetPayload<{
  include: {
    prep: {
      select: {
        id: true;
        heading: true;
        summary: true;
        book: {
          select: {
            id: true;
            title: true;
            slug: true;
          };
        };
      };
    };
  };
}>;

function mapScoreEntry(entry: PromptScoreWithPrep) {
  const summary = summaryFromScoreRecord(entry) ?? {
    agree: entry.agreeCount,
    disagree: entry.disagreeCount,
    total: entry.totalCount,
    score: Number(entry.score ?? 0),
    dimensions: createEmptyDimensionBreakdown()
  };

  return {
    prepId: entry.prepId,
    heading: entry.prep.heading,
    summary: entry.prep.summary,
    book: {
      id: entry.prep.book.id,
      title: entry.prep.book.title,
      slug: entry.prep.book.slug
    },
    votes: toVotesPayload(summary)
  };
}

