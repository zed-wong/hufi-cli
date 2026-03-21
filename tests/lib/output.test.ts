import { test, expect, describe } from "bun:test";

describe("maskSecret", () => {
  test("masks short strings fully", async () => {
    const { maskSecret } = await import("../../src/lib/output.ts");
    expect(maskSecret("abc")).toBe("***");
  });

  test("masks long strings with prefix/suffix", async () => {
    const { maskSecret } = await import("../../src/lib/output.ts");
    expect(maskSecret("abcdefghijklmnop")).toBe("abcd...mnop");
  });

  test("handles empty string", async () => {
    const { maskSecret } = await import("../../src/lib/output.ts");
    expect(maskSecret("")).toBe("");
  });

  test("handles exactly 8 chars", async () => {
    const { maskSecret } = await import("../../src/lib/output.ts");
    expect(maskSecret("12345678")).toBe("********");
  });

  test("handles 9 chars", async () => {
    const { maskSecret } = await import("../../src/lib/output.ts");
    expect(maskSecret("123456789")).toBe("1234...6789");
  });
});
