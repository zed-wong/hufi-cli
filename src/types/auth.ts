export interface AuthResult {
  address: string;
  accessToken: string;
  refreshToken?: string;
  noncePayload: unknown;
  signature: string;
}

export interface WalletInfo {
  address: string;
  privateKey: string;
}
