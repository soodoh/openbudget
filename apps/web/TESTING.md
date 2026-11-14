# Testing

Install workspace dependencies from the repository root with `bun install`.
Then install the browser used by component tests:

```sh
cd apps/web
bun x playwright install chromium
```

In Linux CI, use `bun x playwright install --with-deps chromium` to install
Chromium's system dependencies too.

## Run tests

From the repository root:

```sh
bun run test:run # All unit and browser component tests
bun run test     # Watch mode
```

From `apps/web`, select a Vitest project:

```sh
bun run test:run --project unit
bun run test:run --project browser
bun run test --project browser --browser.headless=false
```

## Test suites

- **Unit/service tests:** `src/**/*.test.{ts,tsx}`, excluding
  `src/__tests__/components/`. These run outside the browser using the existing
  Bun-powered Vitest command; database tests use disposable in-memory SQLite.
- **Component tests:** `src/__tests__/components/**/*.test.{ts,tsx}`. These use
  Vitest Browser Mode with Playwright and headless Chromium, `vitest-browser-react`
  for rendering and automatic cleanup, and `vitest/browser` locators for real
  browser interactions. The browser setup loads the application's styles.
  Await interactions and `expect.element(...)` assertions; use
  `toMatchTextContent` for substring matching (`toHaveTextContent` matches exactly).
- **Production smoke check:** `bun run test:smoke` builds the application and
  checks SSR and APIs against a disposable database. It is separate from Vitest.
- **Playwright E2E:** `playwright.config.ts` and `test:e2e` scripts are reserved
  for full-application tests in `e2e/`; no E2E tests currently exist. Vitest's
  component tests do not use this config or start the application server.

Vitest failure screenshots and other generated artifacts are written under
`.vitest/` and are ignored by Git.
