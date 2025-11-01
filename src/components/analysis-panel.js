import { store } from '../store/index.js';
import { stocksService } from '../services/stocks.service.js';
import { fmt } from '../utils/fmt.js';

// keep local history per symbol (independent from trade.view)
const hist = new Map(); // symbol -> [{t, p}]

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

function push(symbol, price) {
  const arr = hist.get(symbol) || [];
  arr.push({ t: Date.now(), p: Number(price) });
  if (arr.length > 300) arr.shift();
  hist.set(symbol, arr);
}

function redraw(symbol) {
  const arr = hist.get(symbol) || [];
  const labels = arr.map(x => new Date(x.t).toLocaleTimeString());
  const data = arr.map(x => x.p);
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update('none');
}

class AnalysisPanel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="analysis-overlay" style="
        position: fixed; inset: 0; background: rgba(4,7,12,.8); backdrop-filter: blur(6px);
        display:none; align-items:center; justify-content:center; z-index: 9999;
      ">
        <div class="card" style="width:min(1100px,94%); max-height:90vh; overflow:auto;">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between;">
            <h2 id="an-title">Analysis</h2>
            <button id="an-close" class="btn">Close</button>
          </div>
          <div class="card-body">
            <div class="grid" style="grid-template-columns: 1.2fr .8fr; gap:1rem;">
              <div>
                <canvas id="an-chart" height="280"></canvas>
              </div>
              <div>
                <div class="kpi" style="margin-bottom:.6rem;">
                  <div class="l">Current Price</div><div id="an-price" class="v">—</div>
                </div>
                <table class="table">
                  <tbody id="an-details">
                    <!-- rows injected -->
                  </tbody>
                </table>
              </div>
            </div>
            <div class="small" id="an-updated" style="margin-top:.6rem;color:#9aa3b5;">Updated —</div>
          </div>
        </div>
      </div>
    `;
    this.overlay = this.querySelector('.analysis-overlay');
    this.btnClose = this.querySelector('#an-close');
    this.btnClose.onclick = () => store.set('analysisOpen', false);

    // subscribe to open/close and price updates
    this.unsubOpen = store.subscribe('analysisOpen', (open) => this.toggle(open));
    this.unsubPrices = store.subscribe('prices', (map) => {
      const sym = store.get('selectedSymbol');
      if (!sym || !map) return;
      const row = map.get(sym);
      if (!row) return;
      push(sym, row.price);
      const priceEl = this.querySelector('#an-price');
      if (priceEl) priceEl.textContent = fmt.money(row.price);
      const upd = this.querySelector('#an-updated');
      if (upd) upd.textContent = `Updated ${new Date().toLocaleTimeString()}`;
      if (chart) redraw(sym);
    });
  }

  disconnectedCallback() {
    this.unsubOpen && this.unsubOpen();
    this.unsubPrices && this.unsubPrices();
  }

  async toggle(open) {
    if (!this.overlay) return;
    if (!open) { this.overlay.style.display = 'none'; return; }

    const sym = store.get('selectedSymbol');
    if (!sym) return;

    // load details from DB
    const info = await stocksService.getOne(sym);

    // title & details
    this.querySelector('#an-title').textContent = `${info.symbol} — ${info.name}`;
    this.querySelector('#an-price').textContent = fmt.money(info.price);
    const rows = [
      ['Symbol', info.symbol],
      ['Name', info.name || '—'],
      ['Sector', info.sector || '—'],
      ['P/E Ratio', info.pe_ratio != null ? info.pe_ratio.toFixed(2) : '—'],
      ['Trajectory', info.trajectory || 'NEUTRAL'],
      ['Last Updated', new Date(info.updated_at).toLocaleString()]
    ];
    this.querySelector('#an-details').innerHTML = rows
      .map(([k,v]) => `<tr><th style="width:40%">${k}</th><td>${v}</td></tr>`).join('');

    // chart
    const ctx = this.querySelector('#an-chart').getContext('2d');
    ensureChart(ctx);
    // seed history if empty
    if (!hist.get(sym)) { push(sym, info.price); }
    redraw(sym);

    this.overlay.style.display = 'flex';
  }
}
customElements.define('analysis-panel', AnalysisPanel);
