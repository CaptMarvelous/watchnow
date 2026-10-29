# WatchNow

A personal movie, TV and anime tracker: browse and search a live catalogue, keep a
database-backed library with status/score/episode progress, and bring in watch
history you already have saved elsewhere — a MyAnimeList XML export, a Letterboxd
or IMDb CSV export, or a plain spreadsheet from MyDramaList or anywhere else.

Built with **Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS v4**,
**Drizzle ORM** over Postgres (or an embedded Postgres for local dev), and catalogue
data from the [TMDB API](https://www.themoviedb.org/).

> WatchNow has no streaming. Trailers play through YouTube's privacy-enhanced
> embed, and all catalogue data and artwork come from TMDB.

## Quick start

```bash
npm install
cp .env.example .env.local   # then paste your TMDB key
npm run dev                  # http://localhost:3000
```

Get a free TMDB key at <https://www.themoviedb.org/settings/api>. Both the v3 API
key and the v4 "API Read Access Token" work.

**No key yet?** The app still runs. Browsing falls back to a small bundled
catalogue of public-domain titles (generated placeholder posters, no ratings) and
shows a banner saying so. Accounts, the library and importing all work normally
either way — a TMDB key only affects whether imported titles get matched to real
catalogue entries with artwork.

**No `DATABASE_URL`?** The app uses an embedded Postgres build ([PGlite](https://pglite.dev/))
that runs in-process and stores data under `.data/pglite`. That's fine for trying
the app locally, but it's a single file on disk — set `DATABASE_URL` to a real
Postgres instance (Neon, Supabase, RDS, ...) before deploying anywhere the
filesystem doesn't persist, such as most serverless hosts.

## Features

- **Home:** featured hero plus rows for trending, popular, top rated and genres,
  across movies and TV
- **Search:** debounced live suggestions in the header, plus a full results page
  with pagination, covering movies and TV/anime/dramas together
- **Detail pages:** backdrop, poster, runtime or episode count, rating, genres,
  overview, embedded trailer, cast and "more like this"
- **Accounts:** email/password signup and login, session management (sign out one
  device or everywhere), profile, email and password changes, a JSON/CSV export of
  your own data, and account deletion
- **Library:** every title you track gets a status (watching, completed, on hold,
  dropped, plan to watch), an optional 1–10 score, and episode progress for TV —
  filterable, searchable and sortable
- **Import:** upload a MyAnimeList XML export, a Letterboxd or IMDb CSV export, or
  any other CSV/TSV with recognisable columns (title, status, score, episodes...);
  rows are matched against TMDB by title and year, merged into your library, and
  anything that can't be confidently matched is still saved — unlinked, so you can
  search for the right title and link it by hand with "Find match"
- **Resilience:** loading skeletons, error boundary with retry, custom 404,
  graceful fallback if TMDB is unreachable, rate limiting on auth and import
- **Accessibility:** semantic landmarks, labelled controls, visible focus rings,
  `prefers-reduced-motion` respected

## Project structure

```
src/
  app/
    page.tsx                   Home (server component)
    movie/[id]/page.tsx        Movie details
    tv/[id]/page.tsx           TV/anime/drama details
    search/page.tsx            Results with pagination
    login/, signup/            Auth pages
    library/page.tsx           Your library (filters, sort, pagination)
    import/page.tsx            Import a list
    account/page.tsx           Profile, email, password, devices, export, delete
    account/export/route.ts    JSON/CSV data export
    actions/                   Server actions: auth, account, library, import
    api/search/route.ts        Search proxy for header suggestions
    error.tsx, loading.tsx, not-found.tsx
  components/                  Header, SearchBox, Hero, MediaRow, MediaCard,
                                TrackPanel, LibraryItem, LinkMatch, auth/, account/,
                                import/, ui/
  db/                          Drizzle schema, migrations, connection (Postgres or
                                PGlite), unique-violation helpers
  lib/
    auth/                      Sessions, password hashing, rate limiting, the data
                                access layer (requireUser / getCurrentUser)
    import/                    The import pipeline (see below)
    library/                   Status/type constants, dedupe keys, merge logic
    tmdb.ts                    Server-only TMDB client (auth, caching, mapping)
    sample-data.ts             Offline fallback catalogue
    site.ts                    App name/slug, used everywhere a name is needed
  proxy.ts                     Redirects signed-out visitors away from
                                account-only pages before anything renders
```

### The import pipeline

`src/lib/import/` is its own small system:

1. **`container.ts`** unpacks the upload — plain text, gzip, or zip (including
   Letterboxd's multi-file export zip, which it picks the right CSV out of).
2. **`mal.ts`** / **`csv.ts`** parse MyAnimeList's XML format or any CSV/TSV,
   detecting Letterboxd and IMDb's layouts specifically and otherwise matching
   columns by a list of common aliases (so a MyDramaList export from a community
   tool, or a hand-built spreadsheet, works too).
3. **`match.ts`** looks each parsed title up against TMDB (bigram title
   similarity, year-aware) with a bounded worker pool, so one slow or failing
   lookup can't hang the whole import.
4. **`run.ts`** collapses duplicate rows from the same file (e.g. several MAL
   "seasons" of one show) and merges everything into your library, either filling
   in only what's missing or overwriting with the imported values, your choice.

It's covered by its own test suite (`npm test`), including integration tests that
run the real pipeline against a throwaway database.

## Design decisions worth knowing

- **Sessions are server-side.** A random token lives in an httpOnly cookie; only
  its SHA-256 hash is stored in the database. Passwords use scrypt with
  OWASP-recommended parameters.
- **The TMDB credential stays on the server.** All TMDB calls happen in server
  components, server actions, or the `/api/search` route handler.
- **`proxy.ts` is a fast-path, not the security boundary.** It gives a clean HTTP
  redirect for signed-out visitors to `/library`, `/import` and `/account` before
  any rendering starts. Every server action and page still checks the session
  itself (`requireUser` / `getCurrentUser`) — that's what actually enforces
  access, the proxy just makes the common case snappier.
- **Dedupe by TMDB id when possible, by title otherwise.** A linked library entry
  is keyed by `tmdb:<kind>:<id>`; an entry an import couldn't match is keyed by
  its normalised title and year, so re-importing the same file twice doesn't
  create duplicates.
- **Normalised data model.** TMDB's snake_case payloads are mapped once in
  `tmdb.ts` into app types; the rest of the app never touches raw API shapes.
- **Graceful degradation.** Missing TMDB key or API outage falls back to sample
  data instead of a blank page.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the test suite (Vitest, with a real throwaway database) |
| `npm run typecheck` | TypeScript, no emit |

## Deploy

1. Push to GitHub.
2. Import the repo on [Vercel](https://vercel.com/new) or your host of choice.
3. Set `TMDB_API_KEY` (recommended) and `DATABASE_URL` (a real Postgres instance —
   strongly recommended for anything beyond local testing; see "No `DATABASE_URL`?"
   above) as environment variables.
4. Deploy.

## Known limitations / ideas for next steps

- **Unlinked titles from the same show can end up as two library rows.** If you
  manually track a title (linked to a real TMDB entry) and later import a file
  where that same title fails to match — no TMDB key configured, or the title
  just isn't found — the import creates a second, unlinked row instead of merging
  into the one you already have. With a TMDB key configured, matching almost
  always resolves to the same id you already linked, so this mainly shows up in
  demo/no-key mode or on a genuinely unmatchable title. Use "Find match" on the
  unlinked row to link and merge it manually in the meantime.
- Social features (friends' lists, shared ratings) — out of scope for now
- Genre/year/rating filters on a dedicated Discover page
- Bulk actions on the library page (multi-select status changes)
- Add the TMDB logo to the footer to fully match their attribution guidelines
  before going public

## Credits

Catalogue data and images: [TMDB](https://www.themoviedb.org/). This product uses
the TMDB API but is not endorsed or certified by TMDB.
