import { useState, useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type Prep, type PrepQuote, type PromptFeedbackDimension } from "../../lib/api";
import { getPromptFeedbackLabel } from "../../lib/promptFeedback";
import { useDebounce } from "../../hooks/useDebounce";

export type PrepFeedbackDraft = {
  dimension: PromptFeedbackDimension;
  note: string;
};

export type QuoteDraft = {
  text: string;
  pageNumber: string;
  chapter: string;
};

type Props = {
  prep: Prep;
  bookTitle: string;
  authorName: string;
  feedbackDraft: PrepFeedbackDraft;
  onFeedbackDraftChange: (updates: Partial<PrepFeedbackDraft>) => void;
  onVote: (payload: {
    value: "AGREE" | "DISAGREE";
    dimension: PromptFeedbackDimension;
    note?: string;
  }) => void;
  onQuoteVote?: (quoteId: string, value: "AGREE" | "DISAGREE") => void;
  onAddQuote?: (quote: QuoteDraft) => void;
  onDeleteQuote?: (quoteId: string) => void;
  votingDisabled: boolean;
  isVoting: boolean;
  isQuoteVoting?: boolean;
  isAddingQuote?: boolean;
  currentUserId?: string;
  order?: number;
};

type PrepCardStyle = CSSProperties & {
  "--prep-accent-color"?: string;
};

