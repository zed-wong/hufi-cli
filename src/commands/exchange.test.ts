import { describe, expect, test } from "bun:test";
import { ApiError } from "../lib/errors.ts";
import { createExchangeCommand } from "./exchange.ts";

describe("exchange command UX", () => {
  test("register help explains that name uses CCXT exchange names", () => {
    const register = createExchangeCommand().commands.find(
      (command) => command.name() === "register"
    );

    expect(register).toBeDefined();
    expect(register?.helpInformation()).toContain("CCXT exchange name");
  });

  test("register auth failures tell the user to run auth login first", async () => {
    const exchangeModule = await import("./exchange.ts");
    const formatExchangeCommandErrorMessage =
      exchangeModule.formatExchangeCommandErrorMessage as
        | ((action: string, err: unknown) => string)
        | undefined;

    expect(formatExchangeCommandErrorMessage).toBeDefined();

    const message = formatExchangeCommandErrorMessage?.(
      "register",
      new ApiError("Unauthorized", 401)
    );

    expect(message).toContain(
      "Run: hufi auth login --private-key <key> before registering exchange API keys."
    );
  });

  test("register help no longer exposes a local label option", () => {
    const register = createExchangeCommand().commands.find(
      (command) => command.name() === "register"
    );

    expect(register).toBeDefined();
    expect(register?.helpInformation()).not.toContain("--label");
  });

  test("delete help prefers positional exchange name", () => {
    const del = createExchangeCommand().commands.find(
      (command) => command.name() === "delete"
    );

    expect(del).toBeDefined();
    expect(del?.helpInformation()).toContain("exchange delete [name]");
  });

  test("revalidate help prefers positional exchange name", () => {
    const revalidate = createExchangeCommand().commands.find(
      (command) => command.name() === "revalidate"
    );

    expect(revalidate).toBeDefined();
    expect(revalidate?.helpInformation()).toContain("exchange revalidate [name]");
  });

  test("revalidate text output tolerates successful responses without missing permissions", async () => {
    const exchangeModule = await import("./exchange.ts");
    const formatRevalidateText = exchangeModule.formatRevalidateText as
      | ((exchangeName: string, result: { is_valid: boolean; missing_permissions?: string[] }) => string[])
      | undefined;

    expect(formatRevalidateText).toBeDefined();
    expect(
      formatRevalidateText?.("mexc", {
        is_valid: true,
      })
    ).toEqual(["mexc: valid"]);
  });
});
