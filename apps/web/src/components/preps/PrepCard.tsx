import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Prep, PromptFeedbackDimension } from "../../lib/api";
import { getPromptFeedbackLabel, PROMPT_FEEDBACK_DIMENSIONS } from "../../lib/promptFeedback";

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

export function PrepCard({
  prep,
  feedbackDraft,
  onFeedbackDraftChange,
  onVote,
  votingDisabled,
  isVoting,
  order
}: Props) {
  const accentColor = prep.colorHint ?? "#d1d5db";
  const cardStyle: CSSProperties = {
    borderColor: accentColor,
    "--prep-accent-color": accentColor
  };

  const scorePercent = Math.round(((prep.votes.score + 1) / 2) * 100);
  const leadingDimension = [...prep.votes.dimensions]
    .filter((dimension) => dimension.total > 0)
    .sort((a, b) => b.total - a.total)[0];

  const handleVote = (value: "AGREE" | "DISAGREE") => {
    onVote({
      value,
      dimension: feedbackDraft.dimension,
      note: feedbackDraft.note.trim() || undefined
    });
  };

  return (
    <article className="prep-card" style={cardStyle}>
      <div className="prep-card__content">
        <header className="prep-card__header">
          {typeof order === "number" && (
            <div className="prep-card__badge" aria-label={`Prep ${order}`}>
              <span aria-hidden="true">{order}</span>
            </div>
          )}
          <div className="prep-card__heading-group">
            <p className="prep-card__eyebrow">Watch for</p>
            <h3>{prep.heading}</h3>
          </div>
        </header>
        <div className="prep-card__text-group">
          <div className="prep-card__text-block">
            <span className="prep-card__label">Prep</span>
            <p className="prep-card__summary">{prep.summary}</p>
          </div>
          {prep.watchFor && (
            <div className="prep-card__text-block">
              <span className="prep-card__label prep-card__label--secondary">Highlight</span>
              <p className="prep-card__watchfor">{prep.watchFor}</p>
            </div>
          )}
        </div>
        <div className="prep-card__keywords">
          {prep.keywords.map((keyword) => (
            <Link key={keyword.slug} className="prep-card__keyword-link" to={`/?prep=${keyword.slug}`}>
              {keyword.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="prep-card__sidebar">
        <div className="prep-card__votes">
          <div className="prep-card__vote-counts">
            <span>
              {prep.votes.agree} agree · {prep.votes.disagree} disagree
            </span>
            <span>Score {scorePercent}%</span>
          </div>
          {leadingDimension && (
            <small className="prep-card__dimension">
              Most feedback: {getPromptFeedbackLabel(leadingDimension.dimension)}
            </small>
          )}
        </div>
        <div className="prep-card__feedback">
          <label>
            Focus your feedback
            <select
              value={feedbackDraft.dimension}
              onChange={(event) =>
                onFeedbackDraftChange({
                  dimension: event.target.value as PromptFeedbackDimension
                })
              }
              disabled={votingDisabled || isVoting}
            >
              <optgroup label="Positive signals">
                {["CORRECT", "FUN", "USEFUL", "SURPRISING", "COMMON"].map((dimension) => (
                  <option key={dimension} value={dimension}>
                    {getPromptFeedbackLabel(dimension as PromptFeedbackDimension)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Needs attention">
                {["INCORRECT", "BORING", "NOT_USEFUL", "CONFUSING", "SPARSE"].map((dimension) => (
                  <option key={dimension} value={dimension}>
                    {getPromptFeedbackLabel(dimension as PromptFeedbackDimension)}
                  </option>
                ))}
              </optgroup>
            </select>
            <small className="helper-text">
              Pick the best descriptor so curators can tune or retire weak prompts.
            </small>
          </label>
          <label>
            Optional note
            <textarea
              value={feedbackDraft.note}
              maxLength={500}
              placeholder="Add a quick note for curators (optional)"
              onChange={(event) =>
                onFeedbackDraftChange({
                  note: event.target.value
                })
              }
              disabled={votingDisabled || isVoting}
            />
          </label>
        </div>
        <div className="prep-card__actions">
          <button disabled={votingDisabled || isVoting} onClick={() => handleVote("AGREE")}>
            Agree
          </button>
          <button disabled={votingDisabled || isVoting} onClick={() => handleVote("DISAGREE")}>
            Disagree
          </button>
        </div>
      </div>
    </article>
  );
}

