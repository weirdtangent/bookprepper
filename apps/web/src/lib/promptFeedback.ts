import type { PromptFeedbackDimension } from "./api";

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

export const PROMPT_FEEDBACK_LABELS: Record<PromptFeedbackDimension, string> = {
  CORRECT: "Accurate",
  INCORRECT: "Incorrect",
  FUN: "Delightful",
  BORING: "Boring",
  USEFUL: "Useful",
  SURPRISING: "Surprising",
  NOT_USEFUL: "Not useful",
  CONFUSING: "Confusing",
  COMMON: "Shows up often",
  SPARSE: "Sparse / hard to find"
};

export function getPromptFeedbackLabel(dimension: PromptFeedbackDimension) {
  return PROMPT_FEEDBACK_LABELS[dimension] ?? dimension;
}
