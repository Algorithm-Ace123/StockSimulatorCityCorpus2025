import { store } from '../store/index.js';
import { tradingService } from '../services/trading.service.js';
import { fmt } from '../utils/fmt.js';

class PortfolioTable extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Qty</th>
            <th>Bought @</th>
            <th>Invested ₹</th>
            <th>Current ₹</th>
            <th>P/L ₹</th>
            <th>P/L %</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    this.tbody = this.querySelector('tbody');
    this.load();

    // Refresh on price ticks
    this.unsub = store.subscribe('prices', () => this.load());
  }

  disconnectedCallback(){ this.unsub && this.unsub(); }

  async load() {
    const s = store.get('session');
    if (!s?.user) return;
    const rows = await tradingService.portfolio(s.user.id);
    this.tbody.innerHTML = rows.map(r => {
      const cls = Number(r.pnl_value) >= 0 ? 'badge--ok' : 'badge--danger';
      return `
        <tr>
          <td><strong>${r.symbol}</strong></td>
          <td>${fmt.num(r.qty, 0)}</td>
          <td>${fmt.money(r.avg_price)}</td>
          <td>${fmt.money(r.invested_amount)}</td>
          <td>${fmt.money(r.current_value)} <span class="small">(${fmt.money(r.current_price)})</span></td>
          <td><span class="badge ${cls}">${fmt.money(r.pnl_value)}</span></td>
          <td><span class="badge ${cls}">${(Number(r.pnl_pct)*100).toFixed(2)}%</span></td>
        </tr>
      `;
    }).join('');
  }
}
customElements.define('portfolio-table', PortfolioTable);
