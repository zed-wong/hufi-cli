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
