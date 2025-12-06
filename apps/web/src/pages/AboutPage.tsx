import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <section className="page about-page">
      <div className="panel about-hero">
        <p className="about-hero__eyebrow">About BookPrepper</p>
        <h1>Prep smarter, read deeper.</h1>
        <p>
          BookPrepper is a reader-first companion that treats close reading as a craft. We collect
          spoiler-free "prep notes" from veteran readers so you can notice themes, signals, and
          motifs without blunting the story.
        </p>
        <p>
          Use the preps before you start a book, reference them between chapters, or nominate your
          own so future readers benefit from your perspective.
        </p>
        <div className="about-hero__actions">
          <Link to="/" className="link-button">
            Browse the library
          </Link>
          <Link to="/suggest" className="link-button">
            Suggest a title
          </Link>
        </div>
      </div>

      <div className="about-grid">
        <article className="panel about-card">
          <h2>What counts as a prep?</h2>
          <p>
            A prep is a short brief about what to watch for. Each one has a title, a summary, and a
            "watch for" section that highlights motifs or tension without leaking plot twists.
          </p>
          <ul>
            <li>They stay spoiler-free.</li>
            <li>They highlight signals, not chapter summaries.</li>
            <li>They point to characters, structures, or craft choices worth tracking.</li>
          </ul>
        </article>

        <article className="panel about-card">
          <h2>How the catalog grows</h2>
          <p>
            We seed the library with canon favorites, then expand it through community suggestions,
            metadata fixes, and approved preps. The goal is a living syllabus that encourages people
            to read bravely across genres.
          </p>
          <p>
            Help us improve accuracy by submitting metadata fixes, genre adjustments, or entirely
            new titles on the{" "}
            <Link to="/suggest" className="inline-link">
              Suggest page
            </Link>
            .
          </p>
        </article>

        <article className="panel about-card">
          <h2>Credits &amp; thanks</h2>
          <p>
            Cover thumbnails and fallback artwork are provided courtesy of the{" "}
            <a
              href="https://openlibrary.org/developers/api"
              target="_blank"
              rel="noreferrer"
              className="inline-link"
            >
              Open Library Covers API
            </a>
            . We cache each image once per ISBN and store it locally so we honor their rate limits
            and service guidelines.
          </p>
          <p>
            BookPrepper is not affiliated with Open Library, but we are grateful for their public
            domain data and for the librarians and volunteers who maintain it.
          </p>
        </article>
      </div>
    </section>
  );
}
