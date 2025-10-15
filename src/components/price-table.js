import { store } from '../store/index.js';
import { stocksService } from '../services/stocks.service.js';

// tiny sparkline drawer (no Chart.js, fast for many rows)
function drawSparkline(canvas, arr, min, max) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  if (!arr || arr.length < 2) return;

  const n = arr.length;
  const range = (max - min) || 1e-9;
  const xstep = w / (n - 1);

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#9dd0ff';
  ctx.beginPath();
  arr.forEach((v, i) => {
    const x = i * xstep;
    const y = h - ((v - min) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

class PriceTable extends HTMLElement {
  constructor(){
    super();
    this.history = new Map(); // symbol -> array of last ~60 prices
    this.unsubscribe = null;
  }

  connectedCallback() {
    this.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Symbol</th><th>Name</th><th>Price</th><th>Trend</th><th></th></tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    this.tbody = this.querySelector('tbody');

    // seed and subscribe
    this.seed();
  }

  async seed() {
    const list = await stocksService.listStocks();
    const map = new Map(list.map(x => [x.symbol, x]));
    store.set('prices', map);
    this.render();

    // realtime updates
    this.unsubscribe = stocksService.subscribePrices((row) => {
      const m = store.get('prices') || new Map();
      const prev = m.get(row.symbol);
      m.set(row.symbol, { ...prev, ...row });

      // keep sparkline history per symbol
      const hist = this.history.get(row.symbol) || [];
      hist.push(row.price);
      if (hist.length > 60) hist.shift();
      this.history.set(row.symbol, hist);

      store.set('prices', m);
      this.updateRow(row.symbol);
    });
  }

  disconnectedCallback() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const prices = store.get('prices') || new Map();
    this.tbody.innerHTML = [...prices.values()].map(s => this.rowHTML(s)).join('');
    // draw all sparklines
    requestAnimationFrame(() => {
      [...prices.values()].forEach(s => this.paintSpark(s.symbol));
    });
  }

  rowHTML(s) {
    const haltedBadge = s.halted ? `<span class="badge badge--danger">Halted</span>` : '';
    return `
      <tr id="r-${s.symbol}">
        <td><strong>${s.symbol}</strong></td>
        <td>${s.name || ''} ${haltedBadge}</td>
        <td class="price">${s.price?.toFixed(2) ?? '-'}</td>
        <td style="width:130px;">
          <canvas class="spark" width="130" height="28" style="width:130px;height:28px"></canvas>
        </td>
        <td><button class="btn small" data-select="${s.symbol}">Analyze</button></td>
      </tr>
    `;
  }

  updateRow(symbol) {
    const prices = store.get('prices');
    const s = prices.get(symbol);
    const row = this.querySelector(`#r-${symbol}`);
    if (!row || !s) return;
    row.querySelector('.price').textContent = Number(s.price).toFixed(2);
    this.paintSpark(symbol);
  }

  paintSpark(symbol) {
    const row = this.querySelector(`#r-${symbol}`);
    if (!row) return;
    const canvas = row.querySelector('canvas.spark');
    const hist = this.history.get(symbol) || [];
    if (hist.length < 2) return;
    const min = Math.min(...hist);
    const max = Math.max(...hist);
    drawSparkline(canvas, hist, min, max);
  }

  // delegate clicks for Analyze button
  onclick = (e) => {
    const btn = e.target.closest('button[data-select]');
    if (!btn) return;
    const symbol = btn.dataset.select;
    store.set('selectedSymbol', symbol);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };
}
customElements.define('price-table', PriceTable);
