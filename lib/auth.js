import { supabase } from "./supabaseClient";

// Everyone gets a quiet, invisible account the first time they open the app.
// No email, no password. It lives in this browser.
let pending = null;

export function ensureSession() {
  if (!pending) {
    pending = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data && data.session) return data.session.user;
      const { data: made, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return made.user;
    })().catch((e) => {
      pending = null;
      throw e;
    });
  }
  return pending;
}

export function friendlyError(e) {
  const msg = (e && e.message) || "";
  if (/anonymous/i.test(msg)) {
    return "Anonymous sign-ins are switched off in Supabase. Turn them on under Authentication > Sign In / Providers.";
  }
  return "Couldn't connect. Check your internet and reload.";
}
