import { supabase } from './supabase.js';

export const tradingService = {
  async buy(userId, symbol, qty) {
    const { data, error } = await supabase.rpc('buy_simple', {
      p_user_id: userId, p_symbol: symbol, p_qty: qty
    });
    if (error) throw error;
    return data;
  },
  async sell(userId, symbol, qty) {
    const { data, error } = await supabase.rpc('sell_simple', {
      p_user_id: userId, p_symbol: symbol, p_qty: qty
    });
    if (error) throw error;
    return data;
  },
  async kpis(userId) {
    const { data, error } = await supabase
      .from('v_user_kpis')
      .select('available_cash, invested_money, equity')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data || { available_cash: 0, invested_money: 0, equity: 0 };
  },
  async portfolio(userId) {
    const { data, error } = await supabase
      .from('v_portfolio')
      .select('symbol, qty, avg_price, invested_amount, current_price, current_value, pnl_value, pnl_pct')
      .eq('user_id', userId)
      .order('symbol');
    if (error) throw error;
    return data || [];
  }
};
