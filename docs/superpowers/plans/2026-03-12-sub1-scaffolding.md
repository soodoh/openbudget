# Sub-project 1: Scaffolding — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the OpenBudget monorepo with the same stack and patterns as [swanki](https://github.com/soodoh/swanki), including auth, full DB schema, Dockerfile, app shell, and budget CRUD.

**Architecture:** Turborepo monorepo with a TanStack Start web app. SQLite + Drizzle ORM for persistence. better-auth for authentication. Budget-scoped authorization via middleware. All patterns mirror swanki.

**Tech Stack:** Bun 1.3.10, Turborepo, TanStack Start/Router, React 19, React Query, Drizzle ORM, SQLite (bun:sqlite), better-auth, Tailwind CSS v4, shadcn/ui, Zod, Vitest, Playwright, oxlint, Prettier

**Reference codebase:** `/Users/pauldiloreto/Projects/swanki` — all patterns, configs, and conventions are derived from this project. When the plan says "same as swanki," refer to the corresponding file in that repo.

**Spec:** `docs/superpowers/specs/2026-03-12-openbudget-design.md`

---

## File Structure

### Root (monorepo config)

| File | Purpose |
|------|---------|
| `package.json` | Monorepo root — workspaces, scripts, dev deps |
| `turbo.json` | Turborepo task definitions |
| `.nvmrc` | Node version (24.14.0) |
| `commitlint.config.ts` | Conventional commits, no scopes |
| `.prettierrc` | Prettier defaults |
| `.prettierignore` | Ignore build outputs |
| `.gitignore` | Comprehensive ignore list |
| `.husky/pre-commit` | lint-staged hook |
| `.husky/commit-msg` | commitlint hook |
| `Dockerfile` | Single-stage Bun Docker image |
| `.dockerignore` | Keep image small |

### `apps/web/` (main application)

| File | Purpose |
|------|---------|
| `package.json` | Web app deps and scripts |
| `tsconfig.json` | TypeScript config with `@/*` alias |
| `vite.config.ts` | Vite + TanStack Start + Nitro + Tailwind |
| `drizzle.config.ts` | Drizzle migration config |
| `vitest.config.ts` | Vitest unit test config |
| `playwright.config.ts` | Playwright e2e config |
| `oxlint.config.mjs` | Linting rules |
| `components.json` | shadcn/ui config |
| `.env.example` | Example environment variables |

### `apps/web/src/db/` (database)

| File | Purpose |
|------|---------|
| `index.ts` | DB singleton — Drizzle + bun:sqlite, WAL mode, foreign keys |
| `auth-schema.ts` | better-auth tables (user, session, account, verification) |
| `schema.ts` | All app tables — budget, budgetMember, categoryGroup, category, monthlyBudget, financialAccount, transaction, transactionSplit, scheduledTransaction, payee, target, importMapping |

### `apps/web/src/lib/` (business logic)

