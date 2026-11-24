# Saugat Karki: portfolio

One-page portfolio built with Astro and Three.js. The background is a procedurally generated circuit board; a copper bus fills down the page as you scroll and each section is pulled into view when the current reaches it.

## Run locally

    npm install
    npm run dev        # http://localhost:4321

## Edit content

All text lives in `src/data/resume.ts`. Components only handle layout.

## Add photos

Put images in `public/images/` and set the paths in `src/data/resume.ts`:

- `person.photo` → headshot (square, at least 800 px)
- `projects[].photo` → project photos (4:3, at least 1200 px wide)

## Deploy to GitHub Pages

1. Create a repo. Naming it `126saugat126.github.io` gives the URL `https://126saugat126.github.io/`; any other name serves at `/<repo-name>/` (handled automatically).
2. Push this folder to the `main` branch.
3. In the repo: Settings → Pages → Source: **GitHub Actions**.

Every push to `main` rebuilds and redeploys via `.github/workflows/deploy.yml`.

## Layout

    src/
      data/resume.ts          content
      scripts/board.ts        Three.js PCB background + scroll-driven reveal
      components/             Hero, Education (title block), Skills (datasheet),
                              Experience (logic analyzer), Projects (BOM),
                              Leadership (7-segment), Contact (pin header)
      styles/global.css       palette, type, shared rules
