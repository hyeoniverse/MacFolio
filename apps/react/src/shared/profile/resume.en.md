# Jeonghyeon Kim

**Web Developer · Frontend-focused Full Stack**

> I build and run products end to end, from the screen to the server

hyeoniverse.dev@gmail.com · github.com/hyeoniverse · macfolio.hyeoniverse.com

## Strengths

- **Ships and operates** — Built two services solo, from planning and design to servers and deployment, and runs them on live domains
- **Only verified code ships** — Every PR must pass type checks, tests, e2e, and security scans before it deploys
- **Security background** — Information Security major; blocks data exposure up front with DB access policies and IP anonymization

## What I Do

- **UI development** — Split state-heavy screens into components and hooks, and keep server state apart from global state. `React` `TypeScript` `Next.js` `React Query` `Zustand` `Redux Toolkit` `TailwindCSS`
- **Design systems** — Keep every app's styles in one system with design tokens and lint rules. `CSS variable tokens` `Stylelint`
- **Interaction** — Scroll animations, direct-manipulation UI such as window dragging, and 3D/game screens. `GSAP` `Framer Motion` `Three.js` `Unity(C#)`
- **API · Data** — Design REST APIs and DB schemas; handle OAuth sign-in and session authorization on the server. `NestJS` `Express` `PostgreSQL` `Supabase` `Firebase`
- **Testing · Deployment** — Run unit and e2e tests on every PR and auto-deploy only commits that pass. `Vitest` `Playwright` `GitHub Actions` `Cloudflare Workers` `pnpm + Turborepo`

## Projects

### [MacFolio](#project/macfolio) | 2024.10 – | Personal · Live

A portfolio that brings the macOS desktop to the web. The Notes app is the blog, and the Messages app is the guestbook. https://macfolio.hyeoniverse.com

`React` `TypeScript` `Vite` `NestJS` `PostgreSQL` `Cloudflare`

- **Window manager and responsive shell** — A desktop with draggable, resizable windows and a Dock; on phones the same apps become an iOS home screen
- **The page is the editor** — When the admin signs in, posts turn into editors in place, so the blog runs without a separate CMS
- **Zero server cost** — NestJS and PostgreSQL on a free VM, published through Cloudflare Tunnel without opening ports
- **Safe admin auth** — GitHub OAuth allows a single admin; sessions are stored only as hashes and every request is authorized on the server

### [HYEONIVERSE](#project/hyeoniverse) | 2026.02 – | Personal · Live

A portfolio with a public site for work and writing, and an admin console to write and edit it directly. https://www.hyeoniverse.com

`Next.js` `TypeScript` `Supabase` `GSAP` `Three.js` `DeepL · Groq`

- **Fast, accessible pages** — Lighthouse performance 97, accessibility and SEO 100, LCP 0.7s
- **Permissions enforced by the DB** — Four roles (owner, admin, author, visitor) decided by 29 RLS policies; visitor IPs are anonymized after 90 days
- **AI within free tiers** — Swappable AI providers per feature, switching automatically to the next one on failure or when a free quota runs out

### [NewPick](#project/newpick) | 2024.12 – 2025.02 | Team of 5 (FE 2 · BE 3) · Frontend

A newsletter that emails AI-summarized news matched to your interests every morning.

`Next.js` `TypeScript` `Zustand` `React Query` `OpenAI`

- **Owned sign-in and auth** — Guarded My Page with protected route groups, and split server and client rendering by page type
- **Try before signing up** — Lowered the sign-up barrier with a flow that sends an AI newsletter for a single interest without logging in

### [QRU](#project/qru) | 2024.12 – 2025.01 | Personal · Improved 2026.09

A web app to create and share QR digital business cards and browse public cards by shuffling.

`React` `TypeScript` `Redux Toolkit` `Firebase`

- **Data protection without a server** — Firestore security rules restrict stored fields, and private items never go into public documents
- **Zero composite indexes** — Rewrote range queries as equality conditions so search runs on single-field indexes only

## Other Projects

- **[WTD (What To Do)](#project/whattodo)** | 2024.10 · Team of 7 — Moves guest data to the server through a bulk API on sign-in, with optimistic updates
- **[SproutFarm](#project/sproutfarm)** | 2024.06 · Personal — Procedural infinite map, A* pathfinding animal AI, tamper-proof Redis leaderboard

## Awards · Certifications · Languages

- **Bronze Prize, 2023 Pro Bono Contest · Ministry of Science and ICT** | 2023.12 — AI voice-recognition kiosk for the visually impaired
- **Excellence Award, Capstone Showcase · Seoul Women's Univ. Information Security** | 2022.12 — Online exam cheating detection; paper published at the 2023 spring conference
- **Engineer Information Processing · HRD Korea** | 2024.06
- **TOEIC 775 · ETS** | 2026.09

## Education

- **Programmers Dev-Course, 4th cohort · Web Full Cycle** | 2024.08 – 2025.02 — React · TypeScript · Node.js, 875 hours
- **Seoul Women's University** | 2020.03 – 2025.02 — B.S. Information Security, double major in Software Convergence · GPA 3.9 / 4.5
