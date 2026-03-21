import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TEST_CONFIG_DIR = join(homedir(), ".hufi-cli");
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, "config.json");
let originalConfig: string | null = null;

function backupConfig() {
  if (existsSync(TEST_CONFIG_FILE)) {
    originalConfig = readFileSync(TEST_CONFIG_FILE, "utf-8");
  }
}

function restoreConfig() {
  if (originalConfig !== null) {
    writeFileSync(TEST_CONFIG_FILE, originalConfig);
  } else if (existsSync(TEST_CONFIG_FILE)) {
    rmSync(TEST_CONFIG_FILE);
  }
}

describe("config", () => {
  beforeEach(() => {
    backupConfig();
    if (existsSync(TEST_CONFIG_FILE)) {
      rmSync(TEST_CONFIG_FILE);
    }
  });

  afterEach(() => {
    restoreConfig();
  });

  test("loadConfig returns defaults when no config file exists", async () => {
    // Re-import to get fresh module
    const { loadConfig } = await import("../../src/lib/config.ts");
    const config = loadConfig();
    expect(config.recordingApiUrl).toBe("https://ro.hu.finance");
    expect(config.accessToken).toBeUndefined();
    expect(config.address).toBeUndefined();
  });

  test("saveConfig creates config file", async () => {
    const { saveConfig, getConfigPath } = await import("../../src/lib/config.ts");
    saveConfig({
      recordingApiUrl: "https://test.hu.finance",
      address: "0x123",
      accessToken: "token123",
    });

    expect(existsSync(getConfigPath())).toBe(true);
    const raw = readFileSync(getConfigPath(), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.recordingApiUrl).toBe("https://test.hu.finance");
    expect(parsed.address).toBe("0x123");
    expect(parsed.accessToken).toBe("token123");
  });

  test("updateConfig merges with existing config", async () => {
    const { saveConfig, updateConfig, loadConfig } = await import("../../src/lib/config.ts");
    saveConfig({
      recordingApiUrl: "https://ro.hu.finance",
      address: "0xabc",
    });

    updateConfig({ accessToken: "newtoken" });

    const config = loadConfig();
    expect(config.recordingApiUrl).toBe("https://ro.hu.finance");
    expect(config.address).toBe("0xabc");
    expect(config.accessToken).toBe("newtoken");
  });

  test("getConfigDir returns correct path", async () => {
    const { getConfigDir } = await import("../../src/lib/config.ts");
    expect(getConfigDir()).toBe(TEST_CONFIG_DIR);
  });
});
