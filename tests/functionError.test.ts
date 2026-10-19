import { test, expect } from "bun:test";
import { readFunctionError } from "../src/lib/functionError";

test("function HTTP failure exposes response payload without consuming the response", async () => {
  const response = new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 400 });
  expect(await readFunctionError({ context: response }, null)).toEqual({ message: "origin_not_allowed", status: 400 });
  expect(response.bodyUsed).toBe(false);
});

test("gateway failure preserves HTTP status even without a JSON response", async () => {
  expect(await readFunctionError({ context: new Response("Unavailable", { status: 503 }) }, null)).toEqual({ status: 503 });
});

test("data error is extracted when the service returns an error in a successful HTTP response", async () => {
  expect(await readFunctionError(null, { error: "invalid_input" })).toEqual({ message: "invalid_input" });
});