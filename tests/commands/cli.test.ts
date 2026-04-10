import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockApis } from "../fixtures/mock-server.ts";
import { startMockRpcServer } from "../fixtures/mock-rpc-server.ts";

async function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "src/cli.ts", ...args], {
    cwd: import.meta.dir + "/../..",
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  return { code: proc.exitCode ?? 1, stdout, stderr };
}

function uniquePath(prefix: string, suffix = ".json"): string {
  return join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`);
}

describe("CLI help", () => {
  test("--help shows usage", async () => {
    const { code, stdout } = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("CLI tool for Hu.fi platform");
    expect(stdout).toContain("auth");
    expect(stdout).toContain("exchange");
    expect(stdout).toContain("campaign");
    expect(stdout).toContain("staking");
    expect(stdout).toContain("dashboard");
  });

  test("--version shows version", async () => {
    const { code, stdout } = await runCli(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("-p without value prints profiles and local keys", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-profile-short-list-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: "https://ro.hu.finance",
        profiles: {
          alpha: {},
          beta: {},
        },
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "-p"]);
      expect(code).toBe(0);
      expect(stdout).toContain("Profiles");
      expect(stdout).toContain("Local keys");
      expect(stdout).toContain("alpha");
      expect(stdout).toContain("beta");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("auth --help shows auth commands", async () => {
    const { code, stdout } = await runCli(["auth", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("login");
    expect(stdout).toContain("list");
    expect(stdout).toContain("generate");
    expect(stdout).toContain("status");
  });

  test("campaign --help shows campaign commands", async () => {
    const { code, stdout } = await runCli(["campaign", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("get");
    expect(stdout).toContain("joined");
    expect(stdout).toContain("status");
    expect(stdout).toContain("join");
  });

  test("exchange --help shows exchange commands", async () => {
    const { code, stdout } = await runCli(["exchange", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("register");
    expect(stdout).toContain("list");
    expect(stdout).toContain("delete");
    expect(stdout).toContain("revalidate");
  });

  test("staking --help shows staking commands", async () => {
    const { code, stdout } = await runCli(["staking", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("status");
    expect(stdout).toContain("stake");
    expect(stdout).toContain("unstake");
    expect(stdout).toContain("withdraw");
    expect(stdout).toContain("deposit");
  });

  test("dashboard --help shows dashboard option", async () => {
    const { code, stdout } = await runCli(["dashboard", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Portfolio");
  });

  test("dashboard --help shows export option", async () => {
    const { code, stdout } = await runCli(["dashboard", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("--export <format>");
  });

  test("campaign progress --help shows watch options", async () => {
    const { code, stdout } = await runCli(["campaign", "progress", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("--watch");
    expect(stdout).toContain("--interval <ms>");
  });
});

describe("auth commands", () => {
  test("auth generate creates wallet with isolated key file", async () => {
    const tmpKey = uniquePath("hufi-test-key");
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-key-"));
    const configFile = join(dir, "config.json");
    writeFileSync(configFile, JSON.stringify({
      recordingApiUrl: "https://ro.hu.finance",
      launcherApiUrl: "https://cl.hu.finance",
      defaultChainId: 137,
      profiles: {
        default: {
          keyFile: tmpKey,
        },
      },
    }));
    const { code, stdout } = await runCli(["--config-file", configFile, "--key-file", tmpKey, "auth", "generate"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Address: 0x");
    expect(stdout).toContain("Private key saved to");
  });

  test("auth generate --json outputs valid JSON", async () => {
    const tmpKey2 = uniquePath("hufi-test-key");
    const { code, stdout } = await runCli(["--key-file", tmpKey2, "auth", "generate", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(parsed.keyPath.endsWith(".json")).toBe(true);
  });

  test("auth status --json shows state", async () => {
    const { code, stdout } = await runCli(["auth", "status", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.apiUrl).toBe("https://ro.hu.finance");
    expect(typeof parsed.authenticated).toBe("boolean");
    expect(typeof parsed.profile).toBe("string");
  });

  test("profile flag scopes auth state independently", async () => {
    const mock = startMockApis();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-profiles-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
      })
    );

    try {
      const loginA = await runCli([
        "--config-file", configFile,
        "--profile", "alpha",
        "auth", "login",
        "--private-key", "0x59c6995e998f97a5a0044966f0945382f9b37fd0f9f4b5c9d6c1a1f3c7a2d8f1",
      ]);
      expect(loginA.code).toBe(0);
      expect(loginA.stdout).toContain("Authenticated profile 'alpha'");

      const loginB = await runCli([
        "--config-file", configFile,
        "--profile", "beta",
        "auth", "login",
        "--private-key", "0x8b3a350cf5c34c9194ca3a545d1f6d4d927f3e49fcb23e2dc6e2d7f5d3c4f123",
      ]);
      expect(loginB.code).toBe(0);
      expect(loginB.stdout).toContain("Authenticated profile 'beta'");

      const statusA = await runCli(["--config-file", configFile, "--profile", "alpha", "auth", "status", "--json"]);
      const statusB = await runCli(["--config-file", configFile, "--profile", "beta", "auth", "status", "--json"]);
      expect(JSON.parse(statusA.stdout).profile).toBe("alpha");
      expect(JSON.parse(statusA.stdout).authenticated).toBe(true);
      expect(JSON.parse(statusB.stdout).profile).toBe("beta");
      expect(JSON.parse(statusB.stdout).authenticated).toBe(true);
    } finally {
      mock.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("profile short flag scopes auth state independently", async () => {
    const mock = startMockApis();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-profiles-short-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
      })
    );

    try {
      const login = await runCli([
        "--config-file", configFile,
        "-p", "gamma",
        "auth", "login",
        "--private-key", "0x59c6995e998f97a5a0044966f0945382f9b37fd0f9f4b5c9d6c1a1f3c7a2d8f1",
      ]);
      expect(login.code).toBe(0);
      expect(login.stdout).toContain("Authenticated profile 'gamma'");

      const status = await runCli(["--config-file", configFile, "-p", "gamma", "auth", "status", "--json"]);
      expect(status.code).toBe(0);
      expect(JSON.parse(status.stdout).profile).toBe("gamma");
      expect(JSON.parse(status.stdout).authenticated).toBe(true);
    } finally {
      mock.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("auth login with --private-key persists a profile key under config dir", async () => {
    const mock = startMockApis();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-profile-persist-"));
    const configFile = join(dir, "config.json");

    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
      })
    );

    try {
      const login = await runCli([
        "--config-file", configFile,
        "--profile", "alpha",
        "auth", "login",
        "--private-key", "0x59c6995e998f97a5a0044966f0945382f9b37fd0f9f4b5c9d6c1a1f3c7a2d8f1",
      ]);
      expect(login.code).toBe(0);
      expect(login.stdout).toContain("Authenticated profile 'alpha'");

      const savedConfig = JSON.parse(readFileSync(configFile, "utf-8"));
      expect(savedConfig.profiles.alpha.keyFile).toBe("/home/whoami/.hufi-cli/key.alpha.json");

      const status = await runCli([
        "--config-file", configFile,
        "--profile", "alpha",
        "auth", "status",
        "--json",
      ]);
      expect(status.code).toBe(0);
      expect(JSON.parse(status.stdout).authenticated).toBe(true);
    } finally {
      mock.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("auth list shows profiles and active marker", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-auth-list-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: "https://ro.hu.finance",
        launcherApiUrl: "https://cl.hu.finance",
        activeProfile: "beta",
        profiles: {
          alpha: {
            address: "0x0000000000000000000000000000000000000001",
            keyFile: "/home/whoami/.hufi-cli/key.alpha.json",
          },
          beta: {
            address: "0x0000000000000000000000000000000000000002",
            accessToken: "token",
            keyFile: "/home/whoami/.hufi-cli/key.beta.json",
          },
        },
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "auth", "list"]);
      expect(code).toBe(0);
      expect(stdout).toContain("Profiles");
      expect(stdout).toContain("  alpha  not authenticated");
      expect(stdout).toContain("* beta  authenticated");
      expect(stdout).toContain("Local keys");

      const json = await runCli(["--config-file", configFile, "auth", "list", "--json"]);
      expect(json.code).toBe(0);
      const parsed = JSON.parse(json.stdout);
      expect(parsed.profiles.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(parsed.localKeys)).toBe(true);
      const beta = parsed.profiles.find((entry: { name: string }) => entry.name === "beta");
      expect(beta.active).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("cli exits with validation error for invalid config", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-invalid-config-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: "not-a-url",
      })
    );

    try {
      const { code, stderr } = await runCli(["--config-file", configFile, "auth", "status"]);
      expect(code).toBe(1);
      expect(stderr).toContain("Invalid configuration:");
      expect(stderr).toContain("recordingApiUrl must be a valid http/https URL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("campaign list uses mock launcher service in integration mode", async () => {
    const mock = startMockApis();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-mock-services-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "campaign", "list", "--limit", "1"]);
      expect(code).toBe(0);
      expect(stdout).toContain("MOCK/USDT");
      expect(stdout).toContain("more campaigns available");
      expect(stdout).toContain("duration:   2026-01-01 00:00:00 ~ 2026-01-02 00:00:00");
      expect(stdout).toContain("funded:     1 USDT  paid: 0.1  balance: 0.9 (90.0%)");
    } finally {
      mock.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("campaign leaderboard text output shows full entry fields", async () => {
    const mock = startMockApis();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-leaderboard-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
      })
    );

    try {
      const { code, stdout } = await runCli([
        "--config-file",
        configFile,
        "campaign",
        "leaderboard",
        "--chain-id",
        "137",
        "--address",
        "0x1111111111111111111111111111111111111111",
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain("Leaderboard (rewards):");
      expect(stdout).toContain("total: 150");
      expect(stdout).toContain("updated: 2026-03-22 10:11:12");
      expect(stdout).toContain("score:");
      expect(stdout).toContain("result:");
      expect(stdout).toContain("reward:");
      expect(stdout).not.toContain("total: -");
      expect(stdout).not.toContain("updated: -");
    } finally {
      mock.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("campaign list trims noisy stable-token decimals in text output", async () => {
    const launcher = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (req.method === "GET" && url.pathname === "/campaigns") {
          return new Response(JSON.stringify({
            has_more: false,
            results: [
              {
                chain_id: 137,
                address: "0xb36e0d9ce101afc891e17ff1cd400997dfed28e7",
                type: "THRESHOLD",
                exchange_name: "mexc",
                symbol: "XIN",
                status: "active",
                fund_amount: "100000000",
                fund_token: "USDT0",
                fund_token_symbol: "USDT0",
                fund_token_decimals: 6,
                balance: "20000018",
                amount_paid: "79999982",
                start_date: "2026-03-18T00:00:00.000Z",
                end_date: "2026-03-23T23:59:59.000Z",
                launcher: "mock-launcher",
                exchange_oracle: "0x2222222222222222222222222222222222222222",
                recording_oracle: "0x3333333333333333333333333333333333333333",
                reputation_oracle: "0x4444444444444444444444444444444444444444",
              },
            ],
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-decimal-format-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: "https://ro.hu.finance",
        launcherApiUrl: `http://localhost:${launcher.port}`,
        defaultChainId: 137,
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "campaign", "list", "--limit", "1"]);
      expect(code).toBe(0);
      expect(stdout).toContain("duration:   2026-03-18 00:00:00 ~ 2026-03-23 23:59:59");
      expect(stdout).toContain("funded:     100 USDT0  paid: 80  balance: 20 (20.0%)");
    } finally {
      launcher.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("campaign joined mirrors campaign list output when metadata is available", async () => {
    const recording = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (req.method === "GET" && url.pathname === "/campaigns") {
          return new Response(JSON.stringify({
            results: [
              {
                chain_id: 137,
                address: "0x1111111111111111111111111111111111111111",
                exchange_name: "mexc",
                symbol: "MOCK/USDT",
                type: "MARKET_MAKING",
                status: "active",
                fund_amount: "1000000",
                fund_token_symbol: "USDT",
                fund_token_decimals: 6,
                amount_paid: "100000",
                balance: "900000",
                start_date: "2026-01-01T00:00:00.000Z",
                end_date: "2026-01-02T00:00:00.000Z",
                launcher: "mock-launcher",
              },
            ],
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-joined-output-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: `http://localhost:${recording.port}`,
        launcherApiUrl: "https://launcher.hu.finance",
        defaultChainId: 137,
        address: "0x0000000000000000000000000000000000000001",
        accessToken: "mock-access-token",
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "campaign", "joined"]);
      expect(code).toBe(0);
      expect(stdout).toContain("Profile: default");
      expect(stdout).toContain("Joined campaigns (1):");
      expect(stdout).toContain("Address: 0x0000000000000000000000000000000000000001");
      expect(stdout).toContain("mexc MOCK/USDT (MARKET_MAKING)");
      expect(stdout).toContain("address:    0x1111111111111111111111111111111111111111");
      expect(stdout).toContain("status:     active");
      expect(stdout).toContain("duration:   2026-01-01 00:00:00 ~ 2026-01-02 00:00:00");
      expect(stdout).toContain("funded:     1 USDT  paid: 0.1  balance: 0.9 (90.0%)");
      expect(stdout).toContain("launcher:   mock-launcher");
      expect(stdout).not.toContain("undefined");
    } finally {
      recording.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("campaign joined hides launcher when the endpoint does not return it", async () => {
    const recording = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (req.method === "GET" && url.pathname === "/campaigns") {
          return new Response(JSON.stringify({
            results: [
              {
                chain_id: 137,
                address: "0x1111111111111111111111111111111111111111",
                exchange_name: "mexc",
                symbol: "MOCK/USDT",
                type: "MARKET_MAKING",
                status: "active",
                fund_amount: "1000000",
                fund_token_symbol: "USDT",
                fund_token_decimals: 6,
                amount_paid: "100000",
                balance: "900000",
                start_date: "2026-01-01T00:00:00.000Z",
                end_date: "2026-01-02T00:00:00.000Z",
              },
            ],
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-joined-no-launcher-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: `http://localhost:${recording.port}`,
        launcherApiUrl: "https://launcher.hu.finance",
        defaultChainId: 137,
        address: "0x0000000000000000000000000000000000000001",
        accessToken: "mock-access-token",
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "campaign", "joined"]);
      expect(code).toBe(0);
      expect(stdout).toContain("Profile: default");
      expect(stdout).toContain("Address: 0x0000000000000000000000000000000000000001");
      expect(stdout).toContain("mexc MOCK/USDT (MARKET_MAKING)");
      expect(stdout).not.toContain("launcher:");
      expect(stdout).not.toContain("launcher:   -");
    } finally {
      recording.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("campaign progress renders grouped text card with aligned sections", async () => {
    const recording = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (req.method === "GET" && url.pathname.includes("/my-progress")) {
          return new Response(JSON.stringify({
            from: "2026-03-22T13:50:09.001Z",
            to: "2026-03-23T01:10:00.015Z",
            my_score: 1,
            my_meta: { token_balance: 9.14 },
            total_meta: { total_balance: 17.65410148, total_score: 6 },
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-progress-format-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: `http://localhost:${recording.port}`,
        launcherApiUrl: "https://launch.hu.finance",
        defaultChainId: 137,
        address: "0x0000000000000000000000000000000000000001",
        accessToken: "mock-access-token",
      })
    );

    try {
      const { code, stdout } = await runCli([
        "--config-file",
        configFile,
        "campaign",
        "progress",
        "--address",
        "0xb36e0d9ce101afc891e17ff1cd400997dfed28e7",
      ]);
      expect(code).toBe(0);
      expect(stdout).toContain("Profile: default");
      expect(stdout).toContain("Address: 0x0000000000000000000000000000000000000001");
      expect(stdout).toContain("Campaign Progress");
      expect(stdout).toContain("[Window]");
      expect(stdout).toContain("From            2026-03-22 13:50:09 UTC");
      expect(stdout).toContain("To              2026-03-23 01:10:00 UTC");
      expect(stdout).toContain("[Mine]");
      expect(stdout).toContain("Score           1");
      expect(stdout).toContain("Token balance   9.14");
      expect(stdout).toContain("Score share     16.67%");
      expect(stdout).toContain("[Totals]");
      expect(stdout).toContain("Total score     6");
      expect(stdout).toContain("Total balance   17.6541");
      expect(stdout).not.toContain("[object Object]");
    } finally {
      recording.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("dashboard export csv prints header in integration mode", async () => {
    const mock = startMockApis();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-mock-services-export-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
        address: "0x0000000000000000000000000000000000000001",
        accessToken: "mock-access-token",
      })
    );

    try {
      const { code, stdout } = await runCli(["--config-file", configFile, "dashboard", "--export", "csv"]);
      expect(code).toBe(0);
      expect(stdout).toContain("exchange,symbol,type,campaign_address,my_score");
    } finally {
      mock.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("staking status and dashboard remain deterministic with RPC override", async () => {
    const mock = startMockApis();
    const rpc = startMockRpcServer();
    const dir = mkdtempSync(join(tmpdir(), "hufi-cli-staking-rpc-"));
    const configFile = join(dir, "config.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        recordingApiUrl: mock.recordingUrl,
        launcherApiUrl: mock.launcherUrl,
        defaultChainId: 137,
        address: "0x0000000000000000000000000000000000000001",
        accessToken: "mock-access-token",
      })
    );

    const runCliWithRpc = async (args: string[]) => {
      const proc = Bun.spawn(["bun", "src/cli.ts", ...args], {
        cwd: import.meta.dir + "/../..",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          HUFI_RPC_137: rpc.url,
        },
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;
      return { code: proc.exitCode ?? 1, stdout, stderr };
    };

    try {
      const staking = await runCliWithRpc([
        "--config-file",
        configFile,
        "staking",
        "status",
        "--chain-id",
        "137",
        "--address",
        "0x0000000000000000000000000000000000000001",
      ]);
      expect(staking.code).toBe(0);
      expect(staking.stdout).toContain("Profile: default");
      expect(staking.stdout).toContain("Address: 0x0000000000000000000000000000000000000001");
      expect(staking.stdout).toContain("Staking status (chain 137):");
      expect(staking.stdout).toContain("Lock period:     1000 blocks");

      const dashboard = await runCliWithRpc([
        "--config-file",
        configFile,
        "dashboard",
        "--json",
      ]);
      expect(dashboard.code).toBe(0);
      const parsed = JSON.parse(dashboard.stdout);
      expect(parsed.staking).not.toBeNull();
      expect(parsed.staking.lockPeriod).toBe(1000);
    } finally {
      mock.stop();
      rpc.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
