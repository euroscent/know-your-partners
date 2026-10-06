import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeRequest {
  email: string;
  first_name: string;
  last_name: string;
  employment_type: string;
  password?: string;
  verified?: boolean;
  salutation?: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function findAuthUserByEmail(
  supabaseAdmin: any,
  email: string,
) {
  const targetEmail = normalizeEmail(email);
  const perPage = 200;

  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return { user: null, error };
    }

    const users = data?.users ?? [];
    const existingUser = users.find(
      (candidate: any) => normalizeEmail(candidate.email ?? "") === targetEmail,
    );

    if (existingUser) {
      return { user: existingUser, error: null };
    }

    if (users.length < perPage) {
      break;
    }
  }

  return { user: null, error: null };
}

async function finalizeEmployeeRecord({
  supabaseAdmin,
  userId,
  normalizedEmail,
  first_name,
  last_name,
  employment_type,
  verified,
  salutation,
}: {
  supabaseAdmin: any;
  userId: string;
  normalizedEmail: string;
  first_name: string;
  last_name: string;
  employment_type: string;
  verified?: boolean;
  salutation?: string;
}) {
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: userId,
      email: normalizedEmail,
      first_name,
      last_name,
      employment_type,
      verified: verified || false,
      salutation: salutation || null,
    }, { onConflict: "id" });

  if (profileError) {
    return {
      error: `Profil konnte nicht gespeichert werden: ${profileError.message}`,
    };
  }

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({
      user_id: userId,
      role: "employee",
    }, { onConflict: "user_id,role" });

  if (roleError) {
    return {
      error: `Rolle konnte nicht zugewiesen werden: ${roleError.message}`,
    };
  }

  return { error: null };
}

async function sendComplianceEmail(userId: string) {
  try {
    const complianceUrl = `${
      Deno.env.get("SUPABASE_URL")
    }/functions/v1/send-compliance-email`;
    await fetch(complianceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ userId }),
    });
    console.log("Compliance email + certificate sent for employee");
  } catch (e) {
    console.warn("Compliance email error (non-critical):", e);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Create client with user's token to verify they're an admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth
      .getUser();
    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (rolesError || !roles || roles.length === 0) {
      console.error("User is not admin:", rolesError);
      return new Response(
        JSON.stringify({ error: "Keine Administratorrechte" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const body: CreateEmployeeRequest = await req.json();
    const {
      email,
      first_name,
      last_name,
      employment_type,
      password,
      verified,
      salutation,
    } = body;
    const normalizedEmail = email ? normalizeEmail(email) : "";
    const safeLastName = (last_name && last_name.trim()) ? last_name.trim() : "-";

    console.log("Creating employee:", {
      email: normalizedEmail,
      first_name,
      last_name,
      employment_type,
      verified,
    });

    // Validate required fields (last_name darf leer sein, wird mit "-" gefüllt)
    if (!normalizedEmail || !first_name || !employment_type) {
      return new Response(
        JSON.stringify({ error: "Alle Felder sind erforderlich" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if email already exists using profiles table (efficient)
    const { data: existingProfiles, error: existingProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1);

    if (existingProfileError) {
      console.error("Error checking existing profile:", existingProfileError);
      return new Response(
        JSON.stringify({
          error: "Bestehende Mitarbeiter konnten nicht geprüft werden",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Diese E-Mail-Adresse ist bereits registriert",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Standard-Passwort für alle manuell erstellten Mitarbeiterkonten
    const finalPassword = password || "PxP-2026!";
    const userMetadata = {
      first_name,
      last_name: safeLastName,
      employment_type,
      created_by_admin: true,
      must_change_password: true,
      must_complete_onboarding: true,
    };

    let employeeUserId: string | null = null;
    let recoveredExistingUser = false;

    // Create the user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin
      .createUser({
        email: normalizedEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

    if (createError) {
      console.error("Error creating user:", createError);
      const isExistingEmail = createError.code === "email_exists";

      if (!isExistingEmail) {
        return new Response(
          JSON.stringify({
            error: `Fehler beim Erstellen: ${createError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { user: existingAuthUser, error: lookupError } =
        await findAuthUserByEmail(supabaseAdmin, normalizedEmail);

      if (lookupError) {
        console.error("Error looking up existing auth user:", lookupError);
        return new Response(
          JSON.stringify({
            error:
              "Diese E-Mail-Adresse hat bereits ein Login, konnte aber nicht automatisch übernommen werden",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!existingAuthUser) {
        return new Response(
          JSON.stringify({
            error:
              "Diese E-Mail-Adresse hat bereits ein Login und kann nicht erneut angelegt werden",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error: updateUserError } = await supabaseAdmin.auth.admin
        .updateUserById(existingAuthUser.id, {
          password: finalPassword,
          email_confirm: true,
          user_metadata: {
            ...(existingAuthUser.user_metadata ?? {}),
            ...userMetadata,
          },
        });

      if (updateUserError) {
        console.error("Error updating existing auth user:", updateUserError);
        return new Response(
          JSON.stringify({
            error:
              `Bestehendes Login konnte nicht übernommen werden: ${updateUserError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      employeeUserId = existingAuthUser.id;
      recoveredExistingUser = true;
      console.log("Recovered existing auth user:", employeeUserId);
    } else {
      employeeUserId = newUser?.user?.id ?? null;
      console.log("User created successfully:", employeeUserId);
    }

    if (!employeeUserId) {
      return new Response(
        JSON.stringify({
          error: "Mitarbeiterkonto konnte nicht erstellt werden",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const finalizeResult = await finalizeEmployeeRecord({
      supabaseAdmin,
      userId: employeeUserId,
      normalizedEmail,
      first_name,
      last_name: safeLastName,
      employment_type,
      verified,
      salutation,
    });

    if (finalizeResult.error) {
      console.error("Error finalizing employee record:", finalizeResult.error);

      if (!recoveredExistingUser) {
        const { error: rollbackError } = await supabaseAdmin.auth.admin
          .deleteUser(employeeUserId);
        if (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
      }

      return new Response(
        JSON.stringify({ error: finalizeResult.error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await sendComplianceEmail(employeeUserId);

    console.log("Employee created successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: recoveredExistingUser
          ? "Bestehendes Login wurde als Mitarbeiterkonto übernommen"
          : "Mitarbeiter wurde erstellt",
        user_id: employeeUserId,
        generated_password: finalPassword,
        recovered_existing_user: recoveredExistingUser,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Ein unerwarteter Fehler ist aufgetreten" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
