import * as AppleAuthentication from "expo-apple-authentication";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { SteadDatabase } from "./syncTypes";

export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthState =
  | {
      status: "signedOut";
    }
  | {
      status: "signedIn";
      user: AuthUser;
    };

export type AppleAuthAdapter = {
  isAvailableAsync: () => Promise<boolean>;
  signInAsync: (options: {
    requestedScopes: AppleAuthentication.AppleAuthenticationScope[];
  }) => Promise<{
    identityToken: string | null;
    user: string;
    email: string | null;
  }>;
};

export type SupabaseAuthAdapter = Pick<
  SupabaseClient<SteadDatabase>["auth"],
  "getUser" | "signInWithIdToken" | "signOut"
>;

export async function getAuthState(
  auth: SupabaseAuthAdapter | null = supabase?.auth ?? null,
): Promise<AuthState> {
  if (!auth) {
    return { status: "signedOut" };
  }

  const { data } = await auth.getUser();
  const user = data.user;

  if (!user) {
    return { status: "signedOut" };
  }

  return {
    status: "signedIn",
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

export async function signInWithApple({
  apple = AppleAuthentication,
  auth = supabase?.auth ?? null,
}: {
  apple?: AppleAuthAdapter;
  auth?: SupabaseAuthAdapter | null;
} = {}): Promise<AuthState> {
  if (!auth) {
    throw new Error("supabase is not configured");
  }

  const available = await apple.isAvailableAsync();

  if (!available) {
    throw new Error("sign in with apple is not available");
  }

  const credential = await apple.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("apple did not return an identity token");
  }

  const { data, error } = await auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    return { status: "signedOut" };
  }

  return {
    status: "signedIn",
    user: {
      id: data.user.id,
      email: data.user.email ?? credential.email ?? undefined,
    },
  };
}

export async function signOut(
  auth: SupabaseAuthAdapter | null = supabase?.auth ?? null,
) {
  if (!auth) {
    return;
  }

  const { error } = await auth.signOut();

  if (error) {
    throw error;
  }
}
