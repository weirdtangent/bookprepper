import { Link } from "react-router-dom";
import type { BookSummary } from "../../lib/api";

type Props = {
  book: BookSummary;
};

export function BookCard({ book }: Props) {
  return (
    <Link to={`/books/${book.slug}`} className="book-card">
      <div className="book-card__body">
        <p className="book-card__eyebrow">
          {book.author.name} &middot; {book.prepCount} prep{book.prepCount === 1 ? "" : "s"}
        </p>
        <h3>{book.title}</h3>
        {book.synopsis && <p className="book-card__synopsis">{book.synopsis}</p>}
      </div>
      <div className="book-card__tags">
        {book.genres.map((genre) => (
          <span key={genre.id}>{genre.name}</span>
        ))}
      </div>
    </Link>
  );
}

