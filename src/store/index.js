// Tiny pub/sub store for session, prices, selections, etc.
const state = new Map();
const subs = new Map();



function notify(key) {
  const val = state.get(key);
  (subs.get(key) || []).forEach(cb => cb(val));
}

export const store = {
  get(key) { return state.get(key); },
  set(key, value) { state.set(key, value); notify(key); },
  update(key, fn) { const v = fn(state.get(key)); state.set(key, v); notify(key); },
  subscribe(key, cb) {
    const set = subs.get(key) || new Set();
    set.add(cb); subs.set(key, set);
    return () => { set.delete(cb); };
  }
};

// Defaults
state.set('session', null);           // { user, role, profile }
state.set('prices', new Map());       // symbol -> { symbol, name, price, updated_at }
state.set('selectedSymbol', null);    // for detail chart
state.set('portfolio', []);           // { symbol, qty, avg_price }
state.set('orders', []);              // recent orders
state.set('toasts', []);              // notifications
