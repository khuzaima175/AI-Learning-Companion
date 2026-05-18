// static/js/auth.js
// Handles all Supabase Auth on the frontend

// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL  = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';

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
