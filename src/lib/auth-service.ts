// Supabase-backed auth helpers.

import { supabase } from "./supabase";

/**
 * 1. Unified Login Handler
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * 2. Unified Logout Handler
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);

  // Clear any persistent browser indicators to guarantee complete context drops
  localStorage.clear();
  sessionStorage.clear();
}

/**
 * 3. Check Setup Requirements Flag
 * Inspects the metadata of the authenticated user to verify if they are still 
 * on an administrative temporary password configuration.
 */
export async function checkIfPasswordChangeRequired(): Promise<{ mustChange: boolean; reason?: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { mustChange: false, reason: "No active user session found." };
  }

  // Evaluates the exact metadata token assigned during administrative creation
  const mustChange = user.user_metadata?.must_change_password === true;

  return { mustChange };
}

/**
 * 4. Active Session Broadcast Listener
 */
export function onAuthChange(callback: (user: import("@supabase/supabase-js").User | null) => void) {
  supabase.auth.getUser().then(({ data }) => callback(data.user ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

/**
 * 5. User Creation & Password Management Layers
 */
export async function createFirebaseAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user?.id) throw new Error("Supabase did not return a user id");
  return data.user.id;
}

export async function sendResetPasswordEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<{ status: "success" | "error"; message?: string }> {

  // Step 1: Match Confirmation
  if (newPassword !== confirmNewPassword) {
    return { status: "error", message: "New passwords do not match." };
  }

  // Step 2: Complexity Check (Min 8 chars, 1 Uppercase, 1 Lowercase, 1 Number, 1 Special Char)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return { status: "error", message: "Password does not meet complexity requirements." };
  }

  // Fetch the active authenticated user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "error", message: "User session not found." };
  }

  // Step 3: Identity Check
  const emailPrefix = user.email ? user.email.split('@')[0].toLowerCase() : "";
  const firstName = user.user_metadata?.first_name ? user.user_metadata.first_name.toLowerCase() : "";
  const lastName = user.user_metadata?.last_name ? user.user_metadata.last_name.toLowerCase() : "";
  const lowerNewPassword = newPassword.toLowerCase();

  if (
    (emailPrefix && lowerNewPassword.includes(emailPrefix)) ||
    (firstName && lowerNewPassword.includes(firstName)) ||
    (lastName && lowerNewPassword.includes(lastName))
  ) {
    return { status: "error", message: "Password cannot contain personal identifiers like your name or email." };
  }

  // Step 4: Uniqueness Check
  if (newPassword === currentPassword) {
    return { status: "error", message: "New password must be different from your current password." };
  }

  // Step 5: Authenticity Check (Re-verify credentials against native DB hash before update)
  const { error: loginCheckError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (loginCheckError) {
    return { status: "error", message: "Incorrect current password." };
  }

  // Execution Layer: Commits updated password structure and resets the restriction token
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false }
  });

  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  return { status: "success" };
}