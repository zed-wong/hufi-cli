import { test, expect, describe } from "bun:test";

describe("estimateGasWithBuffer", () => {
  test("adds 12% buffer by default", async () => {
    const { estimateGasWithBuffer } = await import("../../src/lib/blockchain.ts");
    expect(estimateGasWithBuffer(1000n)).toBe(1120n);
  });

  test("respects custom basis points", async () => {
    const { estimateGasWithBuffer } = await import("../../src/lib/blockchain.ts");
    expect(estimateGasWithBuffer(1000n, 500)).toBe(1050n);
  });
});

describe("waitForConfirmations", () => {
  test("resolves once tx reaches required confirmations", async () => {
    const { waitForConfirmations } = await import("../../src/lib/blockchain.ts");

    let calls = 0;
    const provider = {
      async getTransactionReceipt() {
        calls += 1;
        if (calls < 3) {
          return { confirmations: 0, hash: "0xabc" };
        }
        return { confirmations: 1, hash: "0xabc" };
      },
    };

    const receipt = await waitForConfirmations(provider, "0xabc", {
      minConfirmations: 1,
      pollMs: 1,
      timeoutMs: 100,
    });

    expect(receipt.hash).toBe("0xabc");
    expect(calls).toBe(3);
  });

  test("throws on timeout", async () => {
    const { waitForConfirmations } = await import("../../src/lib/blockchain.ts");

    const provider = {
      async getTransactionReceipt() {
        return null;
      },
    };

    try {
      await waitForConfirmations(provider, "0xdef", {
        minConfirmations: 1,
        pollMs: 1,
        timeoutMs: 5,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("Timed out waiting for transaction confirmation");
    }
  });

  test("reports confirmation progress while polling", async () => {
    const { waitForConfirmations } = await import("../../src/lib/blockchain.ts");

    let calls = 0;
    const seen: number[] = [];
    const provider = {
      async getTransactionReceipt() {
        calls += 1;
        if (calls === 1) return null;
        if (calls === 2) return { confirmations: 0, hash: "0xaaa" };
        return { confirmations: 2, hash: "0xaaa" };
      },
    };

    await waitForConfirmations(provider, "0xaaa", {
      minConfirmations: 2,
      pollMs: 1,
      timeoutMs: 100,
      onProgress: (confirmations) => {
        seen.push(confirmations);
      },
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(2);
  });
});
