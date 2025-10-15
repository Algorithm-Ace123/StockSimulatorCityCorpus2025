import { supabase } from './supabase.js';

let pricesChannel = null;

/**
 * Get a singleton "prices" channel.
 * @param {boolean} self - whether this tab should receive its own broadcasts
 */
export function getPricesChannel(self = false) {
  if (!pricesChannel) {
    pricesChannel = supabase.channel('prices', {
      config: { broadcast: { self, ack: true } },
    });
    pricesChannel.subscribe((status) => console.log('[prices channel]', status));
  } else {
    // If existing channel was created with self=false and now you need self=true (admin),
    // rejoin with self=true to ensure you receive your own broadcasts.
    const currentSelf = pricesChannel.params?.config?.broadcast?.self ?? false;
    if (self && !currentSelf) {
      supabase.removeChannel(pricesChannel);
      pricesChannel = supabase.channel('prices', {
        config: { broadcast: { self: true, ack: true } },
      });
      pricesChannel.subscribe((status) => console.log('[prices channel]', status, '(rejoined self=true)'));
    }
  }
  return pricesChannel;
}
