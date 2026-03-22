# Comprehensive CLI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve reliability, test depth, documentation quality, scalability, and developer ergonomics for `hufi-cli` in one coordinated effort.

**Architecture:** Introduce a small reliability layer in shared libraries (`http`, `config`, and blockchain transaction helpers), then extend command/services to consume it. Add deterministic tests with local mock servers and performance fixtures, then document troubleshooting and end-to-end usage aligned with real CLI behavior.

**Tech Stack:** Bun, TypeScript, Commander, Ethers, Bun test runner, shell CLI tests (`test-cli.sh`)

---

### Task 1: HTTP Retry + Backoff Foundation

**Files:**
- Modify: `src/lib/http.ts`
- Test: `tests/lib/http.test.ts`

**Step 1: Write the failing test**

```ts
test("retries transient network failures with exponential backoff", async () => {
  const { requestJson } = await import("../../src/lib/http.ts");
  let attempts = 0;

  const server = Bun.serve({
    port: 0,
    fetch() {
      attempts += 1;
      if (attempts < 3) {
        return new Response(JSON.stringify({ message: "temporary" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  try {
    const result = await requestJson(`http://localhost:${server.port}/retry-test`);
    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(3);
  } finally {
    server.stop();
  }
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/lib/http.test.ts -t "retries transient network failures with exponential backoff"`
Expected: FAIL because `requestJson` currently throws on first 503.

**Step 3: Write minimal implementation**

```ts
interface RetryOptions {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  retry?: RetryOptions;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export async function requestJson(url: string, options: RequestOptions = {}): Promise<unknown> {
  const retries = options.retry?.retries ?? 2;
  const initialDelayMs = options.retry?.initialDelayMs ?? 250;
  const maxDelayMs = options.retry?.maxDelayMs ?? 3000;