export function PrepCard({
  prep,
  bookTitle,
  authorName,
  feedbackDraft,
  onFeedbackDraftChange,
  onVote,
  onQuoteVote,
  onAddQuote,
  onDeleteQuote,
  votingDisabled,
  isVoting,
  isQuoteVoting,
  isAddingQuote,
  currentUserId,
  order,
}: Props) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>({
    text: "",
    pageNumber: "",
    chapter: "",
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quoteVerified, setQuoteVerified] = useState(false);

  // Debounce quote text for search
  const debouncedQuoteText = useDebounce(quoteDraft.text, 500);

  // Check if we should search (at least 15 chars or 3 words)
  const shouldSearch = (() => {
    const text = debouncedQuoteText.trim();
    if (text.length >= 15) return true;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return wordCount >= 3;
  })();

  // Search for matching quotes
  const quoteSearchQuery = useQuery({
    queryKey: ["quote-search", debouncedQuoteText, bookTitle, authorName],
    queryFn: () =>
      api.searchQuotes({
        text: debouncedQuoteText.trim(),
        bookTitle,
        authorName,
      }),
    enabled: showQuoteForm && shouldSearch && debouncedQuoteText.length >= 10,
    staleTime: 60000,
  });

  // Show suggestions when we have results
  useEffect(() => {
    if (quoteSearchQuery.data?.found && quoteSearchQuery.data.results.length > 0) {
      setShowSuggestions(true);
    }
  }, [quoteSearchQuery.data]);

  const handleSelectSuggestion = (snippet: string) => {
    // Clean up HTML entities and tags from the snippet
    const cleanSnippet = snippet
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    // Extract just the bold (matched) portions and nearby text
    // The <b> tags mark what Google found matching
    const boldMatches = snippet.match(/<b>([^<]+)<\/b>/g);

    if (boldMatches && boldMatches.length > 0) {
      // Find where the first bold match starts in the clean text
      const firstBold = boldMatches[0].replace(/<\/?b>/g, "");
      const lastBold = boldMatches[boldMatches.length - 1].replace(/<\/?b>/g, "");

      // Remove all HTML tags for position finding
      const textOnly = cleanSnippet.replace(/<\/?b>/g, "");

      // Find the positions
      const startIdx = textOnly.toLowerCase().indexOf(firstBold.toLowerCase());
      const lastIdx = textOnly.toLowerCase().lastIndexOf(lastBold.toLowerCase());

      if (startIdx !== -1 && lastIdx !== -1) {
        // Extract from first match to end of last match, plus try to get complete sentence
        let extractStart = startIdx;
        let extractEnd = lastIdx + lastBold.length;

        // Try to extend to sentence boundaries (period, exclamation, question mark)
        // Look backwards for sentence start (capital letter after punctuation or start)
        for (let i = extractStart - 1; i >= Math.max(0, extractStart - 50); i--) {
          if (textOnly[i] === "." || textOnly[i] === "!" || textOnly[i] === "?") {
            extractStart = i + 1;
            break;
          }
        }

        // Look forwards for sentence end
        for (let i = extractEnd; i < Math.min(textOnly.length, extractEnd + 100); i++) {
          if (textOnly[i] === "." || textOnly[i] === "!" || textOnly[i] === "?") {
            extractEnd = i + 1;
            break;
          }
        }

        // Extract and clean up
        let extracted = textOnly.slice(extractStart, extractEnd).trim();

        // Remove leading ellipsis or trailing ellipsis
        extracted = extracted.replace(/^\.{2,}\s*/, "").replace(/\s*\.{2,}$/, "");

        // If we got something reasonable, use it
        if (extracted.length >= 10) {
          setQuoteDraft({ ...quoteDraft, text: extracted });
          setQuoteVerified(true);
          setShowSuggestions(false);
          return;
        }
      }
    }

    // Fallback: keep user's text but mark as verified since we found a match
    setQuoteVerified(true);
    setShowSuggestions(false);
  };

  const accentColor = prep.colorHint ?? "#d1d5db";
  const cardStyle: PrepCardStyle = {
    borderColor: accentColor,
    "--prep-accent-color": accentColor,
  };

  const scorePercent = Math.round(((prep.votes.score + 1) / 2) * 100);
  const leadingDimension = [...prep.votes.dimensions]
    .filter((dimension) => dimension.total > 0)
    .sort((a, b) => b.total - a.total)[0];

  const handleVote = (value: "AGREE" | "DISAGREE") => {
    onVote({
      value,
      dimension: feedbackDraft.dimension,
      note: feedbackDraft.note.trim() || undefined,
    });
  };

  const handleQuoteSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAddQuote || !quoteDraft.text.trim()) return;
    onAddQuote(quoteDraft);
    setQuoteDraft({ text: "", pageNumber: "", chapter: "" });
    setQuoteVerified(false);
    setShowQuoteForm(false);
  };

  const quoteCount = prep.quotes?.length ?? 0;

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
            <Link
              key={keyword.slug}
              className="prep-card__keyword-link"
              to={`/?prep=${keyword.slug}`}
            >
              {keyword.name}
            </Link>
          ))}
        </div>

        {/* Quotes Section with Spoiler Protection */}
        <div className="prep-quotes">
          <div className="prep-quotes__header">
            <span>
              {quoteCount} quote{quoteCount === 1 ? "" : "s"} from readers
            </span>
            {quoteCount > 0 && !spoilerRevealed && (
              <button
                type="button"
                className="prep-quotes__toggle spoiler-toggle"
                onClick={() => setSpoilerRevealed(true)}
              >
                ⚠️ Show quotes (may contain spoilers)
              </button>
            )}
            {quoteCount > 0 && spoilerRevealed && (
              <button
                type="button"
                className="prep-quotes__toggle"
                onClick={() => setSpoilerRevealed(false)}
              >
                Hide quotes
              </button>
            )}
          </div>

          {spoilerRevealed && quoteCount > 0 && (
            <ul className="prep-quotes__list">
              {prep.quotes.map((quote) => (
                <QuoteItem
                  key={quote.id}
                  quote={quote}
                  onVote={onQuoteVote}
                  onDelete={onDeleteQuote}
                  votingDisabled={votingDisabled || !!isQuoteVoting}
                  canDelete={currentUserId === quote.user.id}
                />
              ))}
            </ul>
          )}

          {/* Show "Add a quote" button when: no quotes exist, OR spoiler is revealed */}
          {(quoteCount === 0 || spoilerRevealed) && !showQuoteForm && onAddQuote && (
            <button
              type="button"
              className="prep-quotes__toggle"
              onClick={() => setShowQuoteForm(true)}
              disabled={votingDisabled}
            >
              + Add a quote
            </button>
          )}

          {(quoteCount === 0 || spoilerRevealed) && showQuoteForm && (
            <form className="quote-form" onSubmit={handleQuoteSubmit}>
              <div className="quote-form__input-wrapper">
                <textarea
                  placeholder="Start typing a quote... we'll search for matches as you type"
                  value={quoteDraft.text}
                  onChange={(e) => {
                    setQuoteDraft({ ...quoteDraft, text: e.target.value });
                    setQuoteVerified(false); // Reset verified when text changes
                    if (!e.target.value.trim()) setShowSuggestions(false);
                  }}
                  onFocus={() => {
                    if (quoteSearchQuery.data?.found) setShowSuggestions(true);
                  }}
                  minLength={10}
                  maxLength={2000}
                  required
                  disabled={isAddingQuote}
                  className={quoteVerified ? "quote-form__textarea--verified" : ""}
                />
                {quoteVerified && (
                  <span className="quote-form__verified">✓ Verified in Google Books</span>
                )}
                {!quoteVerified && quoteSearchQuery.isFetching && (
                  <span className="quote-form__searching">Searching...</span>
                )}
                {showSuggestions &&
                  quoteSearchQuery.data?.results &&
                  quoteSearchQuery.data.results.length > 0 && (
                    <div className="quote-suggestions">
                      <div className="quote-suggestions__header">
                        <span>Found in Google Books — click to use:</span>
                        <button
                          type="button"
                          className="quote-suggestions__close"
                          onClick={() => setShowSuggestions(false)}
                        >
                          ✕
                        </button>
                      </div>
                      <ul className="quote-suggestions__list">
                        {quoteSearchQuery.data.results.map((result, idx) => (
                          <li key={idx}>
                            <button
                              type="button"
                              className="quote-suggestion"
                              onClick={() =>
                                result.textSnippet && handleSelectSuggestion(result.textSnippet)
                              }
                              disabled={!result.textSnippet}
                            >
                              <span
                                className="quote-suggestion__text"
                                dangerouslySetInnerHTML={{
                                  __html: result.textSnippet || "No preview available",
                                }}
                              />
                              <span className="quote-suggestion__source">
                                {result.title}{" "}
                                {result.authors?.length ? `by ${result.authors[0]}` : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
              <div className="quote-form__location">
                <input
                  type="text"
                  placeholder="Page (optional)"
                  value={quoteDraft.pageNumber}
                  onChange={(e) => setQuoteDraft({ ...quoteDraft, pageNumber: e.target.value })}
                  maxLength={20}
                  disabled={isAddingQuote}
                />
                <input
                  type="text"
                  placeholder="Chapter (optional)"
                  value={quoteDraft.chapter}
                  onChange={(e) => setQuoteDraft({ ...quoteDraft, chapter: e.target.value })}
                  maxLength={100}
                  disabled={isAddingQuote}
                />
              </div>
              <div className="quote-form__actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuoteForm(false);
                    setShowSuggestions(false);
                    setQuoteVerified(false);
                    setQuoteDraft({ text: "", pageNumber: "", chapter: "" });
                  }}
                  disabled={isAddingQuote}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isAddingQuote || !quoteDraft.text.trim()}>
                  {isAddingQuote ? "Adding..." : "Add Quote"}
                </button>
              </div>
            </form>
          )}
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
                  dimension: event.target.value as PromptFeedbackDimension,
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
                  note: event.target.value,
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

type QuoteItemProps = {
  quote: PrepQuote;
  onVote?: (quoteId: string, value: "AGREE" | "DISAGREE") => void;
  onDelete?: (quoteId: string) => void;
  votingDisabled: boolean;
  canDelete: boolean;
};

function QuoteItem({ quote, onVote, onDelete, votingDisabled, canDelete }: QuoteItemProps) {
  const location = [
    quote.chapter && `Ch. ${quote.chapter}`,
    quote.pageNumber && `p. ${quote.pageNumber}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="quote-item">
      <p className="quote-item__text">&ldquo;{quote.text}&rdquo;</p>
      <div className="quote-item__meta">
        <div className="quote-item__info">
          <span className="quote-item__user">— {quote.user.displayName}</span>
          {location && <span className="quote-item__location">{location}</span>}
          {quote.verified && (
            <span
              className="quote-item__verified"
              title={quote.verifiedSource ?? "Verified via Google Books"}
            >
              ✓ Verified
            </span>
          )}
        </div>
        <div className="quote-item__actions">
          <span className="quote-item__votes">
            {quote.votes.agree} agree · {quote.votes.disagree} disagree
          </span>
          {onVote && (
            <>
              <button
                type="button"
                className="quote-item__vote-btn"
                onClick={() => onVote(quote.id, "AGREE")}
                disabled={votingDisabled}
                title="This quote is relevant to the prep"
              >
                👍
              </button>
              <button
                type="button"
                className="quote-item__vote-btn"
                onClick={() => onVote(quote.id, "DISAGREE")}
                disabled={votingDisabled}
                title="This quote is not relevant"
              >
                👎
              </button>
            </>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              className="quote-item__delete"
              onClick={() => onDelete(quote.id)}
              title="Delete this quote"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