| File | Purpose |
|------|---------|
| `auth.ts` | better-auth setup with Drizzle adapter |
| `auth-client.ts` | Client-side auth client |
| `auth-middleware.ts` | `getSession()`, `requireSession()`, `requireBudgetAccess()` |
| `auth-session.ts` | Server functions for session/theme |
| `utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `id.ts` | `generateId()` — crypto.randomUUID |
| `theme.tsx` | ThemeProvider + useTheme hook |
| `currency.ts` | `getMinorUnitExponent(currencyCode)` utility |
| `services/budget-service.ts` | Budget CRUD + membership |
| `services/user-settings-service.ts` | Theme get/set |

### `apps/web/src/routes/` (pages + API)

| File | Purpose |
|------|---------|
| `__root.tsx` | Root layout — QueryClient, ThemeProvider, meta |
| `login.tsx` | Login page (email/password + OAuth) |
| `register.tsx` | Registration page |
| `_authenticated.tsx` | Auth guard layout — redirects to /login |
| `_authenticated/index.tsx` | Budget list / dashboard |
| `_authenticated/budgets/$budgetId.tsx` | Empty budget view (placeholder for Sub-project 2) |
| `api/auth/$.ts` | better-auth catch-all handler |
| `api/budgets/index.ts` | GET (list) + POST (create) budgets |
| `api/budgets/$budgetId.ts` | GET + PATCH + DELETE budget |
| `api/settings/theme.ts` | GET + PUT user theme |

**Note on TanStack Start entry points:** TanStack Start auto-generates `app.config.ts` and related files (`app/client.tsx`, `app/server.tsx`, `app/ssr.tsx`) when you first run `bun --bun vite dev`. These are generated artifacts managed by TanStack Start — do not create them manually. The `routeTree.gen.ts` file is also auto-generated and is in `.gitignore`.

### `apps/web/src/components/` (UI)

| File | Purpose |
|------|---------|
| `app-shell.tsx` | Main layout — sidebar + header + content |
| `sidebar.tsx` | Navigation sidebar with budget list |
| `ui/` | shadcn/ui components (installed via CLI) |

### `apps/web/src/lib/hooks/` (React Query)

| File | Purpose |
|------|---------|
| `use-budgets.ts` | Hooks for budget list query and create mutation |

### `apps/web/src/__tests__/` (tests)

| File | Purpose |
|------|---------|
| `test-utils.ts` | In-memory SQLite test DB factory |
| `lib/budget-service.test.ts` | Budget service unit tests |
| `lib/budget-access.test.ts` | Budget access control middleware tests |
| `lib/currency.test.ts` | Currency utility tests |

### `apps/web/src/styles/`

| File | Purpose |
|------|---------|
| `globals.css` | Tailwind imports, shadcn theme vars, Geist font |

### Placeholder workspaces

| File | Purpose |
|------|---------|
| `apps/docs/package.json` | Placeholder — `echo "docs placeholder"` |
| `apps/mobile/package.json` | Placeholder — `echo "mobile placeholder"` |

---

## Chunk 1: Monorepo Bootstrap + Configs

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `.nvmrc`
- Create: `commitlint.config.ts`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `.husky/pre-commit`
- Create: `.husky/commit-msg`
- Modify: `.gitignore` (replace single-line file with full version)

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "openbudget-monorepo",
  "private": true,
  "packageManager": "bun@1.3.10",
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "turbo dev --filter=web",
    "dev:docs": "turbo dev --filter=docs",
    "dev:mobile": "turbo dev --filter=mobile",
    "build": "turbo build",
    "lint": "turbo lint",
    "lint:fix": "turbo lint:fix",
    "test": "turbo test",
    "test:run": "turbo test:run",
    "lint-staged": "lint-staged",
    "prepare": "husky"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.8.0",
    "@commitlint/config-conventional": "^19.8.0",
    "@commitlint/types": "^19.8.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.3.2",
    "oxlint": "^1.51.0",
    "prettier": "^3.5.3",
    "turbo": "^2.4.4"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": "prettier --write",
    "*.{css,html,json,md,mdx,yaml,yml}": "prettier --write"
  }
}
```

- [ ] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**", "dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "start": {
      "persistent": true,
      "cache": false
    },
    "lint": {},
    "lint:fix": {},
    "test": {},
    "test:run": {}
  }
}
```

- [ ] **Step 3: Create remaining config files**

`.nvmrc`:
```
24.14.0
```

`commitlint.config.ts`:
```typescript
import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "always"],
  },
};

export default config;
```

`.prettierrc`:
```json
{}
```

`.prettierignore`:
```
.output
node_modules
apps/web/.output
apps/web/node_modules
```

- [ ] **Step 4: Replace `.gitignore` with full version**

```gitignore
# Dependencies
node_modules/

# Build outputs
.output/
dist/
.next/
out/

# Turbo
.turbo/

# TanStack
.tanstack/
**/routeTree.gen.ts

# Environment files
.env
.env.*
!.env.example

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# Database
*.db
*.db-shm
*.db-wal

# User data
apps/web/data/

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/

