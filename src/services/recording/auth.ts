import { Wallet } from "ethers";
import { requestJson } from "../../lib/http.ts";
import type { AuthResult, WalletInfo } from "../../types/auth.ts";

export function createWallet(): WalletInfo {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export async function authenticate(
  baseUrl: string,
  privateKey: string
): Promise<AuthResult> {
  const wallet = new Wallet(privateKey);
  const address = wallet.address;

  const noncePayload = await requestJson(`${baseUrl}/auth/nonce`, {
    method: "POST",
    body: JSON.stringify({ address }),
  });

  const signableMessage =
    noncePayload && typeof noncePayload === "object" && "nonce" in noncePayload
      ? JSON.stringify(noncePayload)
      : JSON.stringify(noncePayload);

  const signature = await wallet.signMessage(signableMessage);

  const authPayload = (await requestJson(`${baseUrl}/auth`, {
    method: "POST",
    body: JSON.stringify({ address, signature }),
  })) as Record<string, unknown>;

  const accessToken =
    (authPayload.access_token as string) ||
    (authPayload.accessToken as string);

  if (!accessToken) {
    throw new Error("Auth succeeded but access token is missing in response");
  }

  return {
    address,
    noncePayload,
    signature,
    accessToken,
    refreshToken:
      (authPayload.refresh_token as string) ||
      (authPayload.refreshToken as string) ||
      undefined,
  };
}
