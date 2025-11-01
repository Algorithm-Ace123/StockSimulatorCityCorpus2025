// src/views/admin.view.js
import { stocksService } from '../services/stocks.service.js';
import { adminService } from '../services/admin.service.js';
import { toast } from '../components/toast.js';
import { supabase } from '../services/supabase.js';
import { getPricesChannel } from '../services/realtime.js';
import { ENV } from '../config.js';

/* ---------- Helpers ---------- */
function gaussian(mean = 0, std = 1) {
  let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const round2 = (n) => Math.round(n * 100) / 100;

/** Smoothstep 0..1 -> 0..1 (gentle start & finish; no late jump) */
function smoothstep01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

/* ---------- One shared broadcast channel (self:true for admin) ---------- */
const priceChannel = getPricesChannel(true);

/* ---------- Engine tick (neutral/up/down gentle; target = exact time glide) ---------- */
async function runEngineTick() {
  const { data: stocks, error } = await supabase
    .from('stocks')
    .select(`
      symbol, price, drift, vol, halted, name, trajectory, updated_at,
      target_price, target_start_price, target_start_at, target_end
    `);

  if (error) { console.error('[engine] load', error); return; }

  const updates = [];
  const now = new Date();
  const nowIso = now.toISOString();

  // constants from config (for normal mode only)
  const VOL_SCALE    = ENV?.ENGINE?.VOL_SCALE ?? 0.02;
  const NOISE_MULT   = ENV?.ENGINE?.NOISE_MULT ?? 0.12;
  const MAX_STEP     = ENV?.ENGINE?.MAX_SINGLE_TICK_PCT ?? 0.0015;
  const BIAS_PCT     = ENV?.ENGINE?.BIAS_PCT ?? 0.0006;

  for (const s of (stocks || [])) {
    if (s.halted) continue;

    const last = Number(s.price);
    let next   = last; // will set below

    // ===== Target glide path (authoritative, time-based) =====
    const hasTarget =
      Number(s.target_price || 0) !== 0 &&
      s.target_start_price != null &&
      s.target_start_at != null &&
      s.target_end != null;

    if (hasTarget) {
      const tStart = new Date(s.target_start_at).getTime();
      const tEnd   = new Date(s.target_end).getTime();
      const tNow   = now.getTime();

      if (tNow < tEnd) {
        // fraction elapsed 0..1
        const lin  = (tNow - tStart) / (tEnd - tStart);
        const frac = smoothstep01(lin);

        const start = Number(s.target_start_price);
        const target= Number(s.target_price);

        // EXACT guide value for this moment (no random, no clamp)
        next = start + (target - start) * frac;

        // keep monotonic towards target and round to paise
        if (target > start) next = Math.max(next, last); // rising
        else                next = Math.min(next, last); // falling

        next = round2(next);
      } else {
        // Done: snap to target exactly and clear to "no target" (0)
        next = round2(Number(s.target_price));
        const { error: clrErr } = await supabase
          .from('stocks')
          .update({
            target_price: 0,
            target_start_price: 0,
            target_start_at: null,
            target_end: null
          })
          .eq('symbol', s.symbol);
        if (clrErr) console.error('[engine] clear target', s.symbol, clrErr.message);
      }
    } else {
      // ===== Normal mode: very low noise + gentle bias; keep neutral flat =====
      const base = Number(s.drift || 0);
      const vol0 = Number(s.vol   || 0.02);

      // ultra-low noise
      const volNow = vol0 * VOL_SCALE;
      const noise  = gaussian(0, volNow) * NOISE_MULT;

      // gentle bias by trajectory
      let bias = 0;
      if (s.trajectory === 'UP')   bias = +BIAS_PCT;
      if (s.trajectory === 'DOWN') bias = -BIAS_PCT;
      // NEUTRAL → bias = 0

      let proposed = last * (1 + base + bias + noise);

      // hard clamp per tick in normal mode only
      const upCap   = last * (1 + MAX_STEP);
      const downCap = last * (1 - MAX_STEP);
      proposed = Math.min(upCap, Math.max(downCap, proposed));

      next = round2(Math.max(1, proposed));
    }

    // ===== optimistic concurrency: only write if row unchanged since read =====
    const { data: wrote, error: upErr } = await supabase
      .from('stocks')
      .update({ price: next, updated_at: nowIso })
      .eq('symbol', s.symbol)
      .eq('updated_at', s.updated_at)
      .select('symbol');

    if (upErr) { console.error('[engine] update', s.symbol, upErr.message); continue; }
    if (!wrote || wrote.length === 0) continue;

    updates.push({
      symbol: s.symbol,
      name: s.name,
      price: next,
      halted: false,
      trajectory: s.trajectory,
      updated_at: nowIso
    });
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
        <div class="card-body grid" style="grid-template-columns: 1fr 1fr; gap:.9rem;">

          <div class="card p-3" style="border-radius:12px;">
            <h3>Nudge Price</h3>
            <div class="small">Apply a +/- percentage to a symbol on next update.</div>
            <div class="mt-3 grid" style="grid-template-columns: 1fr 1fr 1fr; gap:.6rem;">
              <input id="sym" placeholder="SYM e.g. RELIANCE" />
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

          <div class="card p-3" style="border-radius:12px;">
            <h3>Price Engine</h3>
            <div class="small">Runs in this browser tab. Keep it open during the fest.</div>
            <div class="mt-3 flex" style="align-items:center; gap:.7rem;">
              <button id="startEngine" class="btn btn--accent">Start</button>
              <button id="stopEngine"  class="btn btn--danger">Stop</button>
              <label class="small">Interval (s):
                <input id="tickInterval" type="number" min="2" step="1"
                       value="${(ENV?.ENGINE?.DEFAULT_TICK_MS ?? 3000)/1000}"
                       style="width:70px; margin-left:.3rem;">
              </label>
              <span id="engStatus" class="small"></span>
            </div>
          </div>

          <div class="card p-3" style="border-radius:12px; grid-column: span 2;">
            <h3>Allocate Cash</h3>
            <div class="small">Add (+) or deduct (−) money from a player by email.</div>
            <div class="mt-3 grid" style="grid-template-columns: 2fr 1fr 1fr; gap:.6rem;">
              <input id="email" type="email" placeholder="player@example.com" />
              <input id="delta" type="number" step="1" placeholder="Amount (e.g. 5000 or -2000)" />
              <button id="cash" class="btn">Apply</button>
            </div>
            <div id="cashResult" class="small mt-2"></div>
          </div>

        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2>Stocks</h2></div>
        <div class="card-body">
          <table class="table" id="tbl">
            <thead>
              <tr>
                <th>Symbol</th><th>Name</th><th>Price</th><th>Halted</th><th>Trajectory</th><th>Target</th><th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  const tbody     = root.querySelector('#tbl tbody');
  const sym       = root.querySelector('#sym');
  const pct       = root.querySelector('#pct');
  const nudgeBtn  = root.querySelector('#nudge');

  const symH      = root.querySelector('#symH');
  const selH      = root.querySelector('#halted');
  const haltBtn   = root.querySelector('#halt');

  const email     = root.querySelector('#email');
  const delta     = root.querySelector('#delta');
  const cashBtn   = root.querySelector('#cash');
  const cashResult= root.querySelector('#cashResult');

  const engStatus = root.querySelector('#engStatus');
  const tickInput = root.querySelector('#tickInterval');

  let engTimer = null;
  let tickMs   = Math.max(2000, Number(tickInput.value) * 1000);

  tickInput.addEventListener('change', () => {
    tickMs = Math.max(2000, Number(tickInput.value) * 1000);
    engStatus.textContent = `Next tick every ${tickMs/1000}s`;
  });

  // Initial table
  async function loadStocks() {
    const rows = await stocksService.listStocks();
    tbody.innerHTML = rows.map(r => `
      <tr data-sym="${r.symbol}">
        <td><strong>${r.symbol}</strong></td>
        <td>${r.name}</td>
        <td class="price">${Number(r.price).toFixed(2)}</td>
        <td class="halt">${r.halted ? '<span class="badge badge--danger">Yes</span>' : '<span class="badge badge--ok">No</span>'}</td>
        <td>
          <select class="traj" data-traj="${r.symbol}">
            <option value="UP">Up</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="DOWN">Down</option>
          </select>
        </td>
        <td class="small">
          <input class="tprice" data-tp="${r.symbol}" type="number" step="0.01" placeholder="₹ target" style="width:105px;">
          <input class="tsecs"  data-ts="${r.symbol}" type="number" min="1"  placeholder="secs"      style="width:80px;">
          <button class="btn small" data-target="${r.symbol}">Set</button>
          <button class="btn small" data-cleartarget="${r.symbol}">Clear</button>
        </td>
        <td><button class="btn small" data-h="${r.symbol}">${r.halted ? 'Resume' : 'Halt'}</button></td>
      </tr>
    `).join('');

    rows.forEach(r => {
      const sel = tbody.querySelector(`select.traj[data-traj="${r.symbol}"]`);
      if (sel) sel.value = r.trajectory || 'NEUTRAL';
    });
  }
  loadStocks();

  // Upsert helper for broadcast updates
  function upsertRow(p) {
    let tr = tbody.querySelector(`[data-sym="${p.symbol}"]`);
    if (!tr) {
      tr = document.createElement('tr');
      tr.setAttribute('data-sym', p.symbol);
      tr.innerHTML = `
        <td><strong>${p.symbol}</strong></td>
        <td>${p.name || ''}</td>
        <td class="price">-</td>
        <td class="halt"><span class="badge badge--ok">No</span></td>
        <td>
          <select class="traj" data-traj="${p.symbol}">
            <option value="UP">Up</option>
            <option value="NEUTRAL" selected>Neutral</option>
            <option value="DOWN">Down</option>
          </select>
        </td>
        <td class="small">
          <input class="tprice" data-tp="${p.symbol}" type="number" step="0.01" placeholder="₹ target" style="width:105px;">
          <input class="tsecs"  data-ts="${p.symbol}" type="number" min="1"  placeholder="secs"      style="width:80px;">
          <button class="btn small" data-target="${p.symbol}">Set</button>
          <button class="btn small" data-cleartarget="${p.symbol}">Clear</button>
        </td>
        <td><button class="btn small" data-h="${p.symbol}">Halt</button></td>
      `;
      tbody.appendChild(tr);
    }
    tr.querySelector('.price').textContent = Number(p.price).toFixed(2);
    const sel = tr.querySelector('select.traj');
    if (sel && p.trajectory) sel.value = p.trajectory;
    const btn = tr.querySelector('button[data-h]');
    if (btn) btn.textContent = p.halted ? 'Resume' : 'Halt';
  }

  // Realtime listen
  const unsubscribe = stocksService.subscribePrices(upsertRow, { self: true });

  // --- Row actions ---
  // Halt toggle
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-h]');
    if (!btn) return;
    const symbol = btn.getAttribute('data-h');

    const { data: srow } = await supabase.from('stocks').select('halted').eq('symbol', symbol).single();
    const nextH = !srow?.halted;
    const { error } = await supabase.from('stocks').update({ halted: nextH }).eq('symbol', symbol);
    if (error) { toast('Failed to update halt'); return; }

    toast(`${nextH ? 'Halted' : 'Resumed'} ${symbol}`);
    loadStocks();
  });

  // Trajectory change
  tbody.addEventListener('change', async (e) => {
    const sel = e.target.closest('select.traj');
    if (!sel) return;
    const symbol = sel.dataset.traj;
    const trajectory = sel.value;
    const { error } = await supabase.from('stocks').update({ trajectory }).eq('symbol', symbol);
    if (error) { toast('Failed to update trajectory'); return; }
    toast(`Trajectory for ${symbol} → ${trajectory}`);
  });

  // Set target (glide to price in N seconds)
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    const symbol = btn.getAttribute('data-target');
    const priceEl = tbody.querySelector(`input.tprice[data-tp="${symbol}"]`);
    const secsEl  = tbody.querySelector(`input.tsecs[data-ts="${symbol}"]`);
    const target  = Number(priceEl?.value);
    const secs    = Number(secsEl?.value);

    if (!target || !secs) { toast('Enter target price and seconds'); return; }

    const { data: cur, error: seErr } = await supabase
      .from('stocks').select('price').eq('symbol', symbol).single();
    if (seErr) { toast('Failed to read price'); return; }

    const now = new Date();
    const end = new Date(now.getTime() + secs * 1000);

    const { error } = await supabase
      .from('stocks')
      .update({
        target_price: target,
        target_start_price: Number(cur.price),
        target_start_at: now.toISOString(),
        target_end: end.toISOString()
      })
      .eq('symbol', symbol);

    if (error) { toast('Failed to set target'); return; }
    toast(`Target set: ${symbol} → ₹${target.toFixed(2)} in ${secs}s`);
  });

  // Clear target immediately (sets target back to 0)
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-cleartarget]');
    if (!btn) return;
    const symbol = btn.getAttribute('data-cleartarget');

    const { error } = await supabase
      .from('stocks')
      .update({
        target_price: 0,
        target_start_price: 0,
        target_start_at: null,
        target_end: null
      })
      .eq('symbol', symbol);

    if (error) { toast('Failed to clear target'); return; }
    toast(`Target cleared for ${symbol}`);
  });

  // Allocate Cash (+/-) — expects RPC add_cash_by_email(p_email text, p_delta numeric)
  cashBtn.onclick = async () => {
    try {
      const em  = email.value.trim();
      const amt = Number(delta.value);
      if (!em)  { cashResult.textContent = 'Enter an email.'; return; }
      if (!amt) { cashResult.textContent = 'Enter a non-zero amount.'; return; }

      const { data, error } = await supabase.rpc('add_cash_by_email', {
        p_email: em, p_delta: amt
      });
      if (error) throw error;

      cashResult.textContent = `Updated. New cash: ₹${Number(data?.cash || 0).toFixed(2)}`;
      toast('Cash updated');
      email.value = ''; delta.value = '';
    } catch (err) {
      console.error(err);
      cashResult.textContent = 'Failed to update cash.';
      toast(err?.message || 'Cash update failed');
    }
  };

  // Nudge (RPC + broadcast)
  nudgeBtn.onclick = async () => {
    try {
      const s = sym.value.trim().toUpperCase();
      const p = Number(pct.value);
      if (!s) return toast('Enter symbol');
      if (!p) return toast('Enter percent e.g. 0.05');

      const row = await adminService.nudgePercent(s, p); // updates DB via RPC
      await priceChannel.send({
        type: 'broadcast',
        event: 'tick',
        payload: [{ symbol: row.symbol, name: row.name, price: Number(row.price), halted: row.halted, trajectory: row.trajectory }]
      });

      toast(`Nudged ${s} by ${(p * 100).toFixed(2)}%`);
      sym.value = ''; pct.value = '';
    } catch (err) {
      console.error(err); toast('Nudge failed');
    }
  };

  // Engine Start/Stop
  root.querySelector('#startEngine').onclick = () => {
    if (engTimer) return;
    runEngineTick(); // immediate
    engTimer = setInterval(runEngineTick, tickMs);
    engStatus.textContent = `Engine running (${tickMs/1000}s)`;
  };
  root.querySelector('#stopEngine').onclick = () => {
    if (engTimer) clearInterval(engTimer);
    engTimer = null;
    engStatus.textContent = 'Engine stopped';
  };

  // Cleanup
  root.oncleanup = () => {
    unsubscribe && unsubscribe();
    if (engTimer) clearInterval(engTimer);
  };
}
