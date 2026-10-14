import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// EXPO_PUBLIC_* vars are inlined at build time by Metro — safe to ship in the
// app bundle. Never put the Supabase secret/service_role key here.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase config — set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE delivers the password-recovery deep link as a plain `?code=`
    // query param instead of a URL fragment (`#access_token=...`) — the
    // fragment form is painful to parse reliably from React Native's
    // Linking API, so PKCE is the flow Supabase recommends for mobile.
    flowType: "pkce",
  },
});
