import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";
import {
  adminBookCreateSchema,
  adminBookUpdateSchema,
  adminListBooksQuerySchema,
  adminModerationNoteSchema,
  adminPrepUpsertSchema,
  bookSlugParamsSchema,
  prepParamsSchema,
  suggestionIdParamsSchema
} from "../schemas.js";
import { normalizeIsbn } from "../utils/isbn.js";

const adminBookDetailInclude = {
  include: {
    author: true,
    genres: {
      include: {
        genre: true
      },
      orderBy: {
        genre: {
          name: "asc"
        }
      }
    },
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
        updatedAt: "desc"
      }
    }
  }
} as const;

const adminPrepInclude = {
  include: {
    keywords: {
      include: {
        keyword: true
      }
    },
    votes: true
  }
} as const;

type AdminBookDetail = Prisma.BookGetPayload<typeof adminBookDetailInclude>;
type AdminPrepDetail = Prisma.BookPrepGetPayload<typeof adminPrepInclude>;

const adminRoutes: FastifyPluginAsync = async (fastify) => {
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
            select: { preps: true }
          }
        }
      })
    ]);

    return {
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize)
      },
      results: books.map((book) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
        author: {
          id: book.author.id,
          name: book.author.name
        },
        synopsis: book.synopsis,
        isbn: book.isbn,
        prepCount: book._count.preps,
        updatedAt: book.updatedAt
      }))
    };
  });

  fastify.get("/admin/books/:slug", guardHooks, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      ...adminBookDetailInclude
    });

    if (!book) {
      throw fastify.httpErrors.notFound("Book not found.");
    }

    return {
      book: mapAdminBook(book)
    };
  });

  fastify.post("/admin/books", guardHooks, async (request) => {
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
        authorId
      }
    });

    if (body.genreIds?.length) {
      const genreIds = await validateGenreIds(fastify, body.genreIds);
      await syncBookGenres(createdBook.id, genreIds);
    }

    const fullBook = await prisma.book.findUnique({
      where: { id: createdBook.id },
      ...adminBookDetailInclude
    });

    return {
      book: mapAdminBook(fullBook!)
    };
  });

  fastify.patch("/admin/books/:slug", guardHooks, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);
    const body = adminBookUpdateSchema.parse(request.body ?? {});

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true }
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
        data: updates
      });
    }

    if (body.genreIds) {
      const genreIds = await validateGenreIds(fastify, body.genreIds);
      await syncBookGenres(book.id, genreIds);
    }

    const fullBook = await prisma.book.findUnique({
      where: { id: book.id },
      ...adminBookDetailInclude
    });

    return {
      book: mapAdminBook(fullBook!)
    };
  });

  fastify.post("/admin/books/:slug/preps", guardHooks, async (request) => {
    const params = bookSlugParamsSchema.parse(request.params);
    const body = adminPrepUpsertSchema.parse(request.body);

    const book = await prisma.book.findUnique({
      where: { slug: params.slug },
      select: { id: true }
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
            keywordId: keyword.id
          }))
        }
      },
      ...adminPrepInclude
    });

    return {
      prep: mapAdminPrep(prep)
    };
  });

  fastify.put("/admin/books/:slug/preps/:prepId", guardHooks, async (request) => {
    const params = prepParamsSchema.parse(request.params);
    const body = adminPrepUpsertSchema.parse(request.body);

    const prep = await prisma.bookPrep.findFirst({
      where: { id: params.prepId, book: { slug: params.slug } },
      select: { id: true }
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
            keywordId: keyword.id
          }))
        }
      },
      ...adminPrepInclude
    });

    return {
      prep: mapAdminPrep(updatedPrep)
    };
  });

  fastify.delete("/admin/books/:slug/preps/:prepId", guardHooks, async (request) => {
    const params = prepParamsSchema.parse(request.params);

    const prep = await prisma.bookPrep.findFirst({
      where: { id: params.prepId, book: { slug: params.slug } },
      select: { id: true }
    });

    if (!prep) {
      throw fastify.httpErrors.notFound("Prep not found for that book.");
    }

    await prisma.bookPrep.delete({
      where: { id: prep.id }
    });

    return {
      message: "Prep removed."
    };
  });

  fastify.get("/admin/suggestions/metadata", guardHooks, async () => {
    const suggestions = await prisma.bookMetadataSuggestion.findMany({
      where: { status: "PENDING" },
      include: {
        book: {
          select: { id: true, slug: true, title: true }
        },
        submittedBy: {
          select: { id: true, displayName: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return {
      suggestions: suggestions.map((suggestion) => ({
        id: suggestion.id,
        book: suggestion.book,
        submittedBy: suggestion.submittedBy,
        synopsis: suggestion.suggestedSynopsis,
        genres: extractStringArray(suggestion.suggestedGenres),
        status: suggestion.status,
        createdAt: suggestion.createdAt
      }))
    };
  });

  fastify.post(
    "/admin/suggestions/metadata/:id/approve",
    guardHooks,
    async (request) => {
      const params = suggestionIdParamsSchema.parse(request.params);
      const body = adminModerationNoteSchema.parse(request.body ?? {});

      const suggestion = await prisma.bookMetadataSuggestion.findUnique({
        where: { id: params.id }
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
              synopsis: truncatedSynopsis
            }
          });
        }

        if (genreSlugs.length > 0) {
          const genres = await tx.genre.findMany({
            where: {
              slug: {
                in: genreSlugs
              }
            },
            select: { id: true }
          });

          await tx.bookGenre.deleteMany({
            where: { bookId: suggestion.bookId }
          });

          if (genres.length > 0) {
            await tx.bookGenre.createMany({
              data: genres.map((genre) => ({
                bookId: suggestion.bookId,
                genreId: genre.id
              }))
            });
          }
        }

        await tx.bookMetadataSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: "APPROVED",
            moderatorNote: body.note ?? null,
            reviewedAt: new Date()
          }
        });
      });

      return {
        suggestionId: suggestion.id,
        status: "APPROVED"
      };
    }
  );

  fastify.post(
    "/admin/suggestions/metadata/:id/reject",
    guardHooks,
    async (request) => {
      const params = suggestionIdParamsSchema.parse(request.params);
      const body = adminModerationNoteSchema.parse(request.body ?? {});

      const suggestion = await prisma.bookMetadataSuggestion.findUnique({
        where: { id: params.id }
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
          reviewedAt: new Date()
        }
      });

      return {
        suggestionId: suggestion.id,
        status: "REJECTED"
      };
    }
  );

  fastify.get("/admin/suggestions/preps", guardHooks, async () => {
    const suggestions = await prisma.prepSuggestion.findMany({
      where: { status: "PENDING" },
      include: {
        book: {
          select: { id: true, slug: true, title: true }
        },
        submittedBy: {
          select: { id: true, displayName: true }
        }
      },
      orderBy: { createdAt: "asc" }
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
        createdAt: suggestion.createdAt
      }))
    };
  });

  fastify.post("/admin/suggestions/preps/:id/approve", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    const body = adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.prepSuggestion.findUnique({
      where: { id: params.id }
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
            keywordId: keyword.id
          }))
        }
      },
      ...adminPrepInclude
    });

    await prisma.prepSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: "APPROVED",
        moderatorNote: body.note ?? null,
        reviewedAt: new Date()
      }
    });

    return {
      prep: mapAdminPrep(prep)
    };
  });

  fastify.post("/admin/suggestions/preps/:id/reject", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    const body = adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.prepSuggestion.findUnique({
      where: { id: params.id }
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
        reviewedAt: new Date()
      }
    });

    return {
      suggestionId: suggestion.id,
      status: "REJECTED"
    };
  });

  fastify.get("/admin/suggestions/books", guardHooks, async () => {
    const suggestions = await prisma.bookSuggestion.findMany({
      where: { status: "PENDING" },
      include: {
        submittedBy: {
          select: { id: true, displayName: true }
        }
      },
      orderBy: { createdAt: "asc" }
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
        createdAt: suggestion.createdAt
      }))
    };
  });

  fastify.post("/admin/suggestions/books/:id/approve", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.bookSuggestion.findUnique({
      where: { id: params.id }
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
        authorId
      }
    });

    const genreIdeas = extractStringArray(suggestion.genreIdeas);
    if (genreIdeas.length > 0) {
      const genreRecords = await ensureGenresFromNames(genreIdeas);
      await syncBookGenres(newBook.id, genreRecords.map((genre) => genre.id));
    }

    await prisma.bookSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date()
      }
    });

    return {
      book: {
        id: newBook.id,
        slug: newBook.slug,
        title: newBook.title
      }
    };
  });

  fastify.post("/admin/suggestions/books/:id/reject", guardHooks, async (request) => {
    const params = suggestionIdParamsSchema.parse(request.params);
    adminModerationNoteSchema.parse(request.body ?? {});

    const suggestion = await prisma.bookSuggestion.findUnique({
      where: { id: params.id }
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
        reviewedAt: new Date()
      }
    });

    return {
      suggestionId: suggestion.id,
      status: "REJECTED"
    };
  });
};