# Playwright
apps/web/e2e/.auth/
apps/web/test-results/
apps/web/playwright-report/

# Worktrees
.worktrees/

# Superpowers brainstorm sessions
.superpowers/

# Claude/Serena
.serena/
.claude/sessions/
```

- [ ] **Step 5: Create husky hooks**

`.husky/pre-commit`:
```
bun run lint-staged
```

`.husky/commit-msg`:
```
bunx commitlint --edit $1
```

- [ ] **Step 6: Create placeholder workspaces**

`apps/docs/package.json`:
```json
{
  "name": "docs",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "echo 'docs placeholder'",
    "build": "echo 'docs placeholder'"
  }
}
```

`apps/mobile/package.json`:
```json
{
  "name": "mobile",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "echo 'mobile placeholder'",
    "build": "echo 'mobile placeholder'"
  }
}
```

- [ ] **Step 7: Install dependencies and verify**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun install`
Expected: Dependencies install successfully, `bun.lock` is created.

- [ ] **Step 8: Commit**

```bash
git add package.json turbo.json .nvmrc commitlint.config.ts .prettierrc .prettierignore .gitignore .husky/ apps/docs/ apps/mobile/ bun.lock
git commit -m "feat: initialize monorepo with turborepo and tooling configs"
```

---

### Task 2: Create web app with configs

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/drizzle.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/oxlint.config.mjs`
- Create: `apps/web/components.json`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun --bun vite dev",
    "build": "bun --bun vite build",
    "start": "bun run .output/server/index.mjs",
    "lint": "bun x oxlint -c oxlint.config.mjs . && prettier --check .",
    "lint:fix": "bun x oxlint -c oxlint.config.mjs --fix . && prettier --write .",
    "test": "bun --bun vitest",
    "test:run": "bun --bun vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  },
  "dependencies": {
    "@fontsource-variable/geist": "^5.2.8",
    "@tailwindcss/vite": "^4.2.1",
    "@tanstack/react-query": "^5.90.21",
    "@tanstack/react-router": "^1.166.2",
    "@tanstack/react-start": "^1.166.2",
    "better-auth": "^1.5.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.45.1",
    "lucide-react": "^0.577.0",
    "nitro": "^3.0.1-alpha.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "shadcn": "^4.0.0",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "vite": "^7.3.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@standard-config/oxlint": "^1.4.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.4.1",
    "better-sqlite3": "^12.6.2",
    "drizzle-kit": "^0.31.9",
    "jsdom": "^28.1.0",
    "oxlint": "^1.51.0",
    "oxlint-tsgolint": "^0.16.0",
    "prettier": "^3.5.3",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.8.3",
    "vite-tsconfig-paths": "^4.3.2",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```typescript
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of Object.keys(env)) {
    process.env[key] ??= env[key];
  }
  return {
    server: {
      port: 3000,
      watch: { ignored: ["**/data/**"] },
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths(),
      tanstackStart(),
      nitro({ preset: "bun" }),
      viteReact(),
    ],
  };
});
```

- [ ] **Step 4: Create `apps/web/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "data/sqlite.db",
  },
});
```

- [ ] **Step 5: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
```

- [ ] **Step 6: Create `apps/web/playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DATABASE_URL: "sqlite-e2e.db",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 7: Create `apps/web/oxlint.config.mjs`**

```javascript
import { defineConfig } from "@standard-config/oxlint";

export default defineConfig({
  react: true,
  ignorePatterns: ["node_modules/**", ".output/**", "src/routeTree.gen.ts"],
  rules: {},
  overrides: [
    {
      files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      rules: {
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/await-thenable": "off",
      },
    },
  ],
});
```

- [ ] **Step 8: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

- [ ] **Step 9: Create `apps/web/.env.example`**

```
BETTER_AUTH_SECRET=dev-secret-change-in-production
BETTER_AUTH_URL=http://localhost:3000
VITE_BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
GITHUB_CLIENT_ID=placeholder
GITHUB_CLIENT_SECRET=placeholder
DATABASE_URL=./data/sqlite.db
```

Also copy this file to `apps/web/.env.local` for local development.

- [ ] **Step 10: Install dependencies**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun install`
Expected: All dependencies install. `bun.lock` updates.

