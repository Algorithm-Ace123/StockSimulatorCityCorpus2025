import { supabase } from './supabase.js';
import { getPricesChannel } from './realtime.js';

function rowToStock(r) {
  return {
    symbol: r.symbol,
    name: r.name,
    price: Number(r.price),
    halted: !!r.halted,
    trajectory: r.trajectory || 'NEUTRAL',
    updated_at: r.updated_at || r.updatedAt || new Date().toISOString(),
  };
}

export const stocksService = {
  async listStocks() {
    const { data, error } = await supabase
      .from('stocks')
      .select('symbol,name,price,halted,trajectory,updated_at')
      .order('symbol', { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToStock);
  },

  /** Subscribe to broadcast ticks. opts.self=true in Admin to receive own emits. */
  subscribePrices(onRow, { self = false } = {}) {
    const channel = getPricesChannel(self);

    const handler = ({ payload }) => {
      (Array.isArray(payload) ? payload : [payload]).forEach((p) => {
        onRow({
          symbol: p.symbol,
          name: p.name,
          price: Number(p.price),
          halted: !!p.halted,
          trajectory: p.trajectory || 'NEUTRAL',
          updated_at: p.updated_at || new Date().toISOString(),
        });
      });
    };

    channel.on('broadcast', { event: 'tick' }, handler);

    // Safety net: light polling every 5s
    const poll = setInterval(async () => {
      try { (await this.listStocks()).forEach(onRow); } catch {}
    }, 5000);

    return () => {
      channel.off('broadcast', handler);
      clearInterval(poll);
    };
  },
};
