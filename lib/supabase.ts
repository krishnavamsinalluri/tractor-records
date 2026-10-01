import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
const productionSiteUrl = "https://tractor-records-xi.vercel.app";

function validOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function getPasswordRecoveryRedirectUrl(): string {
  const runtimeOrigin = typeof window === "undefined" ? null : validOrigin(window.location.origin);
  const configuredOrigin = validOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  // Local development should return to the current local server. On a deployed
  // build, ignore a stale localhost environment value and use a public origin.
  const redirectOrigin = runtimeOrigin && isLocalOrigin(runtimeOrigin)
    ? runtimeOrigin
    : configuredOrigin && !isLocalOrigin(configuredOrigin)
      ? configuredOrigin
      : runtimeOrigin ?? productionSiteUrl;

  return new URL("/reset-password", `${redirectOrigin}/`).toString();
}

export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase configuration is missing.");
    }

    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
  }

  return browserClient;
}
