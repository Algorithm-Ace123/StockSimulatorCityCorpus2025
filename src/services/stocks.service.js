import { supabase } from './supabase.js';
import { getPricesChannel } from './realtime.js';

function rowToStock(r) {
  return {
    symbol: r.symbol,
    name: r.name,
    price: Number(r.price),
    updated_at: r.updated_at || r.updatedAt || new Date().toISOString(),
    halted: !!r.halted,
  };
}

export const stocksService = {
  async listStocks() {
    const { data, error } = await supabase
      .from('stocks')
      .select('symbol,name,price,halted,updated_at')
      .order('symbol', { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToStock);
  },

  /**
   * Subscribe to ticks over the "prices" broadcast channel.
   * @param {(row)=>void} onRow
   * @param {{ self?: boolean }} opts - pass { self:true } in Admin to receive your own broadcasts
   */
  subscribePrices(onRow, { self = false } = {}) {
    const channel = getPricesChannel(self);

    const handler = ({ payload }) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      rows.forEach((p) => onRow({
        symbol: p.symbol,
        name: p.name,
        price: Number(p.price),
        halted: !!p.halted,
        updated_at: p.updated_at || new Date().toISOString(),
      }));
    };

    channel.on('broadcast', { event: 'tick' }, handler);

    // Fallback polling every 5s to self-heal if any broadcast is missed
    const poll = setInterval(async () => {
      try { (await this.listStocks()).forEach(onRow); } catch {}
    }, 5000);

    // Return unsubscribe
    return () => {
      channel.off('broadcast', handler);
      clearInterval(poll);
    };
  },
};
