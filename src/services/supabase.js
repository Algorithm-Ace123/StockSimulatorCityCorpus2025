import { ENV } from '../config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// Simple wrapper for live table changes
export function subscribeTable(table, onChange) {
  return supabase
    .channel(`realtime:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      onChange?.(payload);
    })
    .subscribe();
}
