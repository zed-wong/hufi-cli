import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockApis } from "../fixtures/mock-server.ts";

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

describe("CLI help", () => {
  test("--help shows usage", async () => {
    const { code, stdout } = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("CLI tool for hu.fi DeFi platform");
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

  test("auth --help shows auth commands", async () => {
    const { code, stdout } = await runCli(["auth", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("login");
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
  const tmpKey = `/tmp/hufi-test-key-${Date.now()}.json`;

  test("auth generate creates wallet with isolated key file", async () => {
    const { code, stdout } = await runCli(["--key-file", tmpKey, "auth", "generate"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Address: 0x");
    expect(stdout).toContain("Private key saved to");
  });

  test("auth generate --json outputs valid JSON", async () => {
    const tmpKey2 = `/tmp/hufi-test-key-${Date.now()}-2.json`;
    const { code, stdout } = await runCli(["--key-file", tmpKey2, "auth", "generate", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(parsed.keyPath).toContain("hufi-test-key");
  });

  test("auth status --json shows state", async () => {
    const { code, stdout } = await runCli(["auth", "status", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.apiUrl).toBe("https://ro.hu.finance");
    expect(typeof parsed.authenticated).toBe("boolean");
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
    } finally {
      mock.stop();
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
});
