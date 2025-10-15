import { supabase } from './supabase.js';

// singleton broadcast channel
let adminPricesChannel;
function getAdminChannel() {
  if (!adminPricesChannel) {
    adminPricesChannel = supabase.channel('prices', {
      config: { broadcast: { self: true, ack: true } }, // self true so admin also sees immediate UI change
    });
    adminPricesChannel.subscribe((status) => console.log('[admin prices channel]', status));
  }
  return adminPricesChannel;
}

export const adminService = {
  async nudgePercent(symbol, percent) {
    const { data, error } = await supabase.rpc('nudge_price', {
      p_symbol: symbol,
      p_percent: percent
    });
    if (error) throw error;

    // broadcast the single updated symbol
    const ch = getAdminChannel();
    await ch.send({
      type: 'broadcast',
      event: 'tick',
      payload: [{ symbol: data.symbol, name: data.name, price: Number(data.price), halted: data.halted }],
    });

    return data;
  },

  async setHalted(symbol, halted) {
    const { data, error } = await supabase
      .from('stocks')
      .update({ halted: !!halted })
      .eq('symbol', symbol)
      .select('symbol, name, price, halted')
      .single();
    if (error) throw error;

    // also broadcast halt/resume so UIs update badge immediately
    const ch = getAdminChannel();
    await ch.send({
      type: 'broadcast',
      event: 'tick',
      payload: [{ symbol: data.symbol, name: data.name, price: Number(data.price), halted: data.halted }],
    });

    return data;
  },

  async upsertStock({ symbol, name, price, drift = 0, vol = 0.02 }) {
    const { data, error } = await supabase
      .from('stocks')
      .upsert({ symbol, name, price, drift, vol, halted: false })
      .select()
      .single();
    if (error) throw error;

    // broadcast new/edited stock too
    const ch = getAdminChannel();
    await ch.send({
      type: 'broadcast',
      event: 'tick',
      payload: [{ symbol: data.symbol, name: data.name, price: Number(data.price), halted: data.halted }],
    });

    return data;
  },
};
