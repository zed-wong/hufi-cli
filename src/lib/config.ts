import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Config } from "../types/config.ts";

const CONFIG_DIR = join(homedir(), ".hufi-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_KEY_FILE = join(CONFIG_DIR, "key.json");

let customKeyFile: string | null = null;

export function setKeyFile(path: string) {
  customKeyFile = path;
}

function keyFile(): string {
  return customKeyFile ?? DEFAULT_KEY_FILE;
}

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
  return keyFile();
}

export function keyExists(): boolean {
  return existsSync(keyFile());
}

export function saveKey(key: string, address: string) {
  ensureConfigDir();
  writeFileSync(keyFile(), JSON.stringify({ address, privateKey: key }, null, 2) + "\n");
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
