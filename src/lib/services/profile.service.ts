import type { ProfileDTO } from "../../types.ts";
import { updateProfileCommandSchema } from "../validation/profiles.schema.ts";
import { supabaseClient } from "../../db/supabase.client.ts";

type SupabaseClient = typeof supabaseClient;

export async function getMyProfile(supabase: SupabaseClient): Promise<ProfileDTO> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw { status: 401, error: "UNAUTHORIZED", message: "Authentication required" };
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, created_at, updated_at")
    .eq("id", userData.user.id)
    .single();
  if (error || !profile) {
    throw { status: 404, error: "PROFILE_NOT_FOUND", message: "Profile not found" };
  }
  return profile as any;
}

export async function updateMyProfile(supabase: SupabaseClient, body: unknown): Promise<ProfileDTO> {
  const parsed = updateProfileCommandSchema.safeParse(body);
  if (!parsed.success) {
    throw { status: 400, error: "INVALID_BODY", message: parsed.error.issues[0]?.message || "Invalid request body" };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw { status: 401, error: "UNAUTHORIZED", message: "Authentication required" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ username: parsed.data.username })
    .eq("id", userData.user.id)
    .select("id, username, created_at, updated_at")
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      throw { status: 409, error: "USERNAME_CONFLICT", message: "Username already taken" };
    }
    throw { status: 500, error: "PROFILE_UPDATE_FAILED", message: error.message };
  }

  return data as any;
}
