import { supabase } from './supabase.js';

export const ordersService = {
  async placeMarket(userId, symbol, side, qty) {
    const { data, error } = await supabase.from('orders').insert({
      user_id: userId, symbol, side, type: 'MARKET', qty, status: 'OPEN'
    }).select().single();
    if (error) throw error;
    return data;
  },

  async placeLimit(userId, symbol, side, qty, limitPrice) {
    const { data, error } = await supabase.from('orders').insert({
      user_id: userId, symbol, side, type: 'LIMIT', qty, limit_price: limitPrice, status: 'OPEN'
    }).select().single();
    if (error) throw error;
    return data;
  },

  async myPositions(userId) {
    const { data, error } = await supabase
      .from('positions')
      .select('symbol, qty, avg_price')
      .eq('user_id', userId)
      .order('symbol');
    if (error) throw error;
    return data || [];
  },

  async myOrders(userId, limit = 50) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, symbol, side, type, qty, limit_price, status, fill_price')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
};
