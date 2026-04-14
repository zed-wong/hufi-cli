import { describe, expect, test } from "bun:test";
import { ApiError } from "../lib/errors.ts";
import { withSingleUnauthorizedRetry } from "./campaign.ts";

describe("campaign auth retry", () => {
  test("retries once after unauthorized error", async () => {
    let attempts = 0;
    let retryCount = 0;

    const result = await withSingleUnauthorizedRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiError("Unauthorized", 401);
        }
        return "ok";
      },
      async () => {
        retryCount += 1;
      }
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    expect(retryCount).toBe(1);
  });

  test("does not retry on non-unauthorized errors", async () => {
    let retryCount = 0;

    await expect(
      withSingleUnauthorizedRetry(
        async () => {
          throw new ApiError("Forbidden", 403);
        },
        async () => {
          retryCount += 1;
        }
      )
    ).rejects.toThrow("Forbidden");

    expect(retryCount).toBe(0);
  });

  test("surfaces error from retried request when it still fails", async () => {
    let retryCount = 0;

    await expect(
      withSingleUnauthorizedRetry(
        async () => {
          throw new ApiError("Unauthorized", 401);
        },
        async () => {
          retryCount += 1;
        }
      )
    ).rejects.toThrow("Unauthorized");

    expect(retryCount).toBe(1);
  });
});
