import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import type { Config, ProfileConfig } from "../types/config.ts";

const CONFIG_DIR = join(homedir(), ".hufi-cli");
const DEFAULT_CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_KEY_FILE = join(CONFIG_DIR, "key.json");
const DEFAULT_PROFILE = "default";

let customConfigFile: string | null = null;
let customKeyFile: string | null = null;
let selectedProfile: string | null = null;

export function setConfigFile(path: string) {
  customConfigFile = path;
}

export function setKeyFile(path: string) {
  customKeyFile = path;
}

export function setProfile(profile: string) {
  selectedProfile = profile;
}

function configFile(): string {
  return customConfigFile ?? DEFAULT_CONFIG_FILE;
}

function keyFile(): string {
  return customKeyFile ?? DEFAULT_KEY_FILE;
}

function defaultProfileKeyFile(profileName: string): string {
  if (profileName === DEFAULT_PROFILE) {
    return DEFAULT_KEY_FILE;
  }
  const sanitized = profileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(CONFIG_DIR, `key.${sanitized}.json`);
}

const DEFAULT_CONFIG: Config = {
  recordingApiUrl: "https://ro.hu.finance",
  launcherApiUrl: "https://cl.hu.finance",
  defaultChainId: 137,
  activeProfile: DEFAULT_PROFILE,
  profiles: {},
};

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function normalizeConfig(rawConfig: Partial<Config>): Config {
  const merged: Config = {
    ...DEFAULT_CONFIG,
    ...rawConfig,
    profiles: { ...(rawConfig.profiles ?? {}) },
  };

  const hasLegacyAuth =
    rawConfig.address !== undefined ||
    rawConfig.accessToken !== undefined ||
    rawConfig.refreshToken !== undefined ||
    Boolean(customKeyFile) ||
    existsSync(DEFAULT_KEY_FILE);

  if (
    hasLegacyAuth &&
    !merged.profiles?.[DEFAULT_PROFILE]
  ) {
    const legacyProfile: ProfileConfig = {};
    if (rawConfig.address !== undefined) legacyProfile.address = rawConfig.address;
    if (rawConfig.accessToken !== undefined) legacyProfile.accessToken = rawConfig.accessToken;
    if (rawConfig.refreshToken !== undefined) legacyProfile.refreshToken = rawConfig.refreshToken;
    if (customKeyFile) {
      legacyProfile.keyFile = customKeyFile;
    } else if (existsSync(DEFAULT_KEY_FILE)) {
      legacyProfile.keyFile = DEFAULT_KEY_FILE;
    }
    merged.profiles = {
      ...merged.profiles,
      [DEFAULT_PROFILE]: legacyProfile,
    };
  }

  merged.activeProfile = selectedProfile ?? merged.activeProfile ?? DEFAULT_PROFILE;
  if (!merged.profiles) {
    merged.profiles = {};
  }

  return merged;
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!existsSync(configFile())) {
    return normalizeConfig({});
  }
  try {
    const raw = readFileSync(configFile(), "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch {
    return normalizeConfig({});
  }
}

export function saveConfig(config: Config) {
  ensureConfigDir();
  writeFileSync(configFile(), JSON.stringify(config, null, 2) + "\n");
}

export function updateConfig(partial: Partial<Config>) {
  const current = loadConfig();
  const merged = {
    ...current,
    ...partial,
    profiles: {
      ...(current.profiles ?? {}),
      ...(partial.profiles ?? {}),
    },
  };
  saveConfig(merged);
  return merged;
}

export function getConfigDir() {
  return CONFIG_DIR;
}

export interface LocalKeyInfo {
  profile: string;
  keyPath: string;
  address: string | null;
}

export function getConfigPath() {
  return configFile();
}

export function getKeyPath() {
  return getProfileKeyPath();
}

export function keyExists(): boolean {
  return existsSync(getProfileKeyPath());
}

export function saveKey(key: string, address: string) {
  ensureConfigDir();
  const profileKeyPath = getProfileKeyPath();
  writeFileSync(profileKeyPath, JSON.stringify({ address, privateKey: key }, null, 2) + "\n");
  updateProfile(getSelectedProfileName(), { keyFile: profileKeyPath, address });
}

export function getDefaultChainId(): number {
  return loadConfig().defaultChainId ?? 137;
}

