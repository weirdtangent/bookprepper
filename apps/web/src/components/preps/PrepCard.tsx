import type { Prep } from "../../lib/api";

type Props = {
  prep: Prep;
  onVote: (value: "AGREE" | "DISAGREE") => void;
  votingDisabled: boolean;
  isVoting: boolean;
};

export function PrepCard({ prep, onVote, votingDisabled, isVoting }: Props) {
  return (
    <article className="prep-card" style={{ borderColor: prep.colorHint ?? "#d1d5db" }}>
      <header>
        <div>
          <p className="prep-card__eyebrow">Watch for</p>
          <h3>{prep.heading}</h3>
        </div>
        <div className="prep-card__votes">
          <span>{prep.votes.agree} agree</span>
          <span>{prep.votes.disagree} disagree</span>
        </div>
      </header>
      <p>{prep.summary}</p>
      {prep.watchFor && <p className="prep-card__watchfor">{prep.watchFor}</p>}
      <div className="prep-card__keywords">
        {prep.keywords.map((keyword) => (
          <span key={keyword.slug}>{keyword.name}</span>
        ))}
      </div>
      <div className="prep-card__actions">
        <button disabled={votingDisabled || isVoting} onClick={() => onVote("AGREE")}>
          Agree
        </button>
        <button disabled={votingDisabled || isVoting} onClick={() => onVote("DISAGREE")}>
          Disagree
        </button>
      </div>
    </article>
  );
}

