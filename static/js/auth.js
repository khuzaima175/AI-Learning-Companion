// static/js/auth.js
// Handles all Supabase Auth on the frontend

const SUPABASE_URL  = 'https://xscguybkkdgaopoawuge.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzY2d1eWJra2RnYW9wb2F3dWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjM5MzYsImV4cCI6MjA5MDY5OTkzNn0.MNkOSEk7-Atiri1YgUuWdL_I37aLTn_aItVlT6aNWB4';

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
    window.location.reload();
}

// ── Auth state listener ────────────────────────────────────
export function onAuthChange(callback) {
    sb.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
