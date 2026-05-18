jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));

import {
  getAuthState,
  signInWithApple,
  signOut,
  type AppleAuthAdapter,
  type SupabaseAuthAdapter,
} from "./auth";

function createAuth(
  overrides: Partial<Record<keyof SupabaseAuthAdapter, unknown>> = {},
) {
  return {
    getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
    signInWithIdToken: jest.fn(async () => ({
      data: { user: { id: "user-1", email: "arya@example.com" } },
      error: null,
    })),
    signOut: jest.fn(async () => ({ error: null })),
    ...overrides,
  } as unknown as SupabaseAuthAdapter;
}

function createApple(overrides: Partial<AppleAuthAdapter> = {}) {
  return {
    isAvailableAsync: jest.fn(async () => true),
    signInAsync: jest.fn(async () => ({
      identityToken: "apple-token",
      user: "apple-user",
      email: "arya@example.com",
    })),
    ...overrides,
  } as AppleAuthAdapter;
}

describe("auth service", () => {
  it("returns signed out when Supabase is missing", async () => {
    await expect(getAuthState(null)).resolves.toEqual({ status: "signedOut" });
  });

  it("returns the current signed in user", async () => {
    const auth = createAuth({
      getUser: jest.fn(async () => ({
        data: { user: { id: "user-1", email: "arya@example.com" } },
        error: null,
      })),
    });

    await expect(getAuthState(auth)).resolves.toEqual({
      status: "signedIn",
      user: { id: "user-1", email: "arya@example.com" },
    });
  });

  it("signs in with an Apple identity token", async () => {
    const apple = createApple();
    const auth = createAuth();

    await expect(signInWithApple({ apple, auth })).resolves.toEqual({
      status: "signedIn",
      user: { id: "user-1", email: "arya@example.com" },
    });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-token",
    });
  });

  it("fails when Apple does not return an identity token", async () => {
    await expect(
      signInWithApple({
        apple: createApple({
          signInAsync: jest.fn(async () => ({
            identityToken: null,
            user: "apple-user",
            email: null,
          })),
        }),
        auth: createAuth(),
      }),
    ).rejects.toThrow("apple did not return an identity token");
  });

  it("signs out through Supabase when configured", async () => {
    const auth = createAuth();

    await signOut(auth);

    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
