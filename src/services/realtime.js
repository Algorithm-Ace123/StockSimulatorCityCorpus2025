import { supabase } from './supabase.js';

let pricesChannel = null;

/** Get a singleton "prices" broadcast channel. */
export function getPricesChannel(self = false) {
  if (!pricesChannel) {
    pricesChannel = supabase.channel('prices', {
      config: { broadcast: { self, ack: true } },
    });
    pricesChannel.subscribe((status) =>
      console.log('[prices channel]', status, `(self=${self})`)
    );
  } else {
    // If we now need self=true and it was false, rejoin to receive own broadcasts.
    const currentSelf = pricesChannel.params?.config?.broadcast?.self ?? false;
    if (self && !currentSelf) {
      supabase.removeChannel(pricesChannel);
      pricesChannel = supabase.channel('prices', {
        config: { broadcast: { self: true, ack: true } },
      });
      pricesChannel.subscribe((status) =>
        console.log('[prices channel]', status, '(rejoined self=true)')
      );
    }
  }
  return pricesChannel;
}
