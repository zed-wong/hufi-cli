import { test, expect, describe } from "bun:test";

describe("toCsvRows", () => {
  test("serializes rows with header", async () => {
    const { toCsvRows } = await import("../../src/lib/export.ts");
    const csv = toCsvRows([
      { exchange: "mexc", symbol: "HMT/USDT", score: "100" },
      { exchange: "bybit", symbol: "HMT", score: "80" },
    ]);

    expect(csv).toContain("exchange,symbol,score");
    expect(csv).toContain("mexc,HMT/USDT,100");
    expect(csv).toContain("bybit,HMT,80");
  });
});
