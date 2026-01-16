import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";
import {
  bookSlugParamsSchema,
  prepFeedbackBodySchema,
  prepParamsSchema,
  prepSuggestionBodySchema,
  quoteParamsSchema,
  quoteCreateBodySchema,
  quoteVoteBodySchema,
  quoteSearchQuerySchema,
} from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";
import {
  createEmptyDimensionBreakdown,
  summaryFromScoreRecord,
  syncPromptScore,
  toVotesPayload,
} from "../utils/promptScores.js";
import {
  externalApiRateLimit,
  expensiveQueryRateLimit,
  writeOperationRateLimit,
} from "../utils/rate-limit-configs.js";

const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";

type GoogleBooksResult = {
  totalItems: number;
  items?: Array<{
    id: string;
    volumeInfo: {
      title: string;
      authors?: string[];
      publisher?: string;
      publishedDate?: string;
      previewLink?: string;
      infoLink?: string;
    };
    searchInfo?: {
      textSnippet?: string;
    };
  }>;
};

function formatQuoteWithVotes(quote: {
  id: string;
  text: string;
  pageNumber: string | null;
  chapter: string | null;
  verified: boolean;
  verifiedSource: string | null;
  createdAt: Date;
  user: { id: string; displayName: string };
  votes: Array<{ value: string }>;
}) {
  const agreeCount = quote.votes.filter((v) => v.value === "AGREE").length;
  const disagreeCount = quote.votes.filter((v) => v.value === "DISAGREE").length;

  return {
    id: quote.id,
    text: quote.text,
    pageNumber: quote.pageNumber,
    chapter: quote.chapter,
    verified: quote.verified,
    verifiedSource: quote.verifiedSource,
    createdAt: quote.createdAt.toISOString(),
    user: {
      id: quote.user.id,
      displayName: quote.user.displayName,
    },
    votes: {
      agree: agreeCount,
      disagree: disagreeCount,
      total: agreeCount + disagreeCount,
    },
  };
}

const prepsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/preps/keywords", async () => {
    const keywords = await prisma.prepKeyword.findMany({
      orderBy: { name: "asc" },
    });

    return {
      keywords: keywords.map((keyword) => ({
        id: keyword.id,
        name: keyword.name,
        slug: keyword.slug,
        description: keyword.description,
      })),
    };
  });

  fastify.post(
    "/books/:slug/preps/:prepId/vote",
    {
      onRequest: [fastify.verifyJwt],
      config: {
        rateLimit: writeOperationRateLimit, // Write operation with database upserts
      },
    },
    async (request) => {
      const params = prepParamsSchema.parse(request.params);
      const body = prepFeedbackBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true },
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const prep = await prisma.bookPrep.findFirst({
        where: { id: params.prepId, bookId: book.id },
        select: { id: true },
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
              userId: user.id,
            },
          },
          update: { value: body.value },
          create: {
            prepId: prep.id,
            userId: user.id,
            value: body.value,
          },
        }),
        prisma.promptFeedback.upsert({
          where: {
            prepId_userId_dimension: {
              prepId: prep.id,
              userId: user.id,
              dimension: body.dimension,
            },
          },
          update: {
            value: body.value,
            note: body.note ?? null,
          },
          create: {
            prepId: prep.id,
            userId: user.id,
            value: body.value,
            dimension: body.dimension,
            note: body.note ?? null,
          },
        }),
      ]);

      const summary = await syncPromptScore(prep.id);

      fastify.log.info(
        `"Recorded ${body.value.toLowerCase()} ${body.dimension.toLowerCase()} feedback for prep ${prep.id}"`
      );

      return {
        prepId: prep.id,
        votes: toVotesPayload(summary),
      };
    }
  );

  fastify.post(
    "/books/:slug/preps/suggest",
    {
      onRequest: [fastify.verifyJwt],
      config: {
        rateLimit: writeOperationRateLimit, // Write operation
      },
    },
    async (request) => {
      const params = bookSlugParamsSchema.parse(request.params);
      const body = prepSuggestionBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true, title: true },
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
          status: "PENDING",
        },
      });

      fastify.log.info(`"Received prep suggestion ${suggestion.id} for book ${book.id}"`);

      return {
        message: "Prep suggestion submitted",
        suggestionId: suggestion.id,
        status: suggestion.status,
      };
    }
  );

  fastify.get(
    "/preps/feedback/insights",
    {
      onRequest: [fastify.verifyJwt],
      config: {
        rateLimit: expensiveQueryRateLimit, // Very expensive triple Promise.all query
      },
    },
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
              slug: true,
            },
          },
        },
      } as const;

      const [topScores, lowestScores, recentFeedback] = await Promise.all([
        prisma.promptScore.findMany({
          where: { totalCount: { gt: 0 } },
          take: 6,
          orderBy: [{ score: "desc" }, { totalCount: "desc" }, { prepId: "asc" }],
          include: {
            prep: selectPrep,
          },
        }),
        prisma.promptScore.findMany({
          where: { totalCount: { gt: 0 } },
          take: 6,
          orderBy: [{ score: "asc" }, { totalCount: "desc" }, { prepId: "asc" }],
          include: {
            prep: selectPrep,
          },
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
                    slug: true,
                  },
                },
              },
            },
          },
        }),
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
            heading: entry.prep.heading,
          },
          book: {
            id: entry.prep.book.id,
            title: entry.prep.book.title,
            slug: entry.prep.book.slug,
          },
        })),
      };
    }
  );

  // Quote routes
  fastify.get("/books/:slug/preps/:prepId/quotes", async (request) => {
    const params = prepParamsSchema.parse(request.params);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found");
    }

    const prep = await prisma.bookPrep.findFirst({
      where: { id: params.prepId, bookId: book.id },
      select: { id: true },
    });

    if (!prep) {
      throw fastify.httpErrors.notFound("Prep not found");
    }

    const quotes = await prisma.prepQuote.findMany({
      where: { prepId: prep.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
        votes: {
          select: { value: true },
        },
      },
    });

    return {
      quotes: quotes.map(formatQuoteWithVotes),
    };
  });

  fastify.post(
    "/books/:slug/preps/:prepId/quotes",
    {
      onRequest: [fastify.verifyJwt],
      config: {
        rateLimit: externalApiRateLimit, // Strict limit due to Google Books API call
      },
    },
    async (request) => {
      const params = prepParamsSchema.parse(request.params);
      const body = quoteCreateBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true, title: true, author: { select: { name: true } } },
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const prep = await prisma.bookPrep.findFirst({
        where: { id: params.prepId, bookId: book.id },
        select: { id: true, heading: true },
      });

      if (!prep) {
        throw fastify.httpErrors.notFound("Prep not found");
      }

      const user = await ensureUserProfile(request);

      // Try to verify quote via Google Books API
      let verified = false;
      let verifiedSource: string | null = null;

      try {
        const searchText = body.text.slice(0, 100);
        const searchQuery = `"${searchText}" ${book.title} ${book.author.name}`;
        const url = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(searchQuery)}&maxResults=3`;
        const response = await fetch(url);

        if (response.ok) {
          const data = (await response.json()) as GoogleBooksResult;
          if (data.totalItems > 0 && data.items && data.items.length > 0) {
            const match = data.items.find((item) => {
              const titleMatch = item.volumeInfo.title
                ?.toLowerCase()
                .includes(book.title.toLowerCase());
              const authorMatch = item.volumeInfo.authors?.some((author) =>
                author.toLowerCase().includes(book.author.name.toLowerCase())
              );
              return titleMatch || authorMatch;
            });

            if (match) {
              verified = true;
              verifiedSource = match.volumeInfo.infoLink ?? match.volumeInfo.previewLink ?? null;
            }
          }
        }
      } catch (error) {
        fastify.log.warn(`"Failed to verify quote via Google Books: ${String(error)}"`);
      }

      const quote = await prisma.prepQuote.create({
        data: {
          prepId: prep.id,
          userId: user.id,
          text: body.text,
          pageNumber: body.pageNumber ?? null,
          chapter: body.chapter ?? null,
          verified,
          verifiedSource,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
          votes: {
            select: { value: true },
          },
        },
      });

      fastify.log.info(
        `"Created quote ${quote.id} for prep '${prep.heading}' on book '${book.title}' (verified: ${verified})"`
      );

      return {
        quote: formatQuoteWithVotes(quote),
      };
    }
  );

  // Vote on a quote
  fastify.post(
    "/books/:slug/preps/:prepId/quotes/:quoteId/vote",
    {
      onRequest: [fastify.verifyJwt],
      config: {
        rateLimit: writeOperationRateLimit, // Write operation
      },
    },
    async (request) => {
      const params = quoteParamsSchema.parse(request.params);
      const body = quoteVoteBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true },
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const prep = await prisma.bookPrep.findFirst({
        where: { id: params.prepId, bookId: book.id },
        select: { id: true },
      });

      if (!prep) {
        throw fastify.httpErrors.notFound("Prep not found");
      }

      const quote = await prisma.prepQuote.findFirst({
        where: { id: params.quoteId, prepId: prep.id },
        select: { id: true },
      });

      if (!quote) {
        throw fastify.httpErrors.notFound("Quote not found");
      }

      const user = await ensureUserProfile(request);

      await prisma.quoteVote.upsert({
        where: {
          quoteId_userId: {
            quoteId: quote.id,
            userId: user.id,
          },
        },
        update: { value: body.value },
        create: {
          quoteId: quote.id,
          userId: user.id,
          value: body.value,
        },
      });

      const votes = await prisma.quoteVote.findMany({
        where: { quoteId: quote.id },
        select: { value: true },
      });

      const agreeCount = votes.filter((v) => v.value === "AGREE").length;
      const disagreeCount = votes.filter((v) => v.value === "DISAGREE").length;

      fastify.log.info(
        `"Recorded ${body.value.toLowerCase()} vote on quote ${quote.id} by user '${user.displayName}'"`
      );

      return {
        quoteId: quote.id,
        votes: {
          agree: agreeCount,
          disagree: disagreeCount,
          total: agreeCount + disagreeCount,
        },
      };
    }
  );

  // Search for quote in Google Books
  fastify.get(
    "/quotes/search",
    {
      config: {
        rateLimit: externalApiRateLimit, // Strict limit due to Google Books API call
      },
    },
    async (request) => {
      const query = quoteSearchQuerySchema.parse(request.query);

      let searchQuery = `"${query.text}"`;
      if (query.bookTitle) {
        searchQuery += ` intitle:${query.bookTitle}`;
      }
      if (query.authorName) {
        searchQuery += ` inauthor:${query.authorName}`;
      }

      const url = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(searchQuery)}&maxResults=5`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Google Books API returned ${response.status}`);
        }

        const data = (await response.json()) as GoogleBooksResult;

        return {
          found: data.totalItems > 0,
          results: (data.items ?? []).map((item) => ({
            bookId: item.id,
            title: item.volumeInfo.title,
            authors: item.volumeInfo.authors ?? [],
            publisher: item.volumeInfo.publisher,
            publishedDate: item.volumeInfo.publishedDate,
            previewLink: item.volumeInfo.previewLink,
            infoLink: item.volumeInfo.infoLink,
            textSnippet: item.searchInfo?.textSnippet,
          })),
        };
      } catch (error) {
        fastify.log.error(`"Google Books search failed: ${String(error)}"`);
        throw fastify.httpErrors.serviceUnavailable("Quote search temporarily unavailable");
      }
    }
  );

  fastify.delete(
    "/books/:slug/preps/:prepId/quotes/:quoteId",
    {
      onRequest: [fastify.verifyJwt],
      config: {
        rateLimit: writeOperationRateLimit, // Write operation (delete)
      },
    },
    async (request) => {
      const params = quoteParamsSchema.parse(request.params);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true },
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const prep = await prisma.bookPrep.findFirst({
        where: { id: params.prepId, bookId: book.id },
        select: { id: true },
      });

      if (!prep) {
        throw fastify.httpErrors.notFound("Prep not found");
      }

      const quote = await prisma.prepQuote.findFirst({
        where: { id: params.quoteId, prepId: prep.id },
        select: { id: true, userId: true },
      });

      if (!quote) {
        throw fastify.httpErrors.notFound("Quote not found");
      }

      const user = await ensureUserProfile(request);
      const isOwner = quote.userId === user.id;
      const isAdmin = user.role === "ADMIN" || user.role === "CURATOR";

      if (!isOwner && !isAdmin) {
        throw fastify.httpErrors.forbidden("You can only delete your own quotes");
      }

      await prisma.prepQuote.delete({
        where: { id: quote.id },
      });

      fastify.log.info(`"Deleted quote ${quote.id} by user '${user.displayName}'"`);

      return { message: "Quote deleted" };
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
    dimensions: createEmptyDimensionBreakdown(),
  };

  return {
    prepId: entry.prepId,
    heading: entry.prep.heading,
    summary: entry.prep.summary,
    book: {
      id: entry.prep.book.id,
      title: entry.prep.book.title,
      slug: entry.prep.book.slug,
    },
    votes: toVotesPayload(summary),
  };
}
