import { SITE_NAME } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-8 text-xs leading-relaxed text-mute sm:px-6 lg:px-8">
        <p>
          {SITE_NAME} is a portfolio project. Movie data and images are provided by{" "}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cream underline underline-offset-2"
          >
            TMDB
          </a>
          .
        </p>
        <p className="mt-1">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </footer>
  );
}
