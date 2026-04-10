import { getActiveProfile, getSelectedProfileName, loadConfig } from "./config.ts";
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
  const profile = getActiveProfile();
  if (!profile.accessToken) {
    printText(`Profile '${getSelectedProfileName()}' is not authenticated. Run: hufi --profile ${getSelectedProfileName()} auth login --private-key <key>`);
    process.exit(1);
  }

  return {
    baseUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    accessToken: profile.accessToken,
  };
}

export function requireAuthAddress(): AuthAddressContext {
  const config = loadConfig();
  const profile = getActiveProfile();
  if (!profile.accessToken || !profile.address) {
    printText(`Profile '${getSelectedProfileName()}' is not authenticated. Run: hufi --profile ${getSelectedProfileName()} auth login --private-key <key>`);
    process.exit(1);
  }

  return {
    baseUrl: config.recordingApiUrl.replace(/\/+$/, ""),
    accessToken: profile.accessToken,
    address: profile.address,
  };
}