  let attempt = 0;
  while (true) {
    try {
      // current fetch + parsing logic, then:
      // if !response.ok and retryable and attempt < retries => throw retry signal
      return payload;
    } catch (err) {
      if (attempt >= retries) throw err;
      const delay = Math.min(initialDelayMs * (2 ** attempt), maxDelayMs);
      attempt += 1;
      await sleep(delay);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/lib/http.test.ts -t "retries transient network failures with exponential backoff"`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/lib/http.test.ts src/lib/http.ts
git commit -m "feat: add retryable HTTP requests with exponential backoff"
```

---

### Task 2: Retry Guardrails and Non-Retry Cases

**Files:**
- Modify: `tests/lib/http.test.ts`
- Modify: `src/lib/http.ts`

**Step 1: Write failing tests**

```ts
test("does not retry on 400 errors", async () => { /* assert attempt count is 1 */ });
test("does not retry on auth errors", async () => { /* 401/403 should fail fast */ });
test("respects explicit retry override", async () => { /* retry: { retries: 0 } */ });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/lib/http.test.ts -t "does not retry"`
Expected: FAIL due to missing status-based retry filtering.

**Step 3: Write minimal implementation**

```ts
if (!response.ok) {
  const apiError = new ApiError(message, response.status, payload);
  if (isRetryableStatus(response.status) && attempt < retries) {
    throw new RetryableRequestError(apiError);
  }
  throw apiError;
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/lib/http.test.ts`
Expected: PASS for existing and new HTTP tests.

**Step 5: Commit**

```bash
git add tests/lib/http.test.ts src/lib/http.ts
git commit -m "test: enforce retry boundaries for HTTP error handling"
```

---

### Task 3: Startup Configuration Validation

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `src/cli.ts`
- Test: `tests/lib/config.test.ts`
- Test: `tests/commands/cli.test.ts`

**Step 1: Write failing tests**

```ts
test("validateConfig returns issue for invalid recordingApiUrl", async () => {
  const { validateConfig } = await import("../../src/lib/config.ts");
  const result = validateConfig({ recordingApiUrl: "not-a-url" } as any);
  expect(result.valid).toBe(false);
});
```

```ts
test("cli exits with validation error for invalid config", async () => {
  // run CLI with invalid --config-file fixture and assert non-zero exit + help text
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/lib/config.test.ts tests/commands/cli.test.ts`
Expected: FAIL because validation API does not exist.

**Step 3: Write minimal implementation**

```ts
export interface ConfigValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateConfig(config: Partial<Config>): ConfigValidationResult {
  const issues: string[] = [];
  // validate URLs, chainId range, address format when present
  return { valid: issues.length === 0, issues };
}
```

Call validation in CLI boot (`src/cli.ts`) before command execution and print actionable remediation.

**Step 4: Run tests to verify they pass**

Run: `bun test tests/lib/config.test.ts tests/commands/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/config.ts src/cli.ts tests/lib/config.test.ts tests/commands/cli.test.ts
git commit -m "feat: validate configuration on startup with clear errors"
```

---

### Task 4: Blockchain Utility Extraction (Gas + Confirmation Polling)

**Files:**
- Create: `src/lib/blockchain.ts`
- Modify: `src/services/campaign-create.ts`
- Test: `tests/lib/blockchain.test.ts`

**Step 1: Write failing tests**

```ts
test("waitForConfirmations resolves once tx is confirmed", async () => {
  const { waitForConfirmations } = await import("../../src/lib/blockchain.ts");
  const provider = { getTransactionReceipt: async () => ({ confirmations: 1, hash: "0xabc" }) } as any;
  const receipt = await waitForConfirmations(provider, "0xabc", { minConfirmations: 1, pollMs: 10, timeoutMs: 100 });
  expect(receipt.hash).toBe("0xabc");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/lib/blockchain.test.ts`
Expected: FAIL because module/functions do not exist.

**Step 3: Write minimal implementation**

```ts
export interface WaitTxOptions {
  minConfirmations?: number;
  pollMs?: number;
  timeoutMs?: number;
}

export async function waitForConfirmations(provider: any, txHash: string, opts: WaitTxOptions = {}) {
  // poll getTransactionReceipt until confirmations >= minConfirmations or timeout
}

export function estimateGasWithBuffer(estimated: bigint, bps = 1200): bigint {
  return (estimated * BigInt(10000 + bps)) / BigInt(10000);
}
```

Refactor `src/services/campaign-create.ts` to use these helpers for approve and create transaction paths.

**Step 4: Run test to verify it passes**

Run: `bun test tests/lib/blockchain.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/blockchain.ts src/services/campaign-create.ts tests/lib/blockchain.test.ts
git commit -m "refactor: extract shared blockchain tx helpers"
```

---

### Task 5: Campaign Creation Monitoring UX

**Files:**
- Modify: `src/types/campaign-create.ts`
- Modify: `src/services/campaign-create.ts`
- Modify: `src/commands/campaign.ts`
- Test: `tests/commands/cli.test.ts`

**Step 1: Write failing test**

```ts
test("campaign create reports pending and confirmed status", async () => {
  // mock createCampaign service response lifecycle and assert human output lines
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/cli.test.ts -t "campaign create reports pending and confirmed status"`
Expected: FAIL because CLI currently prints only final hash/address.

**Step 3: Write minimal implementation**

```ts
export interface CampaignCreateResult {
  escrowAddress: string;
  txHash: string;
  confirmations?: number;
  status?: "submitted" | "confirmed";
}
```

Enhance command output in `campaign create` action:
- print submitted transaction hash immediately
- poll and print confirmation progress
- print final escrow address on success

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/cli.test.ts -t "campaign create reports pending and confirmed status"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/campaign-create.ts src/services/campaign-create.ts src/commands/campaign.ts tests/commands/cli.test.ts
git commit -m "feat: add campaign transaction confirmation monitoring"
```

---

### Task 6: Launcher Pagination Support

**Files:**
- Modify: `src/services/launcher/campaign.ts`
- Modify: `src/commands/campaign.ts`
- Modify: `src/types/launcher.ts`
- Test: `tests/commands/cli.test.ts`

**Step 1: Write failing tests**

```ts
test("campaign list forwards page and page-size params", async () => { /* assert query string */ });
test("campaign list prints pagination hint when next page exists", async () => { /* assert UX text */ });
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/commands/cli.test.ts -t "campaign list"`
Expected: FAIL because options/behavior are not implemented.

**Step 3: Write minimal implementation**

```ts
// command options
.option("--page <n>", "Page number", Number, 1)
.option("--page-size <n>", "Items per page", Number, 20)

// service URL
const url = `${baseUrl}/campaigns?chain_id=${chainId}&status=${status}&limit=${pageSize}&page=${page}`;
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/commands/cli.test.ts -t "campaign list"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/launcher/campaign.ts src/commands/campaign.ts src/types/launcher.ts tests/commands/cli.test.ts
git commit -m "feat: add pagination controls to campaign list"
```

---

### Task 7: Dashboard Export Command (CSV/JSON)

**Files:**
- Modify: `src/commands/dashboard.ts`
- Create: `src/lib/export.ts`
- Test: `tests/commands/cli.test.ts`

**Step 1: Write failing test**

```ts
test("dashboard export outputs csv when requested", async () => {
  // run dashboard with --export csv and assert header row
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/cli.test.ts -t "dashboard export outputs csv when requested"`
Expected: FAIL because export mode is absent.

**Step 3: Write minimal implementation**

```ts
.option("--export <format>", "Export format: csv|json")

if (opts.export === "csv") {
  printText(toCsvRows(summary));
  return;
}
```

Implement CSV serializer utility in `src/lib/export.ts`.

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/cli.test.ts -t "dashboard export outputs csv when requested"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/dashboard.ts src/lib/export.ts tests/commands/cli.test.ts
git commit -m "feat: add dashboard export output in csv/json formats"
```

---

### Task 8: Optional Watch Mode for Progress Monitoring

**Files:**
- Modify: `src/commands/campaign.ts`
- Modify: `src/commands/dashboard.ts`
- Create: `src/lib/watch.ts`
- Test: `tests/commands/cli.test.ts`

**Step 1: Write failing test**

```ts
test("campaign progress --watch polls repeatedly", async () => {
  // assert multiple calls and graceful stop condition
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/cli.test.ts -t "--watch"`
Expected: FAIL because watch option is missing.

**Step 3: Write minimal implementation**

```ts
.option("--watch", "Poll continuously")
.option("--interval <ms>", "Polling interval in ms", Number, 10000)
```

Add reusable polling helper in `src/lib/watch.ts` with cancel on `SIGINT`.

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/cli.test.ts -t "--watch"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/campaign.ts src/commands/dashboard.ts src/lib/watch.ts tests/commands/cli.test.ts
git commit -m "feat: add watch mode for real-time progress updates"
```

---

### Task 9: Integration Tests with Mock Services

**Files:**
- Modify: `test-cli.sh`
- Modify: `tests/commands/cli.test.ts`
- Create: `tests/fixtures/mock-server.ts`

**Step 1: Write failing tests**

```ts
test("campaign list uses mock launcher service in integration mode", async () => {
  // boot mock server and assert deterministic output
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/cli.test.ts -t "mock launcher service"`
Expected: FAIL because no fixture mock server exists.

**Step 3: Write minimal implementation**

```ts
// tests/fixtures/mock-server.ts
export function startMockApis() {
  // Bun.serve route map for recording + launcher responses
}
```

Update `test-cli.sh` to prefer mock endpoints during test execution.

**Step 4: Run tests to verify they pass**

Run: `bun test tests/commands/cli.test.ts`
Expected: PASS with deterministic responses.

**Step 5: Commit**

```bash
git add tests/fixtures/mock-server.ts tests/commands/cli.test.ts test-cli.sh
git commit -m "test: run integration-style cli tests against mock services"
```

---

### Task 10: Performance Test for Large Campaign Lists

**Files:**
- Create: `tests/perf/campaign-list.perf.test.ts`
- Modify: `package.json`

**Step 1: Write the failing performance test**

```ts
test("renders 1000 campaigns within acceptable latency", async () => {
  const started = performance.now();
  // invoke list formatting logic with 1000 fixture campaigns
  const elapsed = performance.now() - started;
  expect(elapsed).toBeLessThan(500);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/perf/campaign-list.perf.test.ts`
Expected: FAIL until fixture + performance constraints are tuned.

**Step 3: Write minimal implementation**

```ts
// add reusable formatter extraction if needed for testability
// add `test:perf` script in package.json
```

**Step 4: Run test to verify it passes**

Run: `bun run test:perf`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/perf/campaign-list.perf.test.ts package.json src/commands/campaign.ts
git commit -m "test: add performance coverage for large campaign listings"
```

---

### Task 11: Troubleshooting + Internal API Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/TROUBLESHOOTING.md`
- Create: `docs/API_INTERNAL_SERVICES.md`

**Step 1: Write failing docs checks**

```bash
rg "Troubleshooting" README.md
rg "campaign create flow" README.md
rg "Recording Oracle" docs/API_INTERNAL_SERVICES.md
```

**Step 2: Run checks to verify they fail**

Run: `rg "Troubleshooting|campaign create flow" README.md`
Expected: missing/insufficient sections.

**Step 3: Write minimal implementation**

Add to `README.md`:
- full multi-step campaign creation flow (auth, staking prereq, create, monitor)
- links to troubleshooting and API docs

Add `docs/TROUBLESHOOTING.md`:
- auth failures
- network timeouts and retry behavior
- RPC and gas-related issues
- invalid config remediation

Add `docs/API_INTERNAL_SERVICES.md`:
- Recording Oracle endpoint map used by CLI
- Launcher endpoint map used by CLI
- request/response examples and expected status codes

**Step 4: Run checks to verify they pass**

Run: `rg "Troubleshooting|campaign create flow" README.md && rg "Recording Oracle|Campaign Launcher" docs/API_INTERNAL_SERVICES.md`
Expected: matches found.

**Step 5: Commit**

```bash
git add README.md docs/TROUBLESHOOTING.md docs/API_INTERNAL_SERVICES.md
git commit -m "docs: add troubleshooting and internal API reference"
```

---

### Task 12: JSDoc for Public APIs + Final Validation Sweep

**Files:**
- Modify: `src/services/recording/campaign.ts`
- Modify: `src/services/recording/exchange.ts`
- Modify: `src/services/launcher/campaign.ts`
- Modify: `src/services/staking.ts`
- Modify: `src/commands/campaign.ts`
- Modify: `src/commands/dashboard.ts`
- Modify: `src/cli.ts`
- Modify: `package.json`

**Step 1: Write failing checks**

```bash
rg "export async function" src/services | rg -v "\*"
```

**Step 2: Run checks to verify they fail**

Run: `rg "export (async )?function" src/services src/commands`
Expected: many public functions without JSDoc blocks.

**Step 3: Write minimal implementation**

Add short JSDoc blocks for public APIs:

```ts
/**
 * Lists launcher campaigns for a chain and status.
 * Retries transient failures through requestJson.
 */
export async function listLauncherCampaigns(...) { ... }
```

Then run the full validation suite:
- `bun run build`
- `bun test`
- `bun run test:cli`

If command behavior changed, update CLI test coverage in `test-cli.sh` for:
- auth, campaign, exchange, completion/help, dashboard
- normal and `--json` modes
- error handling paths

**Step 4: Run validation to verify everything passes**

Run: `bun run build && bun test && bun run test:cli`
Expected: all green.

**Step 5: Commit**

```bash
git add src/services src/commands src/cli.ts package.json test-cli.sh
git commit -m "chore: add API docs comments and validate full CLI quality suite"
```

---

### Task 13: Versioning + Release Notes Alignment

**Files:**
- Modify: `package.json`
- Modify: `src/cli.ts`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Write failing check**

```bash
node -e "const p=require('./package.json');console.log(p.version)"
rg "version\(" src/cli.ts
```

**Step 2: Run check to verify mismatch or stale version docs**

Run: `bun run build` (after version changes in branch)
Expected: ensure binary reflects updated version.

**Step 3: Write minimal implementation**

Apply required version bump policy for this release scope:
- `package.json` → `0.<minor>.0` for major feature expansion
- `src/cli.ts` version string to same value

Update `README.md` and `CLAUDE.md` if behavior, flags, or workflows changed.

**Step 4: Run validation to verify release readiness**

Run: `bun run build && bun test && ./test-cli.sh`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json src/cli.ts README.md CLAUDE.md
git commit -m "release: bump cli version and sync docs with new capabilities"
```

---

## End-to-End Verification Checklist

Run in order:

1. `bun run build`
2. `bun test`
3. `bun run test:cli`
4. `./test-cli.sh`
5. `bun run test:perf`

Expected: all pass, deterministic CLI output for mocked integrations, and documented recovery paths for common user-facing failures.
