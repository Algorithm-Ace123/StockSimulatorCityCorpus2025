import { supabase } from './supabase.js';
import { store } from '../store/index.js';

export const auth = {
  async signUp(email, password, display = '') {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { display, role: 'PLAYER' } }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
    store.set('session', null);
    location.hash = '#/login';
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuth(cb) {
    return supabase.auth.onAuthStateChange((_event, session) => cb(session));
  }
};
