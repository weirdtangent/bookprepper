import type { Prep, PromptFeedbackDimension } from "../../lib/api";
export type PrepFeedbackDraft = {
    dimension: PromptFeedbackDimension;
    note: string;
};
type Props = {
    prep: Prep;
    feedbackDraft: PrepFeedbackDraft;
    onFeedbackDraftChange: (updates: Partial<PrepFeedbackDraft>) => void;
    onVote: (payload: {
        value: "AGREE" | "DISAGREE";
        dimension: PromptFeedbackDimension;
        note?: string;
    }) => void;
    votingDisabled: boolean;
    isVoting: boolean;
    order?: number;
};
export declare function PrepCard({ prep, feedbackDraft, onFeedbackDraftChange, onVote, votingDisabled, isVoting, order }: Props): import("react/jsx-runtime").JSX.Element;
export {};
