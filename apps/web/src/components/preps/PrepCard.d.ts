import type { Prep } from "../../lib/api";
type Props = {
    prep: Prep;
    onVote: (value: "AGREE" | "DISAGREE") => void;
    votingDisabled: boolean;
    isVoting: boolean;
};
export declare function PrepCard({ prep, onVote, votingDisabled, isVoting }: Props): import("react/jsx-runtime").JSX.Element;
export {};
