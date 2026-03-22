import { test, expect, describe } from "bun:test";

describe("runWatchLoop", () => {
  test("runs callback repeatedly until shouldContinue returns false", async () => {
    const { runWatchLoop } = await import("../../src/lib/watch.ts");

    let ticks = 0;
    await runWatchLoop(
      async () => {
        ticks += 1;
      },
      {
        intervalMs: 1,
        shouldContinue: () => ticks < 3,
      }
    );

    expect(ticks).toBe(3);
  });
});
