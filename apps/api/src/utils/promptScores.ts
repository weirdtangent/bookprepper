import type { PromptFeedbackDimension, PrepVoteValue, PromptScore as PromptScoreRecord } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "db";

export const PROMPT_FEEDBACK_DIMENSIONS: PromptFeedbackDimension[] = [
  "CORRECT",
  "INCORRECT",
  "FUN",
  "BORING",
  "USEFUL",
  "SURPRISING",
  "NOT_USEFUL",
  "CONFUSING",
  "COMMON",
  "SPARSE"
];

export type DimensionVoteBreakdown = Record<
  PromptFeedbackDimension,
  {
    agree: number;
    disagree: number;
    total: number;
  }
>;

export type PromptVoteSummary = {
  agree: number;
  disagree: number;
  total: number;
  score: number;
  dimensions: DimensionVoteBreakdown;
};

type AggregateRow = {
  dimension: PromptFeedbackDimension;
  value: PrepVoteValue;
  _count: {
    _all: number;
  };
};

export async function syncPromptScore(prepId: string, feedbackTimestamp = new Date()): Promise<PromptVoteSummary> {
  const aggregates = await prisma.promptFeedback.groupBy({
    by: ["dimension", "value"],
    where: { prepId },
    _count: { _all: true }
  });

  const summary = summarizeAggregates(aggregates);

  await prisma.promptScore.upsert({
    where: { prepId },
    update: {
      agreeCount: summary.agree,
      disagreeCount: summary.disagree,
      totalCount: summary.total,
      score: summary.score,
      dimensionTallies: summary.dimensions as unknown as Prisma.InputJsonValue,
      lastFeedbackAt: summary.total > 0 ? feedbackTimestamp : null
    },
    create: {
      prepId,
      agreeCount: summary.agree,
      disagreeCount: summary.disagree,
      totalCount: summary.total,
      score: summary.score,
      dimensionTallies: summary.dimensions as unknown as Prisma.InputJsonValue,
      lastFeedbackAt: summary.total > 0 ? feedbackTimestamp : null
    }
  });

  return summary;
}

export function summarizeAggregates(rows: AggregateRow[]): PromptVoteSummary {
  const dimensions = createEmptyDimensionBreakdown();
  let agree = 0;
  let disagree = 0;

  for (const row of rows) {
    const target = dimensions[row.dimension];
    if (!target) {
      continue;
    }
    if (row.value === "AGREE") {
      target.agree += row._count._all;
      agree += row._count._all;
    } else {
      target.disagree += row._count._all;
      disagree += row._count._all;
    }
    target.total = target.agree + target.disagree;
  }

  return {
    agree,
    disagree,
    total: agree + disagree,
    score: calculatePromptScore(agree, disagree),
    dimensions
  };
}

export function calculatePromptScore(agree: number, disagree: number) {
  const total = agree + disagree;
  if (total === 0) {
    return 0;
  }
  const balance = (agree - disagree) / total;
  const confidenceBoost = Math.min(1, Math.log10(total + 1) / 2);
  return Number((balance * (0.7 + confidenceBoost * 0.3)).toFixed(4));
}

export function createEmptyDimensionBreakdown(): DimensionVoteBreakdown {
  return PROMPT_FEEDBACK_DIMENSIONS.reduce<DimensionVoteBreakdown>((acc, dimension) => {
    acc[dimension] = { agree: 0, disagree: 0, total: 0 };
    return acc;
  }, {} as DimensionVoteBreakdown);
}

export function summaryFromScoreRecord(record?: PromptScoreRecord | null): PromptVoteSummary | null {
  if (!record) {
    return null;
  }
  const dimensions = createEmptyDimensionBreakdown();
  if (record.dimensionTallies && typeof record.dimensionTallies === "object") {
    for (const dimension of PROMPT_FEEDBACK_DIMENSIONS) {
      const entry = (record.dimensionTallies as Record<string, unknown>)[dimension];
      if (entry && typeof entry === "object") {
        const agree = Number((entry as Record<string, unknown>).agree ?? 0) || 0;
        const disagree = Number((entry as Record<string, unknown>).disagree ?? 0) || 0;
        dimensions[dimension] = {
          agree,
          disagree,
          total: Number((entry as Record<string, unknown>).total ?? agree + disagree) || agree + disagree
        };
      }
    }
  }

  return {
    agree: record.agreeCount,
    disagree: record.disagreeCount,
    total: record.totalCount,
    score: Number(record.score ?? 0),
    dimensions
  };
}

export function toVotesPayload(summary: PromptVoteSummary) {
  return {
    agree: summary.agree,
    disagree: summary.disagree,
    total: summary.total,
    score: summary.score,
    dimensions: PROMPT_FEEDBACK_DIMENSIONS.map((dimension) => ({
      dimension,
      agree: summary.dimensions[dimension].agree,
      disagree: summary.dimensions[dimension].disagree,
      total: summary.dimensions[dimension].total
    }))
  };
}
