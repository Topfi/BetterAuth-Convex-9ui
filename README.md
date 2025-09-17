<h3 align="center">A rather comprehensive Better Auth + Convex Implementation</h3>

  <p align="center">
    Essentially a few lines of code you were likely to write anyways.
    <br />
    <br />
    &middot;
    <a href="https://github.com/Topfi/BetterAuth-Convex-9ui/issues">Report Bug</a>
    &middot;
    <a href="https://github.com/Topfi/BetterAuth-Convex-9ui/pulls">Make a Pull request</a>
  </p>
</div>

  [![React 19 badge](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=1a1a1a)](https://react.dev/)
  [![Vite badge](https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Convex badge](https://img.shields.io/badge/Convex-1.27-3b82f6?logo=convex&logoColor=white)](https://www.convex.dev/)
  [![Better Auth badge](https://img.shields.io/badge/Better%20Auth-1.3-8a2be2)](https://www.better-auth.com/)
  [![TypeScript badge](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![9ui.dev badge](https://img.shields.io/badge/9ui.dev-UI%20primitives-111827?logo=tailwindcss&logoColor=38bdf8)](https://www.9ui.dev/)
  [![License: EUPL 1.2](https://img.shields.io/badge/License-EUPL%201.2-blue.svg)](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12)

A casual-but-capable Better Auth implementation that shows how Convex and React 19 play together, whilst keeping security and DX in mind. Ships with core flows wired up, well styled UI thanks to 9ui.dev, and enough polish that you can drop it into a demo or grow it into production.

## Features

- **Full auth**: passphrase sign-up/sign-in, passphrase resets, email verification, magic links, and one-time codes all reuse shared Zod schemas so the client and Convex agree on every payload.
- **Social sign-in + linking**: GitHub, Google, and Apple OAuth work out of the box once you drop in credentials, and the UI/helpers are ready for future providers. Account linking is enabled.
- **Security niceties**: Email OTP plugin doubles as step-up verification, passphrase helpers centralize zxcvbn + Have I Been Pwned checks through the Better Auth plugin, enforce a 16+ character policy, and drive the shared color-coded strength meter.
- **Rate limiting + audit trails**: Better Auth's built-in limiter is persisted to Convex for consistent enforcement across pods, and destructive operations (like account deletion) append structured audit logs for later review.
- **Productized UX**: Sign-in/up cards follow the gradient shell, toast helpers map to severity colors, and the application header keeps avatars and primary actions (settings + sign-out) consistent.
- **Composable signed-in shell**: The authenticated experience is routed through a single layout so you can swap the default application without touching auth plumbing.
- **Settings**: A dedicated settings surface lets users edit their profile, trigger email reverification, rotate passphrases with generators + breach checks, preview the forthcoming 2FA flow, export data, and type-to-confirm account deletion.
- **DX-friendly env bootstrap**: `npm run setup:env` keeps `.env.local` aligned with the shared template and syncs Convex secrets, so spinning up a fresh machine or new deployment slug is painless.
- **Realtime counter sample**: Shared `counter` module keeps optimistic UI, Convex mutations, and account deletion purging perfectly in sync.
- **Email preview/dev mode**: Flip one flag to dump rendered React Email templates to the console instead of hitting Resend.
- **Easter Egg**: I included a small, but very nerdy easter egg for you to find.

## Why 9ui.dev

9ui.dev is a curated catalog of Base UI primitives dressed with Tailwind CSS that you copy into the repo instead of installing from npm. Now, that may sound very familiar to you and yes, it uses the same principle and even the CLI employed by shadcn/ui. So why not just rely on shadcn/ui over a far newer project? Partly, because the Base UI team (which does have prior experience working on Radix Primitives (the ones used by shadcn/ui), Material UI, and Floating UI) seem to essentially use this as a new starting point, using what worked and what may not have been so successful from their prior projects, which I find very appealing, considering how many times I have redone code in my time. Mainly though, if I'm being honest, I just like being early to new stuff and learning a project so early on has its appeal. Despite their young age, 9ui.dev and Base UI are already very mature and I enjoy them thouroughly. Incedentally,it is 01:52 AM whilst I am typing these words, and I only now realised that 9ui isn't just randomly named. Yeah, I should probably go to bed soon...

## Why zxcvbn + Have I Been Pwned

zxcvbn has been my go-to entropy gut check for years because it encodes so much practical knowledge about how people actually assemble passphrases. Pairing that with Have I Been Pwned just makes sense: if the zxcvbn score tells you how resilient your passphrase might be, HIBP tells you whether the exact string has already been a part of one of the many data breaches we somehow have just come to accept. I've been following Troy Hunt's work since the early 2010s (thanks to SemperVideo back in the day), long enough to see the steady stream of "why did you hack me" mails he still receives despite repeatedly explaining what the service actually does. Anyone who keeps volunteering that kind of community service in the face of persistent misunderstandings can be relied upon in my book. The fact that there is an amazingly handy HIBP plugin for Better Auth which made this basically a five line process is of course a pure coincidence...

## Why Better Auth

Yes, Better Auth is new and that will, worringly, always attract me to some extend, but it does help that the team really seems to have DX in mind, on top of solid defaults for security. Convex integration becoming more solid by the day, along with those plugins I mentioned before, made it comparatively straight forward, dare I say it, pleasant (a word that generally doesn't come within the same stratosphere as auth). What also helped was a Hackathon I stumbled across yesterday and a lot of Sodastream Pepsi Max. Like, a medically inadvisable amount.

## Stack Snapshot

- React 19 with the React Compiler + Vite 7
- Convex backend with Better Auth server plugin suite (magic link, email OTP, account linking, cross-domain)
- Base UI primitives + Tailwind CSS v4 curtesy of 9ui.dev (under `src/components/ui`)
- React Hook Form + Zod for synced validation
- Vitest + Testing Library for unit and component coverage

## Getting Started

### Prerequisites

- The Convex CLI (`npm install -g convex` or use `npx convex ...`)
- Resend API key if you want to send real mail (optional in development)
- OTP API key if you want to use Google, Github or Apple OAuth

### Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Initialize your environment (each command is safe to re-run):
   ```bash
   npm run setup:env
   npx convex dev --once
   npm run setup:env
   ```
   The setup script bootstraps `.env.local`, keeps it aligned with `.env.example`,
   and syncs shared flags into your Convex environment once a deployment slug
   exists. If you already have a deployment selected you only need to run the
   script once.
3. Start both the frontend and Convex dev server:
   ```bash
   npm run dev
   ```

The app lives at `http://localhost:5173`. Convex functions are exposed at `http://127.0.0.1:8187` during dev.

## Adapting to Your Own App

1. Swap `src/components/Counter.tsx` (wired up in `src/App.tsx`) with your own feature component or route tree.
2. Put any shared schemas or helpers in `shared/<feature>.ts`, mirror backend logic under `src/features/<feature>` and `convex/features/<feature>.ts`, and register new data purgers in `convex/features/authDomain/userDataRegistrations.ts`.
3. Build UI with primitives from `src/components/ui` and fire toasts via `src/lib/toast` so behavior and styling stay consistent.

Follow those steps and you can drop in a bespoke React surface without disturbing authentication or Convex wiring.

### Helpful Scripts

- `npm run setup:env` – align `.env.local` with the template and sync Convex env values (`--dry-run`/`--skip-convex` available).
- `npm run check` – type check, lint, formatting verification, and Vitest.
- `npm run audit` – secretlint plus `npm audit --audit-level=moderate`.
- `npm run test` – run Vitest directly (useful while iterating).
- `npm run logs` – stream Convex logs from your active deployment.

## Environment Reference

| Location     | Key                                         | Purpose                                                                           |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `.env.local` | `VITE_CONVEX_URL`                           | Convex deployment URL used by the Vite dev server (auto-set during `convex dev`). |
| `.env.local` | `VITE_CONVEX_SITE_URL`                      | Base URL Better Auth uses for API calls from the browser.                         |
| `.env.local` | `VITE_SITE_URL`                             | Public site URL surfaced in emails and redirects (defaults to local dev).         |
| `.env.local` | `VITE_SIGNIN_ENABLE_PASSPHRASE`             | `true` to keep the passphrase form visible on the sign-in screen.                 |
| `.env.local` | `VITE_SIGNIN_ENABLE_MAGIC_LINK`             | `true` exposes magic link sign-in alongside other passphraseless flows.           |
| `.env.local` | `VITE_SIGNIN_ENABLE_OTP`                    | `true` enables email one-time code sign-in (and verification UI).                 |
| `.env.local` | `VITE_SIGNIN_ENABLE_GOOGLE`                 | `true` shows the Google sign-in button when credentials are configured.           |
| `.env.local` | `VITE_SIGNIN_ENABLE_GITHUB`                 | `true` shows the GitHub sign-in button when credentials are configured.           |
| `.env.local` | `VITE_SIGNIN_ENABLE_APPLE`                  | `true` shows the Apple sign-in button when credentials are configured.            |
| Convex env   | `SITE_URL`                                  | Same as `VITE_SITE_URL`, but consumed on the server.                              |
| Convex env   | `BETTER_AUTH_SECRET`                        | Symmetric secret Better Auth uses to sign sessions.                               |
| Convex env   | `BETTERAUTH_EMAIL_CONSOLE_PREVIEW`          | `true` to log rendered emails instead of sending them.                            |
| Convex env   | `BETTERAUTH_EMAIL_BRAND_NAME`               | Optional brand name override surfaced in all transactional emails.                |
| Convex env   | `BETTERAUTH_EMAIL_BRAND_TAGLINE`            | Optional tagline override displayed in email footers.                             |
| Convex env   | `BETTERAUTH_EMAIL_BRAND_LOGO_URL`           | Optional logo URL rendered alongside email content when provided.                 |
| Convex env   | `BETTERAUTH_RATE_LIMIT_ENABLED`             | Override the default limiter toggle (`true` or `false`).                          |
| Convex env   | `BETTERAUTH_RATE_LIMIT_WINDOW_SECONDS`      | Optional override controlling the limiter window in seconds.                      |
| Convex env   | `BETTERAUTH_RATE_LIMIT_MAX_REQUESTS`        | Optional override for allowed requests within each window.                        |
| Convex env   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth pair for social sign-in.                                    |
| Convex env   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth pair for social sign-in.                                    |
| Convex env   | `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`   | Optional Apple OAuth pair for social sign-in.                                     |
| Convex env   | `APPLE_APP_BUNDLE_IDENTIFIER`               | Optional bundle identifier when signing in with native Apple ID tokens.           |
| Convex env   | `RESEND_API_KEY`                            | Unlocks live delivery through Resend.                                             |
