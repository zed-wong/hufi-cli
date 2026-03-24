export interface Config {
  recordingApiUrl: string;
  launcherApiUrl?: string;
  address?: string;
  accessToken?: string;
  refreshToken?: string;
  defaultChainId?: number;
  rpcUrls?: Record<string, string>;
}
