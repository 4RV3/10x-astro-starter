import type { AuthUserDTO, LoginResponseDTO, RegisterResponseDTO, SessionDTO } from "../../types.ts";
import { registerCommandSchema, loginCommandSchema } from "../validation/auth.schema.ts";
import { supabaseClient } from "../../db/supabase.client.ts";

type SupabaseClient = typeof supabaseClient;

function mapSession(session: any): SessionDTO {
  return {
    access_token: session?.access_token ?? "",
    expires_at: session?.expires_at ?? 0,
  };
}

export async function register(supabase: SupabaseClient, body: unknown): Promise<RegisterResponseDTO> {
  const parsed = registerCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: "INVALID_BODY", message: parsed.error.issues[0]?.message || "Invalid request body" };
  }
  const { email, password, username } = parsed.data;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError || !signUpData.user) {
    throw { status: 500, error: "AUTH_SIGNUP_FAILED", message: signUpError?.message || "Sign up failed" };
  }

  const user: AuthUserDTO = { id: signUpData.user.id, email: signUpData.user.email! };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, username })
    .select("id, username, created_at, updated_at")
    .single();

  if (insertError) {
    // Unique violation
    if ((insertError as any).code === "23505") {
      throw { status: 409, error: "USERNAME_CONFLICT", message: "Username already taken" };
    }
    throw { status: 500, error: "PROFILE_CREATE_FAILED", message: insertError.message };
  }

  return {
    user,
    profile: inserted as any,
    session: mapSession(signUpData.session),
  };
}

export async function login(supabase: SupabaseClient, body: unknown): Promise<LoginResponseDTO> {
  const parsed = loginCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: "INVALID_BODY", message: parsed.error.issues[0]?.message || "Invalid request body" };
  }
  const { username, password } = parsed.data;

  // Username lookup must bypass RLS (user is not authenticated yet)
  const serviceKey = import.meta.env.PROD ? process.env.SUPABASE_SERVICE_ROLE_KEY : (import.meta as any).env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw {
      status: 500,
      error: "SERVICE_ROLE_MISSING",
      message: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY to resolve username → email.",
    };
  }

  const { adminSupabaseClient } = await import("../../db/supabase.client.ts");

  const { data: profile, error: profileError } = await adminSupabaseClient
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .single();

  if (profileError || !profile) {
    throw { status: 401, error: "INVALID_CREDENTIALS", message: "Invalid username or password" };
  }

  const { data: userAdmin, error: adminError } = await adminSupabaseClient.auth.admin.getUserById(profile.id);
  if (adminError) {
    // This typically indicates missing/invalid service role key configuration.
    throw {
      status: 500,
      error: "AUTH_ADMIN_LOOKUP_FAILED",
      message: `Admin lookup failed. Verify SUPABASE_SERVICE_ROLE_KEY (service role / secret key). Details: ${adminError.message}`,
    };
  }
  if (!userAdmin?.user?.email) {
    throw { status: 401, error: "INVALID_CREDENTIALS", message: "Invalid username or password" };
  }

  const email = userAdmin.user.email as string;
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.session || !signInData.user) {
    throw { status: 401, error: "INVALID_CREDENTIALS", message: "Invalid username or password" };
  }

  const user: AuthUserDTO = { id: signInData.user.id, email: signInData.user.email! };

  return {
    user,
    profile: { id: profile.id, username: profile.username },
    session: mapSession(signInData.session),
  };
}

export async function logout(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw { status: 401, error: "UNAUTHORIZED", message: "Invalid or expired session" };
  }
}

export async function me(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw { status: 401, error: "UNAUTHORIZED", message: "Authentication required" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, created_at, updated_at")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    throw { status: 404, error: "PROFILE_NOT_FOUND", message: "Profile not found" };
  }

  return {
    user: { id: userData.user.id, email: userData.user.email! },
    profile,
  };
}