export function getDefaultAddress(): string | undefined {
  return getActiveProfile().address ?? loadConfig().address;
}

export function loadKey(): string | null {
  const profileKeyPath = getProfileKeyPath();
  if (!existsSync(profileKeyPath)) return null;
  try {
    const raw = readFileSync(profileKeyPath, "utf-8");
    return JSON.parse(raw).privateKey ?? null;
  } catch {
    return null;
  }
}

export function getSelectedProfileName(): string {
  return selectedProfile ?? loadConfig().activeProfile ?? DEFAULT_PROFILE;
}

export function getActiveProfile(): ProfileConfig {
  const config = loadConfig();
  const profileName = getSelectedProfileName();
  return config.profiles?.[profileName] ?? {};
}

export function getProfile(profileName = getSelectedProfileName()): ProfileConfig {
  return loadConfig().profiles?.[profileName] ?? {};
}

export function getProfileKeyPath(profileName = getSelectedProfileName()): string {
  const profile = getProfile(profileName);
  if (profile.keyFile) {
    return profile.keyFile;
  }
  if (customKeyFile && profileName === DEFAULT_PROFILE) {
    return customKeyFile;
  }
  return defaultProfileKeyFile(profileName);
}

export function updateProfile(profileName: string, partial: Partial<ProfileConfig>) {
  const config = loadConfig();
  const currentProfile = config.profiles?.[profileName] ?? {};
  const mergedProfile = { ...currentProfile, ...partial };
  updateConfig({
    activeProfile: profileName,
    profiles: {
      ...(config.profiles ?? {}),
      [profileName]: mergedProfile,
    },
  });
  return mergedProfile;
}

export function listLocalKeys(): LocalKeyInfo[] {
  ensureConfigDir();
  const entries = readdirSync(CONFIG_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^key(\.[^.]+)?\.json$/.test(entry.name))
    .map((entry) => {
      const keyPath = join(CONFIG_DIR, entry.name);
      const profile = entry.name === "key.json"
        ? DEFAULT_PROFILE
        : entry.name.replace(/^key\./, "").replace(/\.json$/, "");

      let address: string | null = null;
      try {
        const raw = JSON.parse(readFileSync(keyPath, "utf-8"));
        address = typeof raw.address === "string" ? raw.address : null;
      } catch {
        address = null;
      }

      return { profile, keyPath, address };
    });

  return entries.sort((a, b) => a.profile.localeCompare(b.profile));
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

  if (config.activeProfile !== undefined && typeof config.activeProfile !== "string") {
    issues.push("activeProfile must be a string");
  }

  if (config.profiles !== undefined) {
    if (
      typeof config.profiles !== "object" ||
      config.profiles === null ||
      Array.isArray(config.profiles)
    ) {
      issues.push("profiles must be an object mapping profile names to auth state");
    } else {
      for (const [name, profile] of Object.entries(config.profiles)) {
        if (!name.trim()) {
          issues.push("profiles keys must be non-empty strings");
        }
        if (typeof profile !== "object" || profile === null || Array.isArray(profile)) {
          issues.push(`profiles.${name} must be an object`);
          continue;
        }
        if (
          profile.address !== undefined &&
          (typeof profile.address !== "string" || !isEvmAddress(profile.address))
        ) {
          issues.push(`profiles.${name}.address must be a valid 0x-prefixed EVM address`);
        }
        if (profile.keyFile !== undefined && typeof profile.keyFile !== "string") {
          issues.push(`profiles.${name}.keyFile must be a string`);
        }
      }
    }
  }

  if (config.rpcUrls !== undefined) {
    if (
      typeof config.rpcUrls !== "object" ||
      config.rpcUrls === null ||
      Array.isArray(config.rpcUrls)
    ) {
      issues.push("rpcUrls must be an object mapping chain IDs to RPC URLs");
    } else {
      for (const [chainId, url] of Object.entries(config.rpcUrls)) {
        if (!/^\d+$/.test(chainId)) {
          issues.push(`rpcUrls key '${chainId}' must be a numeric chain ID`);
        }
        if (typeof url !== "string" || !isHttpUrl(url)) {
          issues.push(`rpcUrls.${chainId} must be a valid http/https URL`);
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
