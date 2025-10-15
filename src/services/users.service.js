// User utilities: lookup by email, add cash (RPC), list top (via view)
// Requires the SQL (view v_leaderboard and RPC add_cash) to be applied.
import { supabase } from './supabase.js';

export const usersService = {
  /** Find app user row by email (public.users), not auth.users */
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display, role, cash')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  /**
   * Add/subtract cash using RPC public.add_cash(p_user_id, p_delta)
   * delta can be negative to subtract.
   */
  async addCash(userId, delta) {
    const { data, error } = await supabase.rpc('add_cash', {
      p_user_id: userId,
      p_delta: delta
    });
    if (error) throw error;
    return data; // updated users row
  },

  /** Read leaderboard via view public.v_leaderboard */
  async listTop(limit = 50) {
    const { data, error } = await supabase
      .from('v_leaderboard')
      .select('user_id, display, equity')
      .order('equity', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
};
