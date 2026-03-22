import { loadConfig } from "./config.ts";
import { printText } from "./output.ts";

export interface AuthTokenContext {
  baseUrl: string;
  accessToken: string;
}

export interface AuthAddressContext extends AuthTokenContext {
  address: string;
}

export function requireAuthToken(): AuthTokenContext {
  const config = loadConfig();
  if (!config.accessToken) {
    printText("Not authenticated. Run: hufi auth login --private-key <key>");
    process.exit(1);
  }

  return {
    baseUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    accessToken: config.accessToken,
  };
}

export function requireAuthAddress(): AuthAddressContext {
  const config = loadConfig();
  if (!config.accessToken || !config.address) {
    printText("Not authenticated. Run: hufi auth login --private-key <key>");
    process.exit(1);
  }

  return {
    baseUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    accessToken: config.accessToken,
    address: config.address,
  };
}