- [ ] **Step 11: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/drizzle.config.ts apps/web/vitest.config.ts apps/web/playwright.config.ts apps/web/oxlint.config.mjs apps/web/components.json apps/web/.env.example bun.lock
git commit -m "feat: add web app workspace with build and test configs"
```

---

## Chunk 2: Database Schema + Utilities

### Task 3: Create currency utility with tests (TDD)

**Files:**
- Create: `apps/web/src/lib/currency.ts`
- Create: `apps/web/src/__tests__/lib/currency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/currency.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getMinorUnitExponent, toMinorUnits, fromMinorUnits } from "@/lib/currency";

describe("currency", () => {
  describe("getMinorUnitExponent", () => {
    it("returns 2 for USD", () => {
      expect(getMinorUnitExponent("USD")).toBe(2);
    });

    it("returns 2 for EUR", () => {
      expect(getMinorUnitExponent("EUR")).toBe(2);
    });

    it("returns 0 for JPY", () => {
      expect(getMinorUnitExponent("JPY")).toBe(0);
    });

    it("returns 3 for BHD", () => {
      expect(getMinorUnitExponent("BHD")).toBe(3);
    });

    it("defaults to 2 for unknown currencies", () => {
      expect(getMinorUnitExponent("XYZ")).toBe(2);
    });
  });

  describe("toMinorUnits", () => {
    it("converts 45.67 USD to 4567", () => {
      expect(toMinorUnits(45.67, "USD")).toBe(4567);
    });

    it("converts 1000 JPY to 1000", () => {
      expect(toMinorUnits(1000, "JPY")).toBe(1000);
    });

    it("converts 1.234 BHD to 1234", () => {
      expect(toMinorUnits(1.234, "BHD")).toBe(1234);
    });
  });

  describe("fromMinorUnits", () => {
    it("converts 4567 USD cents to 45.67", () => {
      expect(fromMinorUnits(4567, "USD")).toBe(45.67);
    });

    it("converts 1000 JPY to 1000", () => {
      expect(fromMinorUnits(1000, "JPY")).toBe(1000);
    });

    it("converts 1234 BHD fils to 1.234", () => {
      expect(fromMinorUnits(1234, "BHD")).toBe(1.234);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/currency.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/currency.ts`:

```typescript
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND",
]);

export function getMinorUnitExponent(currencyCode: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currencyCode)) return 3;
  return 2;
}

export function toMinorUnits(amount: number, currencyCode: string): number {
  const exponent = getMinorUnitExponent(currencyCode);
  return Math.round(amount * 10 ** exponent);
}

export function fromMinorUnits(minorUnits: number, currencyCode: string): number {
  const exponent = getMinorUnitExponent(currencyCode);
  return minorUnits / 10 ** exponent;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/currency.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/currency.ts apps/web/src/__tests__/lib/currency.test.ts
git commit -m "feat: add currency utility with minor unit conversion"
```

---

### Task 4: Create core utilities

**Files:**
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/lib/id.ts`

- [ ] **Step 1: Create `apps/web/src/lib/utils.ts`**

```typescript
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `apps/web/src/lib/id.ts`**

```typescript
export function generateId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/utils.ts apps/web/src/lib/id.ts
git commit -m "feat: add cn utility and id generator"
```

---

### Task 5: Create database schema

**Files:**
- Create: `apps/web/src/db/auth-schema.ts`
- Create: `apps/web/src/db/schema.ts`
- Create: `apps/web/src/db/index.ts`

- [ ] **Step 1: Create `apps/web/src/db/auth-schema.ts`**

Copy exactly from swanki (`/Users/pauldiloreto/Projects/swanki/apps/web/src/db/auth-schema.ts`). Same 4 tables: `user`, `session`, `account`, `verification`. Keep the `theme` column on `user` for theme persistence.

- [ ] **Step 2: Create `apps/web/src/db/schema.ts`**

Must start with re-exporting auth tables:
```typescript
export { user, session, account, verification } from "./auth-schema";
```

Then define all app tables: `budget`, `budgetMember`, `categoryGroup`, `category`, `monthlyBudget`, `financialAccount` (named to avoid collision with auth `account` table), `payee`, `transaction`, `transactionSplit`, `scheduledTransaction`, `target`, `importMapping`.

Each table follows the swanki pattern:
- `text("id").primaryKey()` for UUIDs
- `integer("created_at", { mode: "timestamp_ms" })` with SQL default
- `integer("updated_at", { mode: "timestamp_ms" })` with `$onUpdate(() => new Date())`
- Proper foreign keys with `onDelete` behavior
- Indexes on FK columns and frequently queried fields
- Unique indexes where needed (e.g., `budgetMember` on `budgetId + userId`)

See the spec `docs/superpowers/specs/2026-03-12-openbudget-design.md` for the complete table definitions and column details.

- [ ] **Step 3: Create `apps/web/src/db/index.ts`**

```typescript
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

// oxlint-disable-next-line typescript-eslint(no-unsafe-member-access) -- process.env typed as any in Bun
const envVars = process.env as Record<string, string | undefined>;
// oxlint-disable-next-line typescript-eslint(no-unsafe-assignment),typescript-eslint(no-unsafe-call) -- bun:sqlite Database constructor typed as any
const sqlite = new Database(envVars.DATABASE_URL ?? "data/sqlite.db");
const sqliteTyped = sqlite as unknown as { exec(sql: string): void };
sqliteTyped.exec("PRAGMA journal_mode = WAL;");
sqliteTyped.exec("PRAGMA foreign_keys = ON;");

// oxlint-disable-next-line typescript-eslint(no-unsafe-argument) -- sqlite typed as any from bun:sqlite
export const db = drizzle(sqlite, { schema });
```

- [ ] **Step 4: Generate initial migration**

Run: `cd apps/web && bun x drizzle-kit generate`
Expected: Migration files created in `apps/web/drizzle/`

- [ ] **Step 5: Add auto-migration on startup**

Update `apps/web/src/db/index.ts` to run migrations on import:

```typescript
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// ... after creating db ...
migrate(db, { migrationsFolder: "./drizzle" });
```

This ensures the database schema is always up-to-date when the app starts, both in development and in Docker deployments. Drizzle migrations are idempotent — running them on an already-migrated DB is a no-op.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/db/ apps/web/drizzle/
git commit -m "feat: add complete database schema with all tables and auto-migration"
```

---

### Task 6: Create test utilities

**Files:**
- Create: `apps/web/src/__tests__/test-utils.ts`

- [ ] **Step 1: Create test utility**

```typescript
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../db/schema";

export function createTestDb(): BunSQLiteDatabase<typeof schema> {
  // oxlint-disable-next-line typescript-eslint(no-unsafe-assignment),typescript-eslint(no-unsafe-call) -- bun:sqlite Database types are inferred as any
  const sqlite = new Database(":memory:");
  const sqliteTyped = sqlite as unknown as { exec(sql: string): void };
  sqliteTyped.exec("PRAGMA foreign_keys = ON;");
  // oxlint-disable-next-line typescript-eslint(no-unsafe-argument) -- sqlite typed as any from bun:sqlite
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/__tests__/test-utils.ts
git commit -m "feat: add in-memory test database factory"
```

---

## Chunk 3: Auth + Budget Service (TDD)

### Task 7: Set up authentication

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/auth-client.ts`
- Create: `apps/web/src/lib/auth-middleware.ts`
- Create: `apps/web/src/lib/auth-session.ts`
- Create: `apps/web/src/lib/services/user-settings-service.ts`

- [ ] **Step 1: Create `apps/web/src/lib/auth.ts`**

Same pattern as swanki but without `databaseHooks` (no post-signup hooks needed in this sub-project):

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

// oxlint-disable-next-line typescript-eslint(no-unsafe-member-access) -- process.env typed as any in Bun
const envVars = process.env as Record<string, string | undefined>;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: envVars.GOOGLE_CLIENT_ID ?? "",
      clientSecret: envVars.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: envVars.GITHUB_CLIENT_ID ?? "",
      clientSecret: envVars.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});
```

- [ ] **Step 2: Create `apps/web/src/lib/auth-client.ts`**

Copy from swanki — no changes needed.

- [ ] **Step 3: Create `apps/web/src/lib/auth-middleware.ts`**

Same as swanki's `getSession()` and `requireSession()`, plus the new `requireBudgetAccess()` function that checks `budgetMember` table for the user's role. Uses a role hierarchy (viewer=0 < editor=1 < owner=2) to enforce minimum required role. Returns the session augmented with `budgetRole`.

- [ ] **Step 4: Create `apps/web/src/lib/auth-session.ts`**

Same pattern as swanki — server functions for `getSession()` and `getUserTheme()` using `createServerFn`.

- [ ] **Step 5: Create `apps/web/src/lib/services/user-settings-service.ts`**

Same as swanki — `getTheme(userId)` and `setTheme(userId, theme)` methods.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/lib/auth-client.ts apps/web/src/lib/auth-middleware.ts apps/web/src/lib/auth-session.ts apps/web/src/lib/services/user-settings-service.ts
git commit -m "feat: add authentication with budget-scoped access control"
```

---

### Task 8: Test budget access control (TDD)

**Files:**
- Create: `apps/web/src/__tests__/lib/budget-access.test.ts`

**Important:** `requireBudgetAccess()` is new security-critical logic not present in swanki. It must be tested.

- [ ] **Step 1: Write tests for budget access control**

Create `apps/web/src/__tests__/lib/budget-access.test.ts` with tests for the authorization logic. Since `requireBudgetAccess()` depends on the HTTP request/auth flow, test the underlying role checking logic by directly querying `budgetMember` and verifying role hierarchy behavior. Tests should cover:
- User with `owner` role can access when `minRole` is `viewer`, `editor`, or `owner`
- User with `editor` role can access when `minRole` is `viewer` or `editor`, but NOT `owner`
- User with `viewer` role can access only when `minRole` is `viewer`
- Non-member user gets denied access

Seed test users and budget members using `createTestDb()`, then test the role hierarchy logic extracted into a testable helper.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/budget-access.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement and verify**

Ensure the role hierarchy logic in `auth-middleware.ts` passes all tests.

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/budget-access.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/__tests__/lib/budget-access.test.ts
git commit -m "test: add budget access control authorization tests"
```

---

### Task 9: Create budget service with tests (TDD)

**Files:**
- Create: `apps/web/src/lib/services/budget-service.ts`
- Create: `apps/web/src/__tests__/lib/budget-service.test.ts`

**Important:** Follow the swanki service pattern — a **class** that accepts `db: BunSQLiteDatabase<typeof schema>` in the constructor. This enables dependency injection for testing (pass in-memory DB from `createTestDb()`). Do NOT import `db` directly from `../db`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/lib/budget-service.test.ts` with tests for:
- `create()` — creates budget and adds creator as owner
- `create()` — defaults currency to USD
- `listForUser()` — returns only budgets the user is a member of
- `getById()` — returns budget or undefined
- `update()` — updates budget name
- `delete()` — deletes budget and cascades to members

Each test creates an in-memory DB via `createTestDb()`, seeds test users, and passes the DB to `new BudgetService(db)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/budget-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/services/budget-service.ts` as a class:

```typescript
export class BudgetService {
  constructor(private db: BunSQLiteDatabase<typeof schema>) {}
  // methods...
}
```

Methods:
- `create(userId, { name, currency? })` — inserts budget + budgetMember (owner)
- `listForUser(userId)` — joins budget + budgetMember, filters by userId
- `getById(budgetId)` — simple select
- `update(budgetId, { name? })` — update budget
- `delete(budgetId)` — delete budget (cascade handles members)

Uses `generateId()` for UUIDs. All methods are synchronous (bun:sqlite).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && bun --bun vitest run src/__tests__/lib/budget-service.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/services/budget-service.ts apps/web/src/__tests__/lib/budget-service.test.ts
git commit -m "feat: add budget service with CRUD and membership"
```

---

## Chunk 4: UI Shell + Routes

### Task 9: Install shadcn/ui components and create styles

**Files:**
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/components/ui/` (multiple files via shadcn CLI)

- [ ] **Step 1: Create `apps/web/src/styles/globals.css`**

Copy from swanki — keep all CSS variable definitions, Tailwind imports, and theme setup. Remove the swanki-specific `.sound-player` and `.sound-btn` styles at the bottom.

- [ ] **Step 2: Install required shadcn/ui components**

Run from `apps/web/`:
```bash
bunx shadcn@latest add button card input label separator tooltip sidebar avatar dropdown-menu dialog
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/ apps/web/src/components/ui/
git commit -m "feat: add global styles and shadcn/ui components"
```

---

### Task 10: Create theme provider and app shell

**Files:**
- Create: `apps/web/src/lib/theme.tsx`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/sidebar.tsx`

- [ ] **Step 1: Create `apps/web/src/lib/theme.tsx`**

Copy from swanki — no changes needed. ThemeProvider, useTheme(), and applyThemeClass() work identically.

- [ ] **Step 2: Create `apps/web/src/components/app-shell.tsx`**

Adapt from swanki. Change header title from "Swanki" to "OpenBudget". Keep the theme cycle button and sidebar integration.

- [ ] **Step 3: Create `apps/web/src/components/sidebar.tsx`**

Adapt from swanki. Replace nav items with OpenBudget items: "Budgets" (/) and "Settings" (/settings). Change branding from "Swanki / Spaced Repetition" to "OpenBudget / Envelope Budgeting". Change logo initial from "S" to "OB".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/theme.tsx apps/web/src/components/app-shell.tsx apps/web/src/components/sidebar.tsx
git commit -m "feat: add theme provider, app shell, and sidebar navigation"
```

---

### Task 11: Create routes

**Files:**
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/register.tsx`
- Create: `apps/web/src/routes/_authenticated.tsx`
- Create: `apps/web/src/routes/_authenticated/index.tsx`
- Create: `apps/web/src/routes/api/auth/$.ts`
- Create: `apps/web/src/routes/api/settings/theme.ts`
- Create: `apps/web/src/routes/_authenticated/budgets/$budgetId.tsx`
- Create: `apps/web/src/routes/api/budgets/index.ts`
- Create: `apps/web/src/routes/api/budgets/$budgetId.ts`
- Create: `apps/web/src/lib/hooks/use-budgets.ts`

- [ ] **Step 1: Create `apps/web/src/routes/__root.tsx`**

Adapt from swanki — change title to "OpenBudget", keep everything else (QueryClientProvider, ThemeProvider, TooltipProvider, theme init script).

- [ ] **Step 2: Create `apps/web/src/routes/login.tsx`**

Copy from swanki — change "Swanki" to "OpenBudget" in the card title.

- [ ] **Step 3: Create `apps/web/src/routes/register.tsx`**

Copy from swanki — change "Swanki" to "OpenBudget" in the card title.

- [ ] **Step 4: Create `apps/web/src/routes/_authenticated.tsx`**

Copy from swanki — no changes needed.

- [ ] **Step 5: Create `apps/web/src/routes/_authenticated/index.tsx`**

Budget list page with:
- Query hook to fetch `GET /api/budgets`
- "New Budget" button that opens a Dialog with name + currency inputs
- Mutation to `POST /api/budgets`
- Grid of budget cards (clickable, for future navigation to budget view)
- Empty state when no budgets exist

- [ ] **Step 6: Create `apps/web/src/routes/_authenticated/budgets/$budgetId.tsx`**

Empty budget view placeholder — this is where Sub-project 2 (Budget Grid) will build. For now, just display the budget name.

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/budgets/$budgetId")({
  component: BudgetViewPage,
});

function BudgetViewPage(): React.ReactElement {
  const { budgetId } = Route.useParams();
  return (
    <div>
      <h2 className="text-2xl font-bold">Budget View</h2>
      <p className="text-muted-foreground">Budget ID: {budgetId}</p>
      <p className="text-muted-foreground">Budget grid will be built in Sub-project 2.</p>
    </div>
  );
}
```

- [ ] **Step 7: Create `apps/web/src/lib/hooks/use-budgets.ts`**

Extract React Query logic from the dashboard page into a reusable hook:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await fetch("/api/budgets");
      if (!res.ok) throw new Error("Failed to fetch budgets");
      return res.json() as Promise<
        Array<{ id: string; name: string; currency: string; role: string }>
      >;
    },
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; currency: string }) => {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create budget");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
```

The `_authenticated/index.tsx` page should use these hooks instead of inlining the query/mutation logic.

- [ ] **Step 8: Create `apps/web/src/routes/api/auth/$.ts`**

Same as swanki — catch-all for better-auth GET/POST.

- [ ] **Step 9: Create `apps/web/src/routes/api/settings/theme.ts`**

GET and PUT handlers using `requireSession()` and `UserSettingsService`.

- [ ] **Step 10: Create `apps/web/src/routes/api/budgets/index.ts`**

GET handler: `requireSession()` then `budgetService.listForUser(userId)`.
POST handler: `requireSession()` then `budgetService.create(userId, body)`.

API route instantiates service at module level: `const budgetService = new BudgetService(db);`

- [ ] **Step 11: Create `apps/web/src/routes/api/budgets/$budgetId.ts`**

GET handler: `requireBudgetAccess(request, budgetId)` then `budgetService.getById()`.
PATCH handler: `requireBudgetAccess(request, budgetId, "editor")` then `budgetService.update()`.
DELETE handler: `requireBudgetAccess(request, budgetId, "owner")` then `budgetService.delete()`.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/routes/ apps/web/src/lib/hooks/
git commit -m "feat: add routes for auth, dashboard, budget API, and settings"
```

---

## Chunk 5: Dockerfile + Smoke Test

### Task 12: Create Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM oven/bun:1.3.10-slim

WORKDIR /app

# Copy package files
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/docs/package.json apps/docs/
COPY apps/mobile/package.json apps/mobile/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY apps/web/ apps/web/

# Build
RUN bun run build --filter=web

# Create data directory for SQLite
RUN mkdir -p /app/apps/web/data

EXPOSE 3000

ENV DATABASE_URL=/app/apps/web/data/sqlite.db
ENV BETTER_AUTH_URL=http://localhost:3000
ENV NODE_ENV=production

WORKDIR /app/apps/web
CMD ["bun", "run", "start"]
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.git
.turbo
.output
*.db
*.db-shm
*.db-wal
apps/web/data
.superpowers
.serena
.claude
.worktrees
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for single-image deployment"
```

---

### Task 13: Verify everything works end-to-end

- [ ] **Step 1: Run linting**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun run lint`
Expected: No lint errors

- [ ] **Step 2: Run unit tests**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun run test:run`
Expected: All tests pass (currency + budget-service)

- [ ] **Step 3: Start dev server and verify manually**

Run: `cd /Users/pauldiloreto/Projects/openbudget && bun run dev:web`
Expected: Server starts on port 3000. Navigate to `http://localhost:3000`:
- Should redirect to `/login`
- Register a new account
- Should redirect to `/` and show empty budget list
- Create a new budget via the dialog
- Budget should appear in the grid

- [ ] **Step 4: Run the database migration on first start**

If the dev server doesn't auto-migrate, run:
```bash
cd apps/web && bun x drizzle-kit push
```

- [ ] **Step 5: Fix any issues found during manual testing**

Address linting, runtime, or visual issues. Commit each fix separately.

- [ ] **Step 6: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
