# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Replit Auth (OIDC + PKCE) via `openid-client` v6

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── ben-admin/          # BenAdmin React+Vite dashboard (previewPath: /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # useAuth() hook for browser Replit Auth
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/ben-admin` (`@workspace/ben-admin`)

BenAdmin — private single-user admin console for Ben. React + Vite frontend at `/`.

- Replit Auth (OIDC) via `useAuth()` from `@workspace/replit-auth-web`
- Protected route system — unauthenticated users redirected to login
- Owner-only access: after login, server checks `ADMIN_USER_ID` env var; others get 403
- Sidebar with: Overview, Replit, Stripe, Marketing, Kalshi, Stocks sections
- All data sections are placeholder "coming soon" state (Task 2 adds real integrations)
- Depends on: `@workspace/api-client-react`, `@workspace/replit-auth-web`

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS (credentials:true), cookie-parser, authMiddleware, routes at `/api`
- Auth: `src/routes/auth.ts` — Replit OIDC login/callback/logout; enforces owner-only via `ADMIN_USER_ID`
- Auth middleware: `src/middlewares/authMiddleware.ts` — loads user from DB session on every request
- Auth lib: `src/lib/auth.ts` — session CRUD, OIDC config, session refresh
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /healthz`
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/auth.ts` — `sessionsTable` + `usersTable` required for Replit Auth
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`, `GetCurrentAuthUserResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Browser auth package providing `useAuth()` hook for React apps.

- Calls `GET /api/auth/user` on mount to check auth state
- `login()` — redirects to `/api/login?returnTo=<BASE_URL>`
- `logout()` — redirects to `/api/logout`
- Use this, never generated API client code, for auth operations in the browser

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## Auth Architecture

BenAdmin uses Replit Auth (OIDC with PKCE):

1. Frontend calls `login()` → redirect to `/api/login?returnTo=/`
2. Server generates OIDC params, stores code_verifier/nonce/state in cookies, redirects to Replit OIDC
3. Replit redirects to `/api/callback`
4. Server validates tokens, checks `ADMIN_USER_ID` env var (403 if not owner), creates session in DB
5. Session cookie `sid` set, redirect to `returnTo`
6. All subsequent requests: `authMiddleware` loads user from sessions table

**Owner-only access**: Set `ADMIN_USER_ID` env var to your Replit user ID. If not set, first login is allowed (self-provisioning). After your first login, set `ADMIN_USER_ID` to your user ID from the DB `users` table to lock it down.
