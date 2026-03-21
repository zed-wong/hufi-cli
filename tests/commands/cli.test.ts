import { test, expect, describe } from "bun:test";

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
  });

  test("--help shows completion command", async () => {
    const { code, stdout } = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("completion");
  });
});

describe("completion scripts", () => {
  test("completion outputs bash script by default", async () => {
    const { code, stdout } = await runCli(["completion"]);
    expect(code).toBe(0);
    expect(stdout).toContain("_hufi_completions");
    expect(stdout).toContain("complete -F _hufi_completions hufi");
    expect(stdout).toContain("COMPREPLY");
  });

  test("completion --zsh outputs zsh script", async () => {
    const { code, stdout } = await runCli(["completion", "--zsh"]);
    expect(code).toBe(0);
    expect(stdout).toContain("#compdef hufi");
    expect(stdout).toContain("_hufi()");
  });

  test("completion --fish outputs fish script", async () => {
    const { code, stdout } = await runCli(["completion", "--fish"]);
    expect(code).toBe(0);
    expect(stdout).toContain("# hufi completions for fish");
    expect(stdout).toContain("complete -c hufi");
  });
});

describe("auth commands", () => {
  test("auth generate creates wallet", async () => {
    const { code, stdout } = await runCli(["auth", "generate"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Address: 0x");
    expect(stdout).toContain("Private key: 0x");
  });

  test("auth generate --json outputs JSON", async () => {
    const { code, stdout } = await runCli(["auth", "generate", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(parsed.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  test("auth status --json shows unauthenticated state", async () => {
    const { code, stdout } = await runCli(["auth", "status", "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.apiUrl).toBe("https://ro.hu.finance");
    expect(typeof parsed.authenticated).toBe("boolean");
  });
});
