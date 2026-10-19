import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

const adminId = "22222222-2222-4222-8222-222222222222";
const workerId = "11111111-1111-4111-8111-111111111111";
const applicationId = "33333333-3333-4333-8333-333333333333";
const templateId = "44444444-4444-4444-8444-444444444444";

async function harness(failure?: string, existing = false, chosen = false, accepted = false, authFailure?: {code?: string; status?: number; message?: string}) {
  const calls: string[] = [];
  const createdUsers: Record<string, unknown>[] = [];
  const insertedApplications: Record<string, unknown>[] = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: adminId } } }),
      admin: {
        createUser: async (input: Record<string, unknown>) => { createdUsers.push(input); calls.push("create"); return authFailure ? { data: { user: null }, error: authFailure } : { data: { user: { id: workerId } } }; },
        updateUserById: async () => { calls.push('unlock'); return {}; },
        deleteUser: async (id: string) => { calls.push(`delete:${id}`); return {}; },
      },
      resetPasswordForEmail: async () => { calls.push("mail"); return {}; },
      signInWithPassword: async () => { calls.push('signin'); return {data:{session:{access_token:'test',refresh_token:'test'}}}; },
    },
    rpc: async (name: string) => { calls.push(name); return { data: true, error: failure === name ? new Error("failed") : null }; },
    from: (table: string) => {
      let operation = "select";
      let userId = "";
      const result = () => {
        calls.push(`${table}:${operation}`);
        if (failure === `${table}:${operation}`) return { data: null, error: new Error("failed") };
        if(table === 'applications' && operation === 'insert') return {data:{id:applicationId},error:null};
        if (operation === "upsert" || operation === "insert" || operation === 'update' || operation === 'delete') return { data: null, error: null };
        if(table === 'applicant_accounts') return {data:chosen?{user_id:workerId,accepted_at:accepted?'2026-10-01':null}:null,error:null};
        if(table === 'applicant_workflows' && chosen && existing) return {data:{user_id:workerId},error:null};
        if (table === "user_roles") return { data: userId === adminId ? { role: "admin" } : null };
        if (table === "applications") return { data: { email: "worker@example.test", status: "pending", first_name: "Max", last_name: "Muster", employment_type: "teilzeit" } };
        if (table === "contract_templates") return { data: { id: templateId } };
        if (table === "profiles") return { data: existing ? { id: workerId,email:'worker@example.test' } : null };
        return { data: null, error: null };
      };
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => { if (column === "user_id") userId = value; return chain; },
        ilike: () => chain,
        upsert: () => { operation = "upsert"; return chain; },
        insert: (input: Record<string, unknown>) => { if(table==='applications') insertedApplications.push(input); operation = "insert"; return chain; },
        update: () => { operation='update'; return chain; },
        delete: () => { operation='delete'; return chain; },
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
  return { calls, invoke, createdUsers, insertedApplications };
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
  const response = await invoke(submission);
  expect(response.status).toBe(200);
  expect(calls).toContain("applicant_global_submission_allowed");
  expect(calls).not.toContain("applicant_submission_allowed");
});

const submission = {action:'submit',application:{first_name:'Max',last_name:'Muster',email:'worker@example.test',phone:'0123456789',birth_date:'1990-01-01',street:'Testweg 1',postal_code:'12345',city:'Teststadt',employment_type:'teilzeit',username:'max.muster',password:'chosen-password-123'}};
test('chosen password is sent only to Auth and the account starts banned',async()=>{
  const {invoke,createdUsers,insertedApplications}=await harness();
  expect((await invoke(submission)).status).toBe(200);
  expect(createdUsers[0]?.password).toBe('chosen-password-123');
  expect(createdUsers[0]?.ban_duration).toBe('876000h');
  expect(insertedApplications[0]).not.toHaveProperty('password');
});
test('pending chosen account cannot sign in',async()=>{
  const {invoke,calls}=await harness(undefined,true,true,false);
  expect((await invoke({action:'login',username:'max.muster',password:'chosen-password-123'})).status).toBe(401);
  expect(calls).not.toContain('signin');
});
test('acceptance unlocks chosen account without replacing its password or sending reset mail',async()=>{
  const {invoke,calls}=await harness(undefined,true,true);
  expect((await invoke(acceptance)).status).toBe(200);
  expect(calls).toContain('unlock');
  expect(calls).not.toContain('create');
  expect(calls).not.toContain('mail');
});

test('new applicant Auth database failure is not treated as a duplicate account', async () => {
  const {invoke,calls}=await harness(undefined,false,false,false,{code:'unexpected_failure',status:500,message:'private database details'});
  const response=await invoke(submission);
  expect(response.status).toBe(500);
  const body=await response.json();
  expect(body.code).toBe('unexpected_failure');
  expect(JSON.stringify(body)).not.toContain('private database details');
  expect(calls).not.toContain('applications:insert');
  expect(calls).not.toContain('applicant_accounts:insert');
});

test.each(['email_exists','user_already_exists'])('only confirmed Auth duplicate %s returns conflict', async code => {
  const {invoke}=await harness(undefined,false,false,false,{code,status:422});
  expect((await invoke(submission)).status).toBe(409);
});

test('Auth password policy rejection is a validation failure', async () => {
  const {invoke}=await harness(undefined,false,false,false,{code:'weak_password',status:422});
  expect((await invoke(submission)).status).toBe(422);
});

test('unrecognized Auth failure remains a service failure without exposing raw errors', async () => {
  const {invoke}=await harness(undefined,false,false,false,{status:500,message:'private account data'});
  const response=await invoke(submission);
  expect(response.status).toBe(500);
  expect((await response.json()).code).toBe('auth_creation_failed');
});

test('Auth rate limit remains retryable rather than duplicate conflict', async () => {
  const {invoke}=await harness(undefined,false,false,false,{code:'over_request_rate_limit',status:429});
  expect((await invoke(submission)).status).toBe(429);
});