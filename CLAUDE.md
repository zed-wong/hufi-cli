
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Versioning

Keep the version number in sync between `package.json` and `src/cli.ts`.

- Current version: `1.0.1`
- When code changes ship, update both files together.
- Rebuild with `bun run build` after bumping.
- Do not change the release numbering scheme in docs unless the package metadata is updated too.

## Documentation

After any major change (new commands, API changes, refactors), update `README.md` to reflect the current usage. Keep command examples, options, and install instructions in sync with the actual CLI behavior.

Keep the living runtime note in `docs/execution/INTENT_ARCHITECTURE_VALIDATION_AND_ENTITIES.md` aligned with command structure, entities, and validation flow changes.

## Project Structure

Important paths in this repo:

- `src/cli.ts` - Commander entrypoint and global option handling
- `src/commands/` - top-level command groups: `auth`, `campaign`, `exchange`, `staking`, `dashboard`
- `src/services/recording/` - Recording Oracle API clients
- `src/services/launcher/` - campaign launcher API client
- `src/services/staking.ts` - staking reads and write transactions
- `src/services/campaign-create.ts` - on-chain campaign preflight and creation flow
- `src/lib/` - shared helpers for config, auth guards, output, blockchain access, exports, and watch loops
- `src/types/` - shared runtime and API shape definitions
- `test-cli.sh` - CLI integration coverage
- `docs/execution/INTENT_ARCHITECTURE_VALIDATION_AND_ENTITIES.md` - living technical runtime doc

## Command Surface

The CLI currently exposes five top-level groups:

- `auth` - wallet generation, login, auth status
- `campaign` - list/get/join/joined/status/progress/leaderboard/create
- `exchange` - register/list/delete/revalidate exchange API keys
- `staking` - status/deposit/stake/unstake/withdraw
- `dashboard` - portfolio summary and export output

## Config and Runtime Notes

- Default config path: `~/.hufi-cli/config.json`
- Default key path: `~/.hufi-cli/key.json`
- Global overrides: `--config-file` and `--key-file`
- Config validation runs before command execution in `src/cli.ts`
- Default chain ID comes from config and falls back to `137`

## CLI Tests

When adding or modifying CLI commands, update `test-cli.sh` to include the new test case. Run `bun run test:cli` to verify all commands still pass. The test script should cover:
- All subcommands (auth, campaign, exchange, staking, dashboard)
- Normal output mode and `--json` mode
- Error handling (invalid inputs, missing auth)
- Help output (`--help`)

Always run `./test-cli.sh` after any command changes before committing.

## Campaign Output

- `campaign list` and `campaign get` should print full timestamps as `YYYY-MM-DD HH:mm:ss` in text output.
- Human-readable token amounts in campaign text output should round noisy on-chain decimals to a concise display instead of exposing raw 6-decimal stablecoin dust.
