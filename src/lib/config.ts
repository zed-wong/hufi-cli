import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Config } from "../types/config.ts";

const CONFIG_DIR = join(homedir(), ".hufi-cli");
const DEFAULT_CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_KEY_FILE = join(CONFIG_DIR, "key.json");

let customConfigFile: string | null = null;
let customKeyFile: string | null = null;

export function setConfigFile(path: string) {
  customConfigFile = path;
}

export function setKeyFile(path: string) {
  customKeyFile = path;
}

function configFile(): string {
  return customConfigFile ?? DEFAULT_CONFIG_FILE;
}

function keyFile(): string {
  return customKeyFile ?? DEFAULT_KEY_FILE;
}

const DEFAULT_CONFIG: Config = {
  recordingApiUrl: "https://ro.hu.finance",
  launcherApiUrl: "https://cl.hu.finance",
  defaultChainId: 137,
};

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!existsSync(configFile())) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(configFile(), "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config) {
  ensureConfigDir();
  writeFileSync(configFile(), JSON.stringify(config, null, 2) + "\n");
}

export function updateConfig(partial: Partial<Config>) {
  const current = loadConfig();
  const merged = { ...current, ...partial };
  saveConfig(merged);
  return merged;
}

export function getConfigDir() {
  return CONFIG_DIR;
}

export function getConfigPath() {
  return configFile();
}

export function getKeyPath() {
  return keyFile();
}

export function keyExists(): boolean {
  return existsSync(keyFile());
}

export function saveKey(key: string, address: string) {
  ensureConfigDir();
  writeFileSync(keyFile(), JSON.stringify({ address, privateKey: key }, null, 2) + "\n");
}

export function getDefaultChainId(): number {
  return loadConfig().defaultChainId ?? 137;
}

export function getDefaultAddress(): string | undefined {
  return loadConfig().address;
}

export function loadKey(): string | null {
  if (!existsSync(keyFile())) return null;
  try {
    const raw = readFileSync(keyFile(), "utf-8");
    return JSON.parse(raw).privateKey ?? null;
  } catch {
    return null;
  }
}

export interface ConfigValidationResult {
  valid: boolean;
  issues: string[];
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function validateConfig(config: Partial<Config>): ConfigValidationResult {
  const issues: string[] = [];

  if (config.recordingApiUrl !== undefined && !isHttpUrl(config.recordingApiUrl)) {
    issues.push("recordingApiUrl must be a valid http/https URL");
  }

  if (config.launcherApiUrl !== undefined && !isHttpUrl(config.launcherApiUrl)) {
    issues.push("launcherApiUrl must be a valid http/https URL");
  }

  if (config.defaultChainId !== undefined) {
    if (!Number.isInteger(config.defaultChainId) || config.defaultChainId <= 0) {
      issues.push("defaultChainId must be a positive integer");
    }
  }

  if (config.address !== undefined && !isEvmAddress(config.address)) {
    issues.push("address must be a valid 0x-prefixed EVM address");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
