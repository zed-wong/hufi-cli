import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Config } from "../types/config.ts";

const CONFIG_DIR = join(homedir(), ".hufi-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const KEY_FILE = join(CONFIG_DIR, "key.json");

const DEFAULT_CONFIG: Config = {
  recordingApiUrl: "https://ro.hu.finance",
  launcherApiUrl: "https://cl.hu.finance",
};

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
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
  return CONFIG_FILE;
}

export function getKeyPath() {
  return KEY_FILE;
}

export function saveKey(key: string) {
  ensureConfigDir();
  writeFileSync(KEY_FILE, JSON.stringify({ privateKey: key }, null, 2) + "\n");
}

export function loadKey(): string | null {
  if (!existsSync(KEY_FILE)) return null;
  try {
    const raw = readFileSync(KEY_FILE, "utf-8");
    return JSON.parse(raw).privateKey ?? null;
  } catch {
    return null;
  }
}
