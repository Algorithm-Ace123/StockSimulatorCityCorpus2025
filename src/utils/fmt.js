import { ENV } from '../config.js';

export const fmt = {
  money(n) { return `${ENV.UI.CURRENCY}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; },
  num(n, d=2) { return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: d }); },
  pct(n, d=2) { return `${(Number(n)*100).toFixed(d)}%`; },
  sign(n) { const x = Number(n||0); return (x>0?'+':'') + x.toFixed(2); }
};
