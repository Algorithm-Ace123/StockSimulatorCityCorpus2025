import { store } from '../store/index.js';
import { tradingService } from '../services/trading.service.js';
import { toast } from './toast.js';

class OrderTicketSimple extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <form class="grid" style="grid-template-columns: repeat(6,1fr); gap:.6rem;">
        <div style="grid-column: span 2;">
          <label class="small">Symbol</label>
          <input name="symbol" placeholder="e.g., RELIANCE" />
        </div>
        <div>
          <label class="small">Action</label>
          <select name="action"><option value="BUY">BUY</option><option value="SELL">SELL</option></select>
        </div>
        <div>
          <label class="small">Qty</label>
          <input name="qty" type="number" min="1" value="10" />
        </div>
        <div class="flex" style="align-items:flex-end;">
          <button class="btn btn--accent" type="submit">Submit</button>
        </div>
      </form>
      <div class="small mt-2">No limit/market confusion. BUY deducts Available → adds to Invested; SELL does the reverse.</div>
    `;
    this.form = this.querySelector('form');

    // Autofill from selected symbol
    this.unsub = store.subscribe('selectedSymbol', (sym) => {
      if (sym) this.form.symbol.value = sym;
    });

    this.form.addEventListener('submit', (e) => this.submit(e));
  }

  disconnectedCallback() { this.unsub && this.unsub(); }

  async submit(e) {
    e.preventDefault();
    const f = new FormData(this.form);
    const symbol = f.get('symbol').toString().trim().toUpperCase();
    const act    = f.get('action').toString();
    const qty    = Number(f.get('qty'));
    const s = store.get('session');
    if (!s?.user) { toast('Please login first'); location.hash = '#/login'; return; }

    try {
      if (act === 'BUY') await tradingService.buy(s.user.id, symbol, qty);
      else               await tradingService.sell(s.user.id, symbol, qty);
      toast(`${act} ${qty} ${symbol} done`);
    } catch (err) {
      toast(err.message || `${act} failed`);
    }
  }
}
customElements.define('order-ticket-simple', OrderTicketSimple);
