import { describe, it, expect, vi } from "vitest";

// Mock the db module before importing promptScores
vi.mock("db", () => ({
  prisma: {
    promptFeedback: {
      groupBy: vi.fn(),
    },
    promptScore: {
      upsert: vi.fn(),
    },
  },
}));

// Now import the module under test
import {
  calculatePromptScore,
  createEmptyDimensionBreakdown,
  summarizeAggregates,
  summaryFromScoreRecord,
  toVotesPayload,
  PROMPT_FEEDBACK_DIMENSIONS,
} from "./promptScores.js";

describe("calculatePromptScore", () => {
  it("returns 0 for no votes", () => {
    expect(calculatePromptScore(0, 0)).toBe(0);
  });

  it("returns positive score for all agrees", () => {
    const score = calculatePromptScore(10, 0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns negative score for all disagrees", () => {
    const score = calculatePromptScore(0, 10);
    expect(score).toBeLessThan(0);
    expect(score).toBeGreaterThanOrEqual(-1);
  });

  it("returns 0 for equal agrees and disagrees", () => {
    expect(calculatePromptScore(5, 5)).toBe(0);
  });

  it("returns higher score with more confidence (more votes)", () => {
    const lowConfidence = calculatePromptScore(2, 0);
    const highConfidence = calculatePromptScore(20, 0);
    expect(highConfidence).toBeGreaterThan(lowConfidence);
  });

  it("returns a number with max 4 decimal places", () => {
    const score = calculatePromptScore(7, 3);
    const decimals = score.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(4);
  });

  it("handles large numbers", () => {
    const score = calculatePromptScore(10000, 5000);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("createEmptyDimensionBreakdown", () => {
  it("returns object with all dimensions", () => {
    const breakdown = createEmptyDimensionBreakdown();
    for (const dim of PROMPT_FEEDBACK_DIMENSIONS) {
      expect(breakdown[dim]).toBeDefined();
    }
  });

  it("initializes all counts to zero", () => {
    const breakdown = createEmptyDimensionBreakdown();
    for (const dim of PROMPT_FEEDBACK_DIMENSIONS) {
      expect(breakdown[dim].agree).toBe(0);
      expect(breakdown[dim].disagree).toBe(0);
      expect(breakdown[dim].total).toBe(0);
    }
  });

  it("returns a new object each time", () => {
    const a = createEmptyDimensionBreakdown();
    const b = createEmptyDimensionBreakdown();
    expect(a).not.toBe(b);
    a.CORRECT.agree = 5;
    expect(b.CORRECT.agree).toBe(0);
  });
});

describe("summarizeAggregates", () => {
  it("returns zeros for empty array", () => {
    const summary = summarizeAggregates([]);
    expect(summary.agree).toBe(0);
    expect(summary.disagree).toBe(0);
    expect(summary.total).toBe(0);
    expect(summary.score).toBe(0);
  });

  it("sums up agree votes correctly", () => {
    const rows = [
      { dimension: "CORRECT" as const, value: "AGREE" as const, _count: { _all: 5 } },
      { dimension: "FUN" as const, value: "AGREE" as const, _count: { _all: 3 } },
    ];
    const summary = summarizeAggregates(rows);
    expect(summary.agree).toBe(8);
    expect(summary.disagree).toBe(0);
    expect(summary.total).toBe(8);
  });

  it("sums up disagree votes correctly", () => {
    const rows = [
      { dimension: "BORING" as const, value: "DISAGREE" as const, _count: { _all: 2 } },
      { dimension: "CONFUSING" as const, value: "DISAGREE" as const, _count: { _all: 4 } },
    ];
    const summary = summarizeAggregates(rows);
    expect(summary.agree).toBe(0);
    expect(summary.disagree).toBe(6);
    expect(summary.total).toBe(6);
  });

  it("correctly calculates dimension breakdown", () => {
    const rows = [
      { dimension: "CORRECT" as const, value: "AGREE" as const, _count: { _all: 10 } },
      { dimension: "CORRECT" as const, value: "DISAGREE" as const, _count: { _all: 3 } },
    ];
    const summary = summarizeAggregates(rows);
    expect(summary.dimensions.CORRECT.agree).toBe(10);
    expect(summary.dimensions.CORRECT.disagree).toBe(3);
    expect(summary.dimensions.CORRECT.total).toBe(13);
  });

  it("calculates score from aggregates", () => {
    const rows = [
      { dimension: "USEFUL" as const, value: "AGREE" as const, _count: { _all: 8 } },
      { dimension: "USEFUL" as const, value: "DISAGREE" as const, _count: { _all: 2 } },
    ];
    const summary = summarizeAggregates(rows);
    expect(summary.score).toBeGreaterThan(0);
  });
});

describe("summaryFromScoreRecord", () => {
  it("returns null for undefined record", () => {
    expect(summaryFromScoreRecord(undefined)).toBeNull();
  });

  it("returns null for null record", () => {
    expect(summaryFromScoreRecord(null)).toBeNull();
  });

  it("extracts counts from record", () => {
    // Create a mock record that matches the PromptScore shape
    const record = {
      prepId: "test-id",
      agreeCount: 10,
      disagreeCount: 5,
      totalCount: 15,
      score: 0.5,
      dimensionTallies: null,
      lastFeedbackAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Parameters<typeof summaryFromScoreRecord>[0];

    const summary = summaryFromScoreRecord(record);
    expect(summary).not.toBeNull();
    expect(summary!.agree).toBe(10);
    expect(summary!.disagree).toBe(5);
    expect(summary!.total).toBe(15);
    expect(summary!.score).toBe(0.5);
  });

  it("parses dimension tallies from JSON", () => {
    const record = {
      prepId: "test-id",
      agreeCount: 10,
      disagreeCount: 5,
      totalCount: 15,
      score: 0.5,
      dimensionTallies: {
        CORRECT: { agree: 5, disagree: 2, total: 7 },
        FUN: { agree: 3, disagree: 1, total: 4 },
      },
      lastFeedbackAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Parameters<typeof summaryFromScoreRecord>[0];

    const summary = summaryFromScoreRecord(record);
    expect(summary).not.toBeNull();
    expect(summary!.dimensions.CORRECT.agree).toBe(5);
    expect(summary!.dimensions.CORRECT.disagree).toBe(2);
    expect(summary!.dimensions.FUN.agree).toBe(3);
  });
});

describe("toVotesPayload", () => {
  it("transforms summary to payload format", () => {
    const summary = {
      agree: 10,
      disagree: 5,
      total: 15,
      score: 0.5,
      dimensions: createEmptyDimensionBreakdown(),
    };
    summary.dimensions.CORRECT = { agree: 7, disagree: 2, total: 9 };

    const payload = toVotesPayload(summary);
    expect(payload.agree).toBe(10);
    expect(payload.disagree).toBe(5);
    expect(payload.total).toBe(15);
    expect(payload.score).toBe(0.5);
    expect(payload.dimensions).toHaveLength(PROMPT_FEEDBACK_DIMENSIONS.length);
  });

  it("includes all dimensions in payload", () => {
    const summary = {
      agree: 0,
      disagree: 0,
      total: 0,
      score: 0,
      dimensions: createEmptyDimensionBreakdown(),
    };
    const payload = toVotesPayload(summary);
    const dimensionNames = payload.dimensions.map((d) => d.dimension);
    for (const dim of PROMPT_FEEDBACK_DIMENSIONS) {
      expect(dimensionNames).toContain(dim);
    }
  });
});
