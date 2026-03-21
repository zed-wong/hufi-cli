import { test, expect, describe } from "bun:test";
import { ApiError } from "../../src/lib/errors.ts";

describe("requestJson", () => {
  test("parses JSON response on success", async () => {
    const { requestJson } = await import("../../src/lib/http.ts");

    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    try {
      const result = await requestJson(`http://localhost:${server.port}/test`);
      expect(result).toEqual({ ok: true });
    } finally {
      server.stop();
    }
  });

  test("throws ApiError on non-2xx response", async () => {
    const { requestJson } = await import("../../src/lib/http.ts");

    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    try {
      await requestJson(`http://localhost:${server.port}/test`);
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).message).toBe("not found");
    } finally {
      server.stop();
    }
  });

  test("returns text on non-JSON response", async () => {
    const { requestJson } = await import("../../src/lib/http.ts");

    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("plain text", {
          headers: { "Content-Type": "text/plain" },
        });
      },
    });

    try {
      const result = await requestJson(`http://localhost:${server.port}/test`);
      expect(result).toBe("plain text");
    } finally {
      server.stop();
    }
  });

  test("sends POST with body", async () => {
    const { requestJson } = await import("../../src/lib/http.ts");

    let receivedBody = "";
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        receivedBody = await req.text();
        return new Response(JSON.stringify({ received: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    try {
      await requestJson(`http://localhost:${server.port}/test`, {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      });
      expect(receivedBody).toBe('{"key":"value"}');
    } finally {
      server.stop();
    }
  });
});

describe("authHeaders", () => {
  test("returns Bearer token header", async () => {
    const { authHeaders } = await import("../../src/lib/http.ts");
    expect(authHeaders("mytoken")).toEqual({
      Authorization: "Bearer mytoken",
    });
  });
});
