export interface Config {
  recordingApiUrl: string;
  launcherApiUrl?: string;
  address?: string;
  accessToken?: string;
  refreshToken?: string;
  defaultChainId?: number;
  rpcUrls?: Record<string, string>;
  activeProfile?: string;
  profiles?: Record<string, ProfileConfig>;
}

export interface ProfileConfig {
  address?: string;
  accessToken?: string;
  refreshToken?: string;
  keyFile?: string;
}
