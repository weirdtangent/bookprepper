import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";
import {
  bookSlugParamsSchema,
  listBooksQuerySchema,
  metadataSuggestionBodySchema,
  type ListBooksQuery
} from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";
import { resolveCoverImageUrl } from "../utils/covers.js";

type CatalogStats = {
  books: number;
  authors: number;
  preps: number;
  years: {
    earliest: number | null;
    latest: number | null;
  };
};

type BookListResult = Prisma.BookGetPayload<{
  include: {
    author: true;
    genres: { include: { genre: true } };
    _count: { select: { preps: true } };
  };
}>;

type BookDetailResult = Prisma.BookGetPayload<{
  include: {
    author: true;
    genres: { include: { genre: true } };
    preps: {
      include: {
        keywords: { include: { keyword: true } };
        votes: true;
      };
    };
  };
}>;

type PrepWithRelations = Prisma.BookPrepGetPayload<{
  include: {
    keywords: { include: { keyword: true } };
    votes: true;
  };
}>;

const CATALOG_STATS_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

let catalogStatsCache: {
  expiresAt: number;
  value: CatalogStats;
} | null = null;

const booksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stats", async () => {
    const now = Date.now();
    if (catalogStatsCache && catalogStatsCache.expiresAt > now) {
      return catalogStatsCache.value;
    }

    const stats = await loadCatalogStats();
    catalogStatsCache = {
      value: stats,
      expiresAt: now + CATALOG_STATS_TTL_MS
    };
    return stats;
  });

  fastify.get("/genres", async () => {
    const genres = await prisma.genre.findMany({
      orderBy: { name: "asc" }
    });

    return {
      genres: genres.map((genre) => ({
        id: genre.id,
        name: genre.name,
        slug: genre.slug,
        description: genre.description
      }))
    };
  });

  fastify.get("/authors", async () => {
    const authors = await prisma.author.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { books: true }
        }
      }
    });

    return {
      authors: authors.map((author) => ({
        id: author.id,
        name: author.name,
        slug: author.slug,
        bio: author.bio,
        bookCount: author._count.books
      }))
    };
  });

  fastify.get("/books", async (request) => {
    const query = listBooksQuerySchema.parse(request.query);
    const where = buildBookFilters(query);

    const include = {
      author: true,
      genres: {
        include: {
          genre: true
        }
      },
      _count: {
        select: { preps: true }
      }
    } as const;

    if (query.shuffle) {
      const ids = await prisma.book.findMany({
        where,
        select: { id: true }
      });

      const total = ids.length;
      const shuffledIds = shuffleIds(ids.map((entry) => entry.id));
      const start = (query.page - 1) * query.pageSize;
      const pageIds = shuffledIds.slice(start, start + query.pageSize);

      if (pageIds.length === 0) {
        return {
          pagination: {
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize))
          },
          results: []
        };
      }

      const books = await prisma.book.findMany({
        where: {
          id: { in: pageIds }
        },
        include
      });

      const booksById = new Map(books.map((book) => [book.id, book]));
      const orderedBooks = pageIds
        .map((id) => booksById.get(id))
        .filter((book): book is BookListResult => Boolean(book));

      return {
        pagination: {
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize))
        },
        results: orderedBooks.map(mapBookListResult)
      };
    }

    const totalPromise = prisma.book.count({ where });
    const booksPromise = prisma.book.findMany({
      where,
      orderBy: { title: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include
    });

    const [total, books] = await Promise.all([totalPromise, booksPromise]);

    return {
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize)
      },
      results: books.map(mapBookListResult)
    };
  });

  fastify.get("/books/:slug", async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      include: {
        author: true,
        genres: { include: { genre: true } },
        preps: {
          include: {
            keywords: {
              include: {
                keyword: true
              }
            },
            votes: true
          },
          orderBy: {
            heading: "asc"
          }
        }
      }
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found");
    }

    return mapBookDetail(book);
  });

  fastify.get("/books/:slug/preps", async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        preps: {
          include: {
            keywords: {
              include: { keyword: true }
            },
            votes: true
          },
          orderBy: { heading: "asc" }
        }
      }
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found");
    }

    return {
      slug: params.slug,
      preps: book.preps.map(formatPrep)
    };
  });

  fastify.post(
    "/books/:slug/metadata/suggest",
    { onRequest: [fastify.verifyJwt] },
    async (request) => {
      const params = bookSlugParamsSchema.parse(request.params);
      const body = metadataSuggestionBodySchema.parse(request.body);

      const book = await prisma.book.findUnique({
        where: { slug: params.slug },
        select: { id: true }
      });

      if (!book) {
        throw fastify.httpErrors.notFound("Book not found");
      }

      const user = await ensureUserProfile(request);

      const suggestion = await prisma.bookMetadataSuggestion.create({
        data: {
          bookId: book.id,
          submittedById: user.id,
          suggestedSynopsis: body.synopsis ?? null,
          suggestedGenres: body.genres ?? [],
          status: "PENDING"
        }
      });

      fastify.log.info(`"Received metadata suggestion ${suggestion.id} for book ${book.id}"`);

      return {
        message: "Metadata suggestion submitted",
        suggestionId: suggestion.id,
        status: suggestion.status
      };
    }
  );
};

