import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SteadDatabase } from "./syncTypes";

export type SupabaseConfig = {
  url?: string;
  key?: string;
};

export function isSupabaseConfigured(config = readSupabaseConfig()) {
  return Boolean(config.url && config.key);
}

export function createSteadSupabaseClient(
  config = readSupabaseConfig(),
): SupabaseClient<SteadDatabase> | null {
  if (!isSupabaseConfigured(config)) {
    return null;
  }

  return createClient<SteadDatabase>(config.url!, config.key!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = createSteadSupabaseClient();

function readSupabaseConfig(): SupabaseConfig {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  };
}
