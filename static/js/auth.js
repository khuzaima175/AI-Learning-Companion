// static/js/auth.js
// Handles all Supabase Auth on the frontend

// Fetch Supabase configuration dynamically from the backend at boot
let SUPABASE_URL = '';
let SUPABASE_ANON = '';

try {
    const configResp = await fetch('/api/supabase-config');
    const config = await configResp.json();
    SUPABASE_URL = config.supabase_url;
    SUPABASE_ANON = config.supabase_anon;
} catch (e) {
    console.error("Failed to load Supabase config from server:", e);
}

// Supabase JS client (loaded from CDN in index.html)
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Get current session token ──────────────────────────────
export async function getToken() {
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
}

// ── Get current user ───────────────────────────────────────
export async function getUser() {
    const { data } = await sb.auth.getUser();
    return data?.user || null;
}

// ── Get current session (faster/synchronous boot check) ──────
export async function getSession() {
    const { data } = await sb.auth.getSession();
    return data?.session || null;
}

// ── Sign up ────────────────────────────────────────────────
export async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return data;
}

// ── Sign in ────────────────────────────────────────────────
export async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
}

// ── Sign out ───────────────────────────────────────────────
export async function signOut() {
    await sb.auth.signOut();
    // Clear all cached data so next user starts fresh
    Object.keys(localStorage)
        .filter(k => k.startsWith('alc_'))
        .forEach(k => localStorage.removeItem(k));
    window.location.reload();
}

// ── Auth state listener ────────────────────────────────────
export function onAuthChange(callback) {
    sb.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
