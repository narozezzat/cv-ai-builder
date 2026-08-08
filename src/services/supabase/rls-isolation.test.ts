// @vitest-environment node

/**
 * The authorization gate for the whole product.
 *
 * Every query in the app runs through the cookie-bound anon client and carries no
 * `user_id` predicate of its own — `auth.uid()` inside the RLS policies is the only
 * thing keeping one account's resumes away from another's. That claim cannot be
 * checked by reading TypeScript, and it cannot be checked by mocking Supabase: a
 * mock proves the code calls the database, not that the database refuses. So this
 * test creates two real users on a real project and has each of them attack the
 * other's rows.
 *
 * A missing policy shows up here as a passing read, not as an error. That is the
 * failure mode worth a test — a wrong policy is silent, and the app looks fine
 * right up until someone notices they can see a stranger's CV.
 *
 * Skips itself when the keys are absent, which is how it behaves in CI. Run it
 * locally after any migration that touches a policy, and treat a skip as "not
 * proven" rather than "fine".
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(url && anonKey && serviceKey);

/** Long enough that the password policy (10 chars, mixed case, digit) is met. */
const PASSWORD = "Rls-Isolation-Probe-1";

type Client = SupabaseClient<Database>;

interface Actor {
  id: string;
  email: string;
  /** Signed in as this user. Subject to RLS exactly like the browser is. */
  client: Client;
}

function anonClient(): Client {
  // `persistSession: false` per client: the default storage is shared, so two
  // clients in one process would otherwise overwrite each other's session and both
  // end up acting as whoever signed in last — which would make every assertion
  // below pass for the wrong reason.
  return createClient<Database>(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!configured)("RLS isolation between accounts", () => {
  let admin: Client;
  let alice: Actor;
  let bob: Actor;
  let aliceResumeId: string;

  async function createActor(label: string): Promise<Actor> {
    // `example.com` is reserved by RFC 2606, so a stray confirmation email can
    // never reach a real inbox. `email_confirm` skips sending one at all.
    const email = `rls-${label}-${crypto.randomUUID()}@example.com`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new Error(`could not create ${label}: ${error?.message ?? "no user returned"}`);
    }

    const client = anonClient();
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });

    if (signIn.error) {
      throw new Error(`could not sign in ${label}: ${signIn.error.message}`);
    }

    return { id: data.user.id, email, client };
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    [alice, bob] = await Promise.all([createActor("alice"), createActor("bob")]);

    // Written through Alice's own client rather than the admin one: this also
    // proves the insert policy accepts an owner writing their own row, so a
    // later "0 rows" result cannot be blamed on the row never existing.
    const { data, error } = await alice.client
      .from("resumes")
      .insert({ user_id: alice.id, title: "Alice private resume" })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Alice could not create her own resume: ${error?.message}`);
    }

    aliceResumeId = data.id;
  }, 60_000);

  afterAll(async () => {
    // Cascades: `resumes.user_id references auth.users on delete cascade`, so
    // deleting the users removes every row this test created.
    await Promise.all(
      [alice?.id, bob?.id].filter(Boolean).map((id) => admin.auth.admin.deleteUser(id!)),
    );
  }, 60_000);

  it("lets the owner read their own resume", async () => {
    const { data, error } = await alice.client.from("resumes").select("id, title");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(aliceResumeId);
  });

  it("hides another user's resume from an unfiltered list", async () => {
    // The exact query the dashboard runs. It passes no `user_id`, so if this
    // returns anything the policy is the only thing that failed.
    const { data, error } = await bob.client.from("resumes").select("id, title");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("hides another user's resume even when its id is known", async () => {
    const { data, error } = await bob.client
      .from("resumes")
      .select("id")
      .eq("id", aliceResumeId)
      .maybeSingle();

    // Indistinguishable from a nonexistent row, which is the point: reporting
    // "exists but not yours" would confirm the id to whoever guessed it.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("refuses an anonymous read", async () => {
    const { data, error } = await anonClient().from("resumes").select("id");

    // Refused a layer earlier than RLS: the grants migration gives `anon` no
    // privilege on this table, so the policies never even run. A share link
    // reaches a resume through `get_public_resume()`, which is SECURITY DEFINER
    // and returns one published row — that is the only anonymous path in, and
    // it is why taking the table grant away costs nothing.
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("does not let another user update the row", async () => {
    const { data, error } = await bob.client
      .from("resumes")
      .update({ title: "Bob was here" })
      .eq("id", aliceResumeId)
      .select("id");

    // An UPDATE the policy filters out matches no rows; it is not an error.
    // Silence is why the follow-up read below is the real assertion.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const after = await alice.client
      .from("resumes")
      .select("title")
      .eq("id", aliceResumeId)
      .single();

    expect(after.data?.title).toBe("Alice private resume");
  });

  it("does not let another user delete the row", async () => {
    const { error } = await bob.client.from("resumes").delete().eq("id", aliceResumeId);

    expect(error).toBeNull();

    const after = await alice.client.from("resumes").select("id").eq("id", aliceResumeId);

    expect(after.data).toHaveLength(1);
  });

  it("does not let a user forge a row owned by someone else", async () => {
    const { error } = await bob.client
      .from("resumes")
      .insert({ user_id: alice.id, title: "planted" });

    // Unlike a filtered UPDATE, a WITH CHECK violation on INSERT is an error —
    // there is no row to silently skip.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("hides another user's profile", async () => {
    const { data, error } = await bob.client.from("profiles").select("id, email");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(bob.id);
    expect(data?.[0]?.email).not.toBe(alice.email);
  });

  it("silently refuses a self-promotion to admin", async () => {
    // RLS grants access per row, not per column, so Bob may legitimately update
    // his own profile — `protect_profile_privileges` is what stops that from
    // including `role`. It reverts rather than raising, because the client
    // round-trips whole rows.
    const { error } = await bob.client
      .from("profiles")
      .update({ role: "admin", ai_credits: 9999 })
      .eq("id", bob.id);

    expect(error).toBeNull();

    const after = await bob.client
      .from("profiles")
      .select("role, ai_credits")
      .eq("id", bob.id)
      .single();

    expect(after.data?.role).toBe("user");
    expect(after.data?.ai_credits).toBe(50);
  });

  it("scopes the dashboard stats function to the caller", async () => {
    // `get_dashboard_stats` is plain `stable sql`, not SECURITY DEFINER, so it
    // sees exactly the rows its caller sees. Bob owns nothing.
    const { data, error } = await bob.client.rpc("get_dashboard_stats");

    expect(error).toBeNull();
    expect(data).toMatchObject({ resumeCount: 0 });
  });
});
