// static/js/auth.js
// Handles all Supabase Auth on the frontend

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

const { createClient } = supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

let _currentSession = null;
let _currentUser = null;

try {
    const { data } = await sb.auth.getSession();
    _currentSession = data?.session || null;
    _currentUser = _currentSession?.user || null;
} catch (e) {
    console.error("Session load error:", e);
}

sb.auth.onAuthStateChange((event, session) => {
    _currentSession = session || null;
    _currentUser = session?.user || null;
});

// ── Get current user (synchronous) ─────────────────────────
export function getUser() {
    return _currentUser;
}

// ── Get current session ────────────────────────────────────
export function getSession() {
    return _currentSession;
}

// ── Get current session token ──────────────────────────────
export function getToken() {
    return _currentSession?.access_token || null;
}

// ── Sign up ────────────────────────────────────────────────
export async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    _currentSession = data?.session || null;
    _currentUser = data?.user || null;
    return data;
}

// ── Sign in ────────────────────────────────────────────────
export async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    _currentSession = data?.session || null;
    _currentUser = data?.user || null;
    window.location.hash = 'today';
    window.location.reload();
    return data;
}

// ── Sign out ───────────────────────────────────────────────
export async function signOut() {
    await sb.auth.signOut();
    _currentSession = null;
    _currentUser = null;
    Object.keys(localStorage)
        .filter(k => k.startsWith('alc_'))
        .forEach(k => localStorage.removeItem(k));
    window.location.hash = 'login';
    window.location.reload();
}

// ── Auth state listener ────────────────────────────────────
export function onAuthChange(callback) {
    sb.auth.onAuthStateChange((event, session) => {
        _currentSession = session || null;
        _currentUser = session?.user || null;
        callback(event, session);
    });
}