export default adminRoutes;

function buildBookSearchWhere(search?: string) {
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
            name: { contains: fallback, mode: "insensitive" }
          }
        }
      ]
    };
  }

  return {
    AND: tokens.map((token) => ({
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { slug: { contains: token } },
        {
          author: {
            name: { contains: token, mode: "insensitive" }
          }
        }
      ]
    }))
  };
}

function mapAdminBook(book: AdminBookDetail) {
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
      slug: book.author.slug
    },
    genres: book.genres.map((entry) => ({
      id: entry.genre.id,
      name: entry.genre.name,
      slug: entry.genre.slug
    })),
    preps: book.preps.map(mapAdminPrep),
    updatedAt: book.updatedAt
  };
}

function mapAdminPrep(prep: AdminPrepDetail) {
  const agree = prep.votes.filter((vote) => vote.value === "AGREE").length;
  const disagree = prep.votes.filter((vote) => vote.value === "DISAGREE").length;

  return {
    id: prep.id,
    heading: prep.heading,
    summary: prep.summary,
    watchFor: prep.watchFor,
    colorHint: prep.colorHint,
    keywords: prep.keywords.map((entry) => ({
      id: entry.keyword.id,
      slug: entry.keyword.slug,
      name: entry.keyword.name
    })),
    votes: {
      agree,
      disagree
    },
    updatedAt: prep.updatedAt
  };
}

