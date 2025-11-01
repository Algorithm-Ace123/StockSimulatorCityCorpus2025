// src/views/trade.view.js
import { tradingService } from '../services/trading.service.js';
import { store } from '../store/index.js';
import { fmt } from '../utils/fmt.js';
import '../components/price-table.js';
import '../components/order-ticket-simple.js';
import '../components/portfolio-table.js';

// ------- Chart helpers -------
const historyMap = new Map(); // symbol -> [{t,p}]
let chart;
function ensureChart(ctx) {
  if (chart) return chart;
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Price', data: [], tension: 0.25 }] },
    options: {
      responsive: true, animation: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { ticks: { color: '#aab4c3' }, grid: { color: 'rgba(255,255,255,.06)' } },
        y: { ticks: { color: '#aab4c3' }, grid: { color: 'rgba(255,255,255,.06)' } }
      }
    }
  });
  return chart;
}
function pushHistory(symbol, price) {
  const arr = historyMap.get(symbol) || [];
  arr.push({ t: Date.now(), p: Number(price) });
  if (arr.length > 180) arr.shift(); // ~30 min at 10s ticks
  historyMap.set(symbol, arr);
}
function redrawDetail(symbol) {
  const arr = historyMap.get(symbol) || [];
  const labels = arr.map(x => new Date(x.t).toLocaleTimeString());
  const data = arr.map(x => x.p);
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update('none');
}

export default async function TradeView(root){
  root.innerHTML = `
    <div class="grid grid-2">
      <section class="card">
        <div class="card-header">
          <h2>Market</h2>
          <div class="toolbar"><span class="tag-pill">Live</span></div>
        </div>
        <div class="card-body">
          <!-- KPI strip -->
          <div class="flex" style="gap:1rem; margin-bottom:.75rem;">
            <div class="kpi"><div class="l">Available</div><div id="kpi-cash" class="v">—</div></div>
            <div class="kpi"><div class="l">Invested</div><div id="kpi-invested" class="v">—</div></div>
            <div class="kpi"><div class="l">Equity</div><div id="kpi-equity" class="v">—</div></div>
          </div>

          <price-table></price-table>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2>Trade</h2></div>
        <div class="card-body">
          <order-ticket-simple></order-ticket-simple>
        </div>
      </section>

      <!-- PORTFOLIO replaces Positions & Orders -->
      <section class="card" style="grid-column: span 2;">
        <div class="card-header"><h2>Portfolio</h2></div>
        <div class="card-body">
          <portfolio-table></portfolio-table>
        </div>
      </section>

      <section class="card" style="grid-column: span 2;">
        <div class="card-header"><h2>Analysis</h2></div>
        <div class="card-body">
          <canvas id="detail-chart" height="160"></canvas>
          <div class="small mt-2">Click “Analyze” in the market table to focus a stock.</div>
        </div>
      </section>
    </div>
  `;

  // KPIs
  async function refreshKpis() {
    const s = store.get('session');
    if (!s?.user) return;
    const k = await tradingService.kpis(s.user.id);
    root.querySelector('#kpi-cash').textContent     = fmt.money(k.available_cash);
    root.querySelector('#kpi-invested').textContent = fmt.money(k.invested_money);
    root.querySelector('#kpi-equity').textContent   = fmt.money(k.equity);
  }
  await refreshKpis();
  const unsubKpis = store.subscribe('prices', refreshKpis);

  // Chart setup
  const ctx = root.querySelector('#detail-chart').getContext('2d');
  ensureChart(ctx);

  // Update chart on price ticks for selected symbol
  const unsubPrices = store.subscribe('prices', (map) => {
    const sym = store.get('selectedSymbol');
    if (!sym || !map) return;
    const row = map.get(sym);
    if (!row) return;
    pushHistory(sym, row.price);
    redrawDetail(sym);
  });

  // When symbol selection changes, seed chart and redraw
  const unsubSel = store.subscribe('selectedSymbol', (sym) => {
    if (!sym) return;
    const map = store.get('prices');
    if (!map?.has(sym)) return;
    if (!historyMap.get(sym)) pushHistory(sym, map.get(sym).price);
    redrawDetail(sym);
  });

  // Default to first symbol for analysis if none chosen
  const map = store.get('prices');
  if (map && map.size && !store.get('selectedSymbol')) {
    const first = [...map.keys()][0];
    store.set('selectedSymbol', first);
  }

  // Cleanup
  root.oncleanup = () => {
    unsubKpis && unsubKpis();
    unsubPrices && unsubPrices();
    unsubSel && unsubSel();
  };
}

