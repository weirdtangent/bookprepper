import { useState } from "react";
import { Link } from "react-router-dom";
import type { BookSummary } from "../../lib/api";

type Props = {
  book: BookSummary;
};

export function BookCard({ book }: Props) {
  const coverAlt = `${book.title} cover art`;
  const coverInitial = book.title.charAt(0).toUpperCase();
  const [coverError, setCoverError] = useState(false);
  const showFallback = !book.coverImageUrl || coverError;

  return (
    <article className="book-card">
      <Link
        to={`/books/${book.slug}`}
        className="book-card__media"
        aria-label={`View details for ${book.title}`}
      >
        {showFallback ? (
          <div className="book-card__media-placeholder" aria-hidden="true">
            {coverInitial}
          </div>
        ) : (
          <img
            src={book.coverImageUrl}
            alt={coverAlt}
            loading="lazy"
            decoding="async"
            onError={() => setCoverError(true)}
          />
        )}
      </Link>
      <p className="book-card__eyebrow">
        <Link className="book-card__author-link" to={`/?author=${book.author.slug}`}>
          {book.author.name}
        </Link>{" "}
        &middot; {book.prepCount} prep{book.prepCount === 1 ? "" : "s"}
      </p>
      <Link to={`/books/${book.slug}`} className="book-card__title-link">
        <h3>{book.title}</h3>
        {book.synopsis && <p className="book-card__synopsis">{book.synopsis}</p>}
      </Link>
      <div className="book-card__tags">
        {book.genres.map((genre) => (
          <span key={genre.id}>{genre.name}</span>
        ))}
      </div>
    </article>
  );
}

