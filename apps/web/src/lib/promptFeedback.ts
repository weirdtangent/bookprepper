import type { PromptFeedbackDimension } from "./api";

export const PROMPT_FEEDBACK_DIMENSIONS: PromptFeedbackDimension[] = [
  "CORRECT",
  "FUN",
  "USEFUL",
  "SURPRISING"
];

export const PROMPT_FEEDBACK_LABELS: Record<PromptFeedbackDimension, string> = {
  CORRECT: "Accurate",
  FUN: "Delightful",
  USEFUL: "Useful",
  SURPRISING: "Surprising"
};

export function getPromptFeedbackLabel(dimension: PromptFeedbackDimension) {
  return PROMPT_FEEDBACK_LABELS[dimension] ?? dimension;
}
