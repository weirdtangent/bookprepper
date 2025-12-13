import { describe, it, expect } from "vitest";
import {
  paginationSchema,
  listBooksQuerySchema,
  bookSlugParamsSchema,
  prepParamsSchema,
  prepFeedbackBodySchema,
  readingStatusBodySchema,
  metadataSuggestionBodySchema,
  bookSuggestionBodySchema,
  adminBookCreateSchema,
  adminBookUpdateSchema,
  profileUpdateBodySchema,
} from "./schemas.js";

describe("paginationSchema", () => {
  it("provides default values", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("coerces string numbers", () => {
    const result = paginationSchema.parse({ page: "2", pageSize: "10" });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it("rejects page less than 1", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: -1 })).toThrow();
  });

  it("rejects pageSize greater than 50", () => {
    expect(() => paginationSchema.parse({ pageSize: 51 })).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => paginationSchema.parse({ page: 1.5 })).toThrow();
  });
});

describe("listBooksQuerySchema", () => {
  it("provides default values", () => {
    const result = listBooksQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.shuffle).toBe(false);
  });

  it("parses search parameter", () => {
    const result = listBooksQuerySchema.parse({ search: "test" });
    expect(result.search).toBe("test");
  });

  it("trims search parameter", () => {
    const result = listBooksQuerySchema.parse({ search: "  test  " });
    expect(result.search).toBe("test");
  });

  it("rejects empty search after trim", () => {
    expect(() => listBooksQuerySchema.parse({ search: "   " })).toThrow();
  });

  it("parses shuffle as boolean", () => {
    expect(listBooksQuerySchema.parse({ shuffle: true }).shuffle).toBe(true);
    expect(listBooksQuerySchema.parse({ shuffle: false }).shuffle).toBe(false);
    // Note: coerce.boolean treats non-empty strings as truthy
    expect(listBooksQuerySchema.parse({ shuffle: "true" }).shuffle).toBe(true);
  });
});

describe("bookSlugParamsSchema", () => {
  it("accepts valid slug", () => {
    const result = bookSlugParamsSchema.parse({ slug: "the-great-gatsby" });
    expect(result.slug).toBe("the-great-gatsby");
  });

  it("rejects empty slug", () => {
    expect(() => bookSlugParamsSchema.parse({ slug: "" })).toThrow();
  });
});

