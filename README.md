# PromptStar ✨

**A pop-idol-holo styled marketplace for anime AI prompts** — browse, save, collect, and publish AI art prompts in a loud, neon, sticker-bomb aesthetic. Built as a full-stack TanStack Start app with its own auth, database, and creator tools.

![Market — the prompt marketplace landing page](docs/screenshots/market.png)

---

## ✨ Features

- **Market** — browse trending and community-published prompts, search and filter by category
- **Binder** (dashboard) — your private vault: saved prompts, purchases, and custom collections
- **Studio** (profile) — customize your avatar/companion mascot, accent theme color, animation intensity, and bio
- **Prompt detail pages** — full prompt write-ups with creator credit, pricing, and "save to binder" / "get for $" actions
- **Auth** — email/password sign-up and sign-in with hashed passwords and persistent sessions
- **Creator tools** — contribute your own prompt listings straight from your Binder
- **Live theming** — pick an accent color in your Studio and the whole site repaints instantly (and persists across refreshes, with zero flash-of-default-theme)
- **Idle mascot companion** — a floating, animated buddy that follows you around the site

| Sign in | Binder | Studio |
|---|---|---|
| ![Sign-in screen with animated mascot](docs/screenshots/auth.png) | ![Binder dashboard with collections and saved prompts](docs/screenshots/binder.png) | ![Studio profile page with theme and companion pickers](docs/screenshots/studio.png) |

### Prompt detail

![Prompt detail page showing artwork, pricing, and creator info](docs/screenshots/prompt-detail.png)

---

## 🛠 Tech stack

- **[TanStack Start](https://tanstack.com/start)** + **[TanStack Router](https://tanstack.com/router)** — full-stack React framework with file-based routing, SSR, and server functions
- **[TanStack Query](https://tanstack.com/query)** — data fetching and caching across navigations
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **[Motion](https://motion.dev)** (Framer Motion) — scroll reveals, idle animations, reduced-motion support
- **PostgreSQL** via `pg`, with hand-rolled SQL migrations
- **bcryptjs** — password hashing
- **Zod** — runtime validation for server functions
- **Vite** — dev server and bundler

---

## 🚀 Getting started

### Prerequisites

- Node.js (v20+)
- Docker (for the local Postgres database)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the database

A `docker-compose.yml` is included for a local Postgres instance:

```bash
docker compose up -d
```

### 3. Configure environment

Copy `.env` and point `DATABASE_URL` / `DATABASE_PUBLIC_URL` at your local database (the defaults in `docker-compose.yml` work out of the box):

```
DATABASE_URL=postgresql://postgres:localdev@localhost:5432/promptstar
DATABASE_PUBLIC_URL=postgresql://postgres:localdev@localhost:5432/promptstar
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

The app runs at **http://localhost:3000** — frontend, server functions, and API all served from the same process.

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (client + server) |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the codebase with Prettier |
| `npm run db:migrate` | Run SQL migrations against `DATABASE_URL` |

---

## 📁 Project structure

```
src/
  routes/          File-based routes (TanStack Router) — pages, loaders, head meta
  components/      Shared UI (Navbar, PromptCard, modals, mascot, etc.)
  components/ui/   Design-system primitives (built on Radix UI)
  lib/             Server functions, theme system, mascots, utilities
  styles.css       Tailwind entry + design tokens
db/
  migrations/      Versioned SQL migrations
```

---

## 🎨 Design notes

PromptStar leans into a **pop-idol holo** look — thick black borders, hard drop shadows, neon gradients, and bouncy spring animations. The accent color (`--magenta`) is a single CSS custom property that can be re-pointed at runtime from the Studio page, repainting every `text-magenta` / `bg-magenta` / `ring-magenta` usage across the site without touching the rest of the four-color palette.
