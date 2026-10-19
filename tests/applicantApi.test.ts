import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

const adminId = "22222222-2222-4222-8222-222222222222";
const workerId = "11111111-1111-4111-8111-111111111111";
const applicationId = "33333333-3333-4333-8333-333333333333";
const templateId = "44444444-4444-4444-8444-444444444444";

async function harness(failure?: string, existing = false) {
  const calls: string[] = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: adminId } } }),
      admin: {
        createUser: async () => { calls.push("create"); return { data: { user: { id: workerId } } }; },
        deleteUser: async (id: string) => { calls.push(`delete:${id}`); return {}; },
      },
      resetPasswordForEmail: async () => { calls.push("mail"); return {}; },
    },
    rpc: async (name: string) => { calls.push(name); return { data: true, error: failure === name ? new Error("failed") : null }; },
    from: (table: string) => {
      let operation = "select";
      let userId = "";
      const result = () => {
        calls.push(`${table}:${operation}`);
        if (failure === `${table}:${operation}`) return { data: null, error: new Error("failed") };
        if (operation === "upsert" || operation === "insert") return { data: null, error: null };
        if (table === "user_roles") return { data: userId === adminId ? { role: "admin" } : null };
        if (table === "applications") return { data: { email: "worker@example.test", status: "pending", first_name: "Max", last_name: "Muster", employment_type: "teilzeit" } };
        if (table === "contract_templates") return { data: { id: templateId } };
        if (table === "profiles") return { data: existing ? { id: workerId } : null };
        return { data: null, error: null };
      };
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => { if (column === "user_id") userId = value; return chain; },
        ilike: () => chain,
        upsert: () => { operation = "upsert"; return chain; },
        insert: () => { operation = "insert"; return chain; },
        maybeSingle: async () => result(),
        single: async () => result(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  };
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const source = readFileSync(new URL("../selfhost/functions/applicant-api/index.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "");
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
  new Function("createClient", "corsHeaders", "z", "Deno", js)(() => client, {}, z, {
    env: { get: (name: string) => name === "APPLICANT_ALLOWED_ORIGINS" ? "http://localhost:8080" : "test" },
    serve: (fn: typeof handler) => { handler = fn; },
  });
  if (!handler) throw new Error("Handler not registered");
  const invoke = (body: unknown) => handler(new Request("http://localhost/api", {
    method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  return { calls, invoke };
}

const acceptance = { action: "accept", application_id: applicationId, template_id: templateId, start_date: "2026-11-01", salary: 2200, origin: "http://localhost:8080" };

test("failed profile creation cleans up newly created applicant account", async () => {
  const { calls, invoke } = await harness("profiles:upsert");
  expect((await invoke(acceptance)).status).toBe(500);
  expect(calls).toContain(`delete:${workerId}`);
  expect(calls).not.toContain("mail");
});

test("failed employee-role creation cleans up newly created applicant account", async () => {
  const { calls, invoke } = await harness("user_roles:upsert");
  expect((await invoke(acceptance)).status).toBe(500);
  expect(calls).toContain(`delete:${workerId}`);
});

test("existing applicant account receives required employee role without duplicate account", async () => {
  const { calls, invoke } = await harness(undefined, true);
  expect((await invoke(acceptance)).status).toBe(200);
  expect(calls).toContain("user_roles:upsert");
  expect(calls).toContain("applicant_finalize_acceptance");
  expect(calls).not.toContain("create");
});

test("missing ingress IP does not put all applicants under the same personal quota", async () => {
  const { calls, invoke } = await harness();
  const response = await invoke({ action: "submit", application: { first_name: "Max", last_name: "Muster", email: "worker@example.test", phone: "0123456789", birth_date: "1990-01-01", street: "Testweg 1", postal_code: "12345", city: "Teststadt", employment_type: "teilzeit" } });
  expect(response.status).toBe(200);
  expect(calls).toContain("applicant_global_submission_allowed");
  expect(calls).not.toContain("applicant_submission_allowed");
});