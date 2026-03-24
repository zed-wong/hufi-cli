import { describe, expect, test } from "bun:test";

describe("contracts RPC selection", () => {
  test("prefers config-provided RPC override for a chain", async () => {
    const contractsModule = await import("../../src/lib/contracts.ts");
    const getRpc = contractsModule.getRpc as
      | ((chainId: number) => string)
      | undefined;

    expect(getRpc).toBeDefined();

    process.env.HUFI_RPC_137 = "http://127.0.0.1:8545";
    try {
      expect(getRpc?.(137)).toBe("http://127.0.0.1:8545");
    } finally {
      delete process.env.HUFI_RPC_137;
    }
  });
});
