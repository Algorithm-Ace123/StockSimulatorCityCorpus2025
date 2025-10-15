// src/views/admin.view.js
import { stocksService } from '../services/stocks.service.js';
import { adminService } from '../services/admin.service.js';
import { usersService } from '../services/users.service.js';
import { toast } from '../components/toast.js';
import { supabase } from '../services/supabase.js';
import { getPricesChannel } from '../services/realtime.js';

/* ---------- Small helpers ---------- */
function gaussian(mean = 0, std = 1) {
  let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- One shared broadcast channel (self:true for admin) ---------- */
const priceChannel = getPricesChannel(true);

/* ---------- Engine tick (updates DB + broadcasts once) ---------- */
async function runEngineTick() {
  const { data: stocks, error } = await supabase
    .from('stocks')
    .select('symbol,price,drift,vol,halted,name');
  if (error) { console.error('[engine] load', error); return; }

  const updates = [];
  for (const s of (stocks || [])) {
    if (s.halted) continue;
    let next = Number(s.price) * (1 + Number(s.drift || 0) + gaussian(0, Number(s.vol || 0.02)));
    next = Math.max(1, round2(next));
    const { error: upErr } = await supabase
      .from('stocks')
      .update({ price: next, updated_at: new Date().toISOString() })
      .eq('symbol', s.symbol);
    if (upErr) { console.error('[engine] update', s.symbol, upErr.message); continue; }
    updates.push({ symbol: s.symbol, name: s.name, price: next, halted: false });
  }

  if (updates.length) {
    await priceChannel.send({ type: 'broadcast', event: 'tick', payload: updates });
  }
}

/* ---------- View ---------- */
export default function AdminView(root) {
  root.innerHTML = `
    <div class="grid grid-2">
      <section class="card">
        <div class="card-header"><h2>Controls</h2></div>
        <div class="card-body grid" style="grid-template-columns: 1fr 1fr; gap: .9rem;">

          <div class="card p-3" style="border-radius:12px;">
            <h3>Nudge Price</h3>
            <div class="small">Apply a +/- percentage to a symbol on next update.</div>
            <div class="mt-3 grid" style="grid-template-columns: 1fr 1fr 1fr; gap:.6rem;">
              <input id="sym" placeholder="SYM e.g. ABX" />
              <input id="pct" type="number" step="0.01" placeholder="0.05 = +5%" />
              <button id="nudge" class="btn btn--accent">Apply</button>
            </div>
          </div>

          <div class="card p-3" style="border-radius:12px;">
            <h3>Halt / Resume</h3>
            <div class="small">Block trading & price updates for a symbol.</div>
            <div class="mt-3 grid" style="grid-template-columns: 1fr 1fr 1fr; gap:.6rem;">
              <input id="symH" placeholder="SYM" />
              <select id="halted"><option value="true">Halt</option><option value="false">Resume</option></select>
              <button id="halt" class="btn">Update</button>
            </div>
          </div>

          <div class="card p-3" style="border-radius:12px; grid-column: span 2;">
            <h3>Allocate Cash</h3>
            <div class="small">Find by email, then add/subtract cash (₹).</div>
            <div class="mt-3 grid" style="grid-template-columns: 2fr 1fr 1fr; gap:.6rem;">
              <input id="email" type="email" placeholder="player@example.com" />
              <input id="delta" type="number" step="1" placeholder="Amount (e.g. 5000)" />
              <button id="cash" class="btn">Apply</button>
            </div>
            <div id="cashResult" class="small mt-2"></div>
          </div>

          <div class="card p-3" style="border-radius:12px;">
            <h3>Price Engine</h3>
            <div class="small">Runs in this browser tab. Keep it open during the fest.</div>
            <div class="mt-3 flex">
              <button id="startEngine" class="btn btn--accent">Start</button>
              <button id="stopEngine" class="btn btn--danger">Stop</button>
              <span id="engStatus" class="small"></span>
            </div>
          </div>

        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2>Stocks</h2></div>
        <div class="card-body">
          <table class="table" id="tbl">
            <thead><tr><th>Symbol</th><th>Name</th><th>Price</th><th>Halted</th><th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  const tbody = root.querySelector('#tbl tbody');
  const sym = root.querySelector('#sym');
  const pct = root.querySelector('#pct');
  const nudgeBtn = root.querySelector('#nudge');

  const symH = root.querySelector('#symH');
  const selH = root.querySelector('#halted');
  const haltBtn = root.querySelector('#halt');

  const email = root.querySelector('#email');
  const delta = root.querySelector('#delta');
  const cashBtn = root.querySelector('#cash');
  const cashResult = root.querySelector('#cashResult');

  const engStatus = root.querySelector('#engStatus');
  let engTimer = null;

  // Draw table initially
  async function loadStocks() {
    const rows = await stocksService.listStocks();
    tbody.innerHTML = rows.map(r => `
      <tr data-sym="${r.symbol}">
        <td><strong>${r.symbol}</strong></td>
        <td>${r.name}</td>
        <td class="price">${Number(r.price).toFixed(2)}</td>
        <td class="halt">${r.halted ? '<span class="badge badge--danger">Yes</span>' : '<span class="badge badge--ok">No</span>'}</td>
        <td><button class="btn small" data-h="${r.symbol}">${r.halted ? 'Resume' : 'Halt'}</button></td>
      </tr>
    `).join('');
  }
  loadStocks();

  // Upsert helper for table rows
  function upsertRow(p) {
    let tr = tbody.querySelector(`[data-sym="${p.symbol}"]`);
    if (!tr) {
      tr = document.createElement('tr');
      tr.setAttribute('data-sym', p.symbol);
      tr.innerHTML = `
        <td><strong>${p.symbol}</strong></td>
        <td>${p.name || ''}</td>
        <td class="price">-</td>
        <td class="halt">${p.halted ? '<span class="badge badge--danger">Yes</span>' : '<span class="badge badge--ok">No</span>'}</td>
        <td><button class="btn small" data-h="${p.symbol}">${p.halted ? 'Resume' : 'Halt'}</button></td>
      `;
      tbody.appendChild(tr);
    }
    tr.querySelector('.price').textContent = Number(p.price).toFixed(2);
    tr.querySelector('.halt').innerHTML = p.halted
      ? '<span class="badge badge--danger">Yes</span>'
      : '<span class="badge badge--ok">No</span>';
    const btn = tr.querySelector('button[data-h]');
    if (btn) btn.textContent = p.halted ? 'Resume' : 'Halt';
  }

  // Listen to realtime ticks (self:true so admin also sees its own broadcasts)
  const unsubscribe = stocksService.subscribePrices(upsertRow, { self: true });

  // Row halt toggle
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-h]');
    if (!btn) return;
    const symbol = btn.getAttribute('data-h');
    const rows = await stocksService.listStocks();
    const s = rows.find(x => x.symbol === symbol);
    await adminService.setHalted(symbol, !s.halted);
    toast(`"${symbol}" ${!s.halted ? 'halted' : 'resumed'}`);
    loadStocks();
  });

  // Nudge (DB update via RPC + broadcast to everyone)
  nudgeBtn.onclick = async () => {
    try {
      const s = sym.value.trim().toUpperCase();
      const p = Number(pct.value);
      if (!s) return toast('Enter symbol');
      if (!p) return toast('Enter percent e.g. 0.05');

      const row = await adminService.nudgePercent(s, p);
      await priceChannel.send({
        type: 'broadcast',
        event: 'tick',
        payload: [{ symbol: row.symbol, name: row.name, price: Number(row.price), halted: row.halted }]
      });

      toast(`Nudged ${s} by ${(p * 100).toFixed(2)}%`);
      sym.value = ''; pct.value = '';
    } catch (err) {
      console.error(err); toast('Nudge failed');
    }
  };

  // Halt/Resume
  haltBtn.onclick = async () => {
    try {
      const s = symH.value.trim().toUpperCase();
      const h = selH.value === 'true';
      if (!s) return toast('Enter symbol');
      await adminService.setHalted(s, h);
      toast(`${h ? 'Halted' : 'Resumed'} ${s}`);
      loadStocks();
    } catch (err) {
      console.error(err); toast('Update failed');
    }
  };

  // Cash allocate
  cashBtn.onclick = async () => {
    try {
      const u = await usersService.findByEmail(email.value.trim());
      if (!u) { cashResult.textContent = 'No user found for that email.'; return; }
      const amt = Number(delta.value);
      if (!amt) { cashResult.textContent = 'Enter amount.'; return; }

      const { data, error } = await supabase.rpc('add_cash', { p_user_id: u.id, p_delta: amt });
      if (error) throw error;

      cashResult.textContent = `Updated. New cash: ₹${Number(data?.cash || 0).toFixed(2)}`;
      toast('Cash updated');
      email.value = ''; delta.value = '';
    } catch (err) {
      console.error(err);
      cashResult.textContent = 'Failed to update cash.';
      toast('Cash update failed');
    }
  };

  // Engine Start/Stop
  root.querySelector('#startEngine').onclick = () => {
    if (engTimer) return;
    runEngineTick(); // immediate tick
    engTimer = setInterval(runEngineTick, 10_000);
    engStatus.textContent = 'Engine running (10s)';
  };
  root.querySelector('#stopEngine').onclick = () => {
    if (engTimer) clearInterval(engTimer);
    engTimer = null;
    engStatus.textContent = 'Engine stopped';
  };

  // Cleanup on unmount
  root.oncleanup = () => {
    unsubscribe && unsubscribe();
    if (engTimer) clearInterval(engTimer);
  };
}
