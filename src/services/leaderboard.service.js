import { supabase } from './supabase.js';
export const leaderboardService = {
  async getTop(limit = 50) {
    const { data, error } = await supabase
      .from('v_leaderboard_simple')
      .select('user_id, display, equity')
      .order('equity', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
};