async function resolveAuthorId(authorId?: string, authorName?: string) {
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
      slug
    }
  });

  return author.id;
}

async function validateGenreIds(fastify: FastifyInstance, genreIds: string[]) {
  const uniqueIds = [...new Set(genreIds)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const genres = await prisma.genre.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true }
  });

  if (genres.length !== uniqueIds.length) {
    throw fastify.httpErrors.badRequest("One or more genres do not exist.");
  }

  return uniqueIds;
}

async function syncBookGenres(bookId: string, genreIds: string[]) {
  await prisma.bookGenre.deleteMany({
    where: { bookId }
  });

  if (genreIds.length === 0) {
    return;
  }

  await prisma.bookGenre.createMany({
    data: genreIds.map((genreId) => ({
      bookId,
      genreId
    })),
    skipDuplicates: true
  });
}

async function upsertKeywords(keywordNames: string[]) {
  const cleaned = Array.from(
    new Set(
      keywordNames
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

  if (cleaned.length === 0) {
    return [];
  }

  return Promise.all(
    cleaned.map((name) => {
      const slug = slugify(name);
      return prisma.prepKeyword.upsert({
        where: { slug },
        update: { name },
        create: { name, slug }
      });
    })
  );
}

async function ensureUniqueSlug(type: "book" | "author" | "genre", rawValue: string) {
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

async function ensureGenresFromNames(names: string[]) {
  const cleaned = Array.from(
    new Set(
      names
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

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
          slug
        }
      });
    }
    genres.push(genre);
  }

  return genres;
}

function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-");
  return slug || "item";
}

function tokenizeSearch(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }
  return normalized.split(/\s+/);
}

function truncateSynopsis(value?: string | null) {
  if (!value) {
    return null;
  }
  return value.length > 1024 ? value.slice(0, 1024) : value;
}