function buildBookFilters(query: ListBooksQuery): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = {};

  if (query.search) {
    const tokens = tokenizeSearch(query.search);
    if (tokens.length === 0) {
      const searchTerm = query.search.trim();
      where.OR = [
        { title: { contains: searchTerm } },
        { synopsis: { contains: searchTerm } },
        { author: { name: { contains: searchTerm } } },
        { slug: { contains: searchTerm.toLowerCase() } }
      ];
    } else {
      where.AND = tokens.map((token) => ({
        OR: [
          { title: { contains: token } },
          { synopsis: { contains: token } },
          { slug: { contains: token } },
          {
            author: {
              name: { contains: token }
            }
          }
        ]
      }));
    }
  }

  if (query.author) {
    const authorTerm = query.author.trim();
    where.author = {
      OR: [
        { slug: authorTerm },
        { name: { contains: authorTerm } }
      ]
    };
  }

  const genreSlugs =
    query.genres
      ?.split(",")
      .map((slug) => slug.trim())
      .filter(Boolean) ?? [];

  if (genreSlugs.length > 0) {
    where.genres = {
      some: {
        genre: {
          slug: { in: genreSlugs }
        }
      }
    };
  }

  const prepSlugs =
    query.prep
      ?.split(",")
      .map((slug) => slug.trim())
      .filter(Boolean) ?? [];

  if (prepSlugs.length > 0) {
    where.preps = {
      some: {
        keywords: {
          some: {
            keyword: {
              slug: { in: prepSlugs }
            }
          }
        }
      }
    };
  }

  return where;
}

function mapBookDetail(book: BookDetailResult) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    synopsis: book.synopsis,
    coverImageUrl: resolveCoverImageUrl(book, "L"),
    isbn: book.isbn,
    author: {
      id: book.author.id,
      name: book.author.name,
      slug: book.author.slug
    },
    genres: book.genres.map((entry) => ({
      id: entry.genre.id,
      name: entry.genre.name,
      slug: entry.genre.slug
    })),
    preps: book.preps.map(formatPrep)
  };
}

function mapBookListResult(book: BookListResult) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    synopsis: book.synopsis,
    coverImageUrl: resolveCoverImageUrl(book, "M"),
    isbn: book.isbn,
    author: {
      name: book.author.name,
      slug: book.author.slug
    },
    genres: book.genres.map((entry) => ({
      id: entry.genre.id,
      name: entry.genre.name,
      slug: entry.genre.slug
    })),
    prepCount: book._count.preps
  };
}

function formatPrep(prep: PrepWithRelations) {
  const agree = prep.votes.filter((vote) => vote.value === "AGREE").length;
  const disagree = prep.votes.filter((vote) => vote.value === "DISAGREE").length;

  return {
    id: prep.id,
    heading: prep.heading,
    summary: prep.summary,
    watchFor: prep.watchFor,
    colorHint: prep.colorHint,
    keywords: prep.keywords.map((entry) => ({
      slug: entry.keyword.slug,
      name: entry.keyword.name
    })),
    votes: {
      agree,
      disagree
    }
  };
}

export default booksRoutes;

async function loadCatalogStats(): Promise<CatalogStats> {
  const [bookCount, authorCount, prepCount, yearBounds] = await Promise.all([
    prisma.book.count(),
    prisma.author.count(),
    prisma.bookPrep.count(),
    prisma.book.aggregate({
      _min: { publishedYear: true },
      _max: { publishedYear: true }
    })
  ]);

  return {
    books: bookCount,
    authors: authorCount,
    preps: prepCount,
    years: {
      earliest: yearBounds._min.publishedYear ?? null,
      latest: yearBounds._max.publishedYear ?? null
    }
  };
}

function tokenizeSearch(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function shuffleIds<T>(input: T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

