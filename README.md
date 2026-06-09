# PromptStar ✨

**A pop-idol-holo styled marketplace for AI image-generation prompts** — browse, save, collect, and publish prompts in a loud, neon, sticker-bomb aesthetic. Built as a full-stack TanStack Start app with its own auth, database, credit economy, and creator tools.

![Market — the prompt marketplace landing page](docs/screenshots/market.png)

---

## ✨ Features

- **Market** — browse trending and community-published prompts, sort by newest / trending / price / rating, filter by category
- **Binder** (dashboard) — your private vault: saved prompts, purchases, and custom collections you can name and organise
- **Studio** (profile) — customize your avatar/companion mascot, accent theme color, animation intensity, bio, and font size
- **Prompt detail pages** — full write-ups with creator credit, pricing, copy count, view count, reviews, and buy/copy actions
- **Auth** — email/password sign-up and sign-in with bcrypt-hashed passwords and persistent sessions
- **Creator tools** — contribute your own prompt listings, edit them, track views and saves from your Binder
- **Credit economy** — users receive a 5-credit welcome bonus; buying a prompt deducts credits and pays the author 70 % of the sale; copying a free prompt earns the author a small commission
- **Gamification** — XP and level system based on listings published, sales made, and saves received; badge unlocks (First Listing, First Sale, Popular, etc.) shown on your Studio card
- **Reviews** — buyers can leave a star rating + written review on any prompt they've purchased (one review per purchase, enforced server-side)
- **Collections** — group saved prompts into named collections with a custom color and vibe tag; add or remove prompts, delete collections
- **Live theming** — pick an accent color in Studio and the whole site repaints instantly, persisted across refreshes with zero flash-of-default-theme
- **Idle mascot companion** — a floating, animated buddy that follows you around the site
- **Mobile-first** — full hamburger navigation on small screens, responsive at 375 / 768 / 1280 px

| Sign in | Binder | Studio |
|---|---|---|
| ![Sign-in screen with animated mascot](docs/screenshots/auth.png) | ![Binder dashboard with collections and saved prompts](docs/screenshots/binder.png) | ![Studio profile page with theme and companion pickers](docs/screenshots/studio.png) |

### Prompt detail

![Prompt detail page showing artwork, pricing, and creator info](docs/screenshots/prompt-detail.png)

---

## 🛠 Tech stack

- **[TanStack Start](https://tanstack.com/start)** + **[TanStack Router](https://tanstack.com/router)** — full-stack React framework with file-based routing, SSR, and server functions
- **[TanStack Query](https://tanstack.com/query)** — data fetching and session caching across navigations
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **[Motion](https://motion.dev)** (Framer Motion) — scroll reveals, idle animations, reduced-motion support
- **PostgreSQL** via `pg`, with hand-rolled SQL migrations and idempotent migration tracking
- **bcryptjs** — password hashing
- **Zod** — runtime validation for all server functions
- **Vite** — dev server and bundler
- **Docker** + **GitHub Actions** — CI/CD pipeline that builds and publishes `suhaasnv/promptstar` to Docker Hub on every push to `main`

---

## 🐳 Running with Docker (recommended for collaborators)

No Node, Bun, or database setup required — just Docker Desktop.

```bash
# 1. Clone the repo
git clone https://github.com/SuhaasNv/anime-prompt-haven.git
cd anime-prompt-haven

# 2. Pull the latest image and start everything
docker compose pull
docker compose up
```

Open **http://localhost:3000** — the app and database start together; migrations run automatically on boot.

**To update to the latest version:**

```bash
docker compose pull && docker compose up
```

**To stop:**

```bash
docker compose down
```

> The `SESSION_SECRET` in `docker-compose.yml` defaults to `change-me-in-production`. For anything beyond local development, set it to a strong random string via an `.env` file or your environment.

---

## 💻 Local development (from source)

### Prerequisites

- [Bun](https://bun.sh) (v1.x) — `curl -fsSL https://bun.sh/install | bash`
- Docker Desktop (for the local Postgres database)

### 1. Install dependencies

```bash
bun install
```

### 2. Start the database

```bash
docker compose up -d postgres
```

### 3. Configure environment

```bash
cp .env.example .env
```

The defaults in `.env.example` connect to the Docker Postgres instance out of the box.

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

The app runs at **http://localhost:3000** — frontend, SSR, and server functions all from one process.

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (client + server) |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run db:migrate` | Run pending SQL migrations against `DATABASE_URL` |

---

## 🎮 Gamification system

XP is earned passively as you use the platform:

| Action | XP earned |
|---|---|
| Publish a prompt listing | +100 XP |
| Make a sale | +500 XP |
| Receive a save on your listing | +50 XP |
| Write a review | +75 XP |

Every 1 000 XP = 1 level. Your current level and XP bar are shown on your Studio card.

**Badges** unlock at milestones and are displayed on your profile:

| Badge | Condition |
|---|---|
| First Listing | Publish your first prompt |
| First Sale | Make your first sale |
| Popular | Receive 10 or more saves |
| Reviewer | Write 3 or more reviews |

---

## 💳 Credit economy

- New accounts receive **5 credits** as a welcome bonus
- **Buying a prompt**: credits are deducted from the buyer; the author receives **70 %**, the platform takes **30 %**
- **Copying a free prompt**: the original author earns a small copy commission
- Top up your balance at any time from the credits widget in the navbar

---

## 📁 Project structure

```
src/
  routes/          File-based routes — pages, loaders, head meta
  components/      Shared UI (Navbar, PromptCard, modals, mascot, credits widget)
  components/ui/   Design-system primitives (Radix UI based)
  lib/             Server functions, theme system, mascots, gamification, utilities
  styles.css       Tailwind entry + design tokens
db/
  migrations/      Versioned SQL migrations (tracked in schema_migrations table)
.github/
  workflows/       docker-publish.yml — builds and pushes image on every push to main
```

---

## 🎨 Design notes

PromptStar leans into a **pop-idol holo** look — thick black borders, hard drop shadows, neon gradients, and bouncy spring animations. The accent color (`--magenta`) is a single CSS custom property that can be re-pointed at runtime from the Studio page, repainting every `text-magenta` / `bg-magenta` / `ring-magenta` usage across the site without a full reload. Four accent options are available: Magenta, Orange, Yellow, and Purple.
