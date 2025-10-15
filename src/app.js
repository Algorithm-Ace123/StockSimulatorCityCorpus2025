// Boot the app: load shell, init Supabase, attach router, and preload minimal session.
import './components/app-shell.js';
import { startRouter } from './router.js';
import { supabase } from './services/supabase.js';
import { store } from './store/index.js';

// Restore session and basic profile/role (extend when auth service lands)
async function initSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    // Optional: fetch role/profile from a public 'profiles' or 'users' table
    // For now, store minimal
    store.set('session', { user: session.user, role: session.user.user_metadata?.role || 'PLAYER' });
  } else {
    store.set('session', null);
  }
  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, sess) => {
    if (sess?.user) store.set('session', { user: sess.user, role: sess.user.user_metadata?.role || 'PLAYER' });
    else store.set('session', null);
  });
}

await initSession();
startRouter();
