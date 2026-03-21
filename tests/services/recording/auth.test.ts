import { test, expect, describe } from "bun:test";

describe("createWallet", () => {
  test("generates a random wallet with address and privateKey", async () => {
    const { createWallet } = await import("../../../src/services/recording/auth.ts");
    const wallet = createWallet();

    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(wallet.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  test("generates unique wallets", async () => {
    const { createWallet } = await import("../../../src/services/recording/auth.ts");
    const w1 = createWallet();
    const w2 = createWallet();

    expect(w1.address).not.toBe(w2.address);
    expect(w1.privateKey).not.toBe(w2.privateKey);
  });
});
