import { Link } from "react-router-dom";
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
          <Link key={keyword.slug} className="prep-card__keyword-link" to={`/?prep=${keyword.slug}`}>
            {keyword.name}
          </Link>
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

