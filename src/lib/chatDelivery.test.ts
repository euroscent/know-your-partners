import { test, expect } from "bun:test";
import { deliverChatMessage } from "./chatDelivery";

test("failed storage must not call the assistant or report delivery", async () => {
  let called = false;
  await expect(deliverChatMessage(async () => ({ error: { message: "permission denied" } }), async () => {
    called = true;
    return { data: null, error: null };
  })).rejects.toThrow("permission denied");
  expect(called).toBe(false);
});

test("saved employee messages remain delivered when automatic replies fail", async () => {
  const result = await deliverChatMessage(async () => ({ error: null }), async () => ({ data: null, error: { message: "Unauthorized" } }));
  expect(result.delivered).toBe(true);
  expect(result.answer).toBeNull();
  expect(result.replyError).toBe("Unauthorized");
});