describe("prepParamsSchema", () => {
  it("accepts valid params", () => {
    const result = prepParamsSchema.parse({
      slug: "book-slug",
      prepId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(result.slug).toBe("book-slug");
    expect(result.prepId).toMatch(/^cl/);
  });

  it("rejects invalid cuid format for prepId", () => {
    expect(() => prepParamsSchema.parse({ slug: "book", prepId: "invalid" })).toThrow();
  });
});

describe("prepFeedbackBodySchema", () => {
  it("accepts valid feedback", () => {
    const result = prepFeedbackBodySchema.parse({
      value: "AGREE",
      dimension: "CORRECT",
    });
    expect(result.value).toBe("AGREE");
    expect(result.dimension).toBe("CORRECT");
  });

  it("defaults dimension to CORRECT", () => {
    const result = prepFeedbackBodySchema.parse({ value: "DISAGREE" });
    expect(result.dimension).toBe("CORRECT");
  });

  it("accepts optional note", () => {
    const result = prepFeedbackBodySchema.parse({
      value: "AGREE",
      note: "Great insight!",
    });
    expect(result.note).toBe("Great insight!");
  });

  it("trims and limits note length", () => {
    const longNote = "a".repeat(600);
    expect(() => prepFeedbackBodySchema.parse({ value: "AGREE", note: longNote })).toThrow();
  });

  it("rejects invalid dimension", () => {
    expect(() => prepFeedbackBodySchema.parse({ value: "AGREE", dimension: "INVALID" })).toThrow();
  });
});

describe("readingStatusBodySchema", () => {
  it("accepts READING status", () => {
    const result = readingStatusBodySchema.parse({ status: "READING" });
    expect(result.status).toBe("READING");
  });

  it("accepts DONE status", () => {
    const result = readingStatusBodySchema.parse({ status: "DONE" });
    expect(result.status).toBe("DONE");
  });

  it("allows undefined status", () => {
    const result = readingStatusBodySchema.parse({});
    expect(result.status).toBeUndefined();
  });

  it("rejects invalid status", () => {
    expect(() => readingStatusBodySchema.parse({ status: "INVALID" })).toThrow();
  });
});

describe("metadataSuggestionBodySchema", () => {
  it("accepts synopsis only", () => {
    const result = metadataSuggestionBodySchema.parse({
      synopsis: "A tale of adventure and discovery spanning multiple continents.",
    });
    expect(result.synopsis).toBeDefined();
  });

  it("accepts genres only", () => {
    const result = metadataSuggestionBodySchema.parse({
      genres: ["fiction", "adventure"],
    });
    expect(result.genres).toEqual(["fiction", "adventure"]);
  });

  it("requires synopsis or genres", () => {
    expect(() => metadataSuggestionBodySchema.parse({})).toThrow();
    expect(() => metadataSuggestionBodySchema.parse({ genres: [] })).toThrow();
  });

  it("rejects synopsis under 40 chars", () => {
    expect(() => metadataSuggestionBodySchema.parse({ synopsis: "Too short" })).toThrow();
  });
});

describe("bookSuggestionBodySchema", () => {
  it("accepts valid book suggestion", () => {
    const result = bookSuggestionBodySchema.parse({
      title: "The Great Novel",
      authorName: "John Doe",
    });
    expect(result.title).toBe("The Great Novel");
    expect(result.authorName).toBe("John Doe");
  });

  it("accepts optional fields", () => {
    const result = bookSuggestionBodySchema.parse({
      title: "The Great Novel",
      authorName: "John Doe",
      notes: "A classic work",
      genreIdeas: ["fiction"],
      prepIdeas: ["trace themes"],
    });
    expect(result.notes).toBe("A classic work");
    expect(result.genreIdeas).toEqual(["fiction"]);
    expect(result.prepIdeas).toEqual(["trace themes"]);
  });

  it("rejects title too short", () => {
    expect(() => bookSuggestionBodySchema.parse({ title: "Ab", authorName: "Author" })).toThrow();
  });
});

describe("adminBookCreateSchema", () => {
  it("requires authorId or authorName", () => {
    expect(() => adminBookCreateSchema.parse({ title: "Test Book" })).toThrow();
  });

  it("accepts authorName without authorId", () => {
    const result = adminBookCreateSchema.parse({
      title: "Test Book",
      authorName: "Test Author",
    });
    expect(result.authorName).toBe("Test Author");
  });

  it("validates slug format", () => {
    const result = adminBookCreateSchema.parse({
      title: "Test Book",
      authorName: "Author",
      slug: "valid-slug-123",
    });
    expect(result.slug).toBe("valid-slug-123");

    expect(() =>
      adminBookCreateSchema.parse({
        title: "Test",
        authorName: "Author",
        slug: "Invalid Slug!",
      })
    ).toThrow();
  });

  it("validates ISBN format", () => {
    const result = adminBookCreateSchema.parse({
      title: "Test Book",
      authorName: "Author",
      isbn: "978-0-306-40615-7",
    });
    expect(result.isbn).toBeDefined();

    expect(() =>
      adminBookCreateSchema.parse({
        title: "Test",
        authorName: "Author",
        isbn: "invalid!",
      })
    ).toThrow();
  });
});

describe("adminBookUpdateSchema", () => {
  it("allows empty update", () => {
    const result = adminBookUpdateSchema.parse({});
    expect(result).toBeDefined();
  });

  it("transforms empty string to null for optional fields", () => {
    const result = adminBookUpdateSchema.parse({
      synopsis: "",
      coverImageUrl: "",
      isbn: "",
    });
    expect(result.synopsis).toBeNull();
    expect(result.coverImageUrl).toBeNull();
    expect(result.isbn).toBeNull();
  });

  it("preserves valid values", () => {
    const result = adminBookUpdateSchema.parse({
      title: "Updated Title",
      synopsis: "Updated synopsis content",
    });
    expect(result.title).toBe("Updated Title");
    expect(result.synopsis).toBe("Updated synopsis content");
  });
});

describe("profileUpdateBodySchema", () => {
  it("accepts displayName update", () => {
    const result = profileUpdateBodySchema.parse({ displayName: "New Name" });
    expect(result.displayName).toBe("New Name");
  });

  it("accepts preferences update", () => {
    const result = profileUpdateBodySchema.parse({
      preferences: { shuffleDefault: true },
    });
    expect(result.preferences?.shuffleDefault).toBe(true);
  });

  it("requires at least one field", () => {
    expect(() => profileUpdateBodySchema.parse({})).toThrow();
    expect(() => profileUpdateBodySchema.parse({ preferences: {} })).toThrow();
  });

  it("trims displayName", () => {
    const result = profileUpdateBodySchema.parse({
      displayName: "  Trimmed Name  ",
    });
    expect(result.displayName).toBe("Trimmed Name");
  });
});
