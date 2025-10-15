import { store } from '../store/index.js';
import { ordersService } from '../services/orders.service.js';
import { toast } from './toast.js';

class OrderTicket extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <form class="grid" style="grid-template-columns: repeat(6,1fr); gap:.6rem;">
        <div style="grid-column: span 2;">
          <label class="small">Symbol</label>
          <input name="symbol" placeholder="e.g., ABX" />
        </div>
        <div>
          <label class="small">Side</label>
          <select name="side"><option>BUY</option><option>SELL</option></select>
        </div>
        <div>
          <label class="small">Type</label>
          <select name="type"><option>MARKET</option><option>LIMIT</option></select>
        </div>
        <div>
          <label class="small">Qty</label>
          <input name="qty" type="number" min="1" value="10" />
        </div>
        <div>
          <label class="small">Limit</label>
          <input name="limitPrice" type="number" step="0.01" placeholder="—" />
        </div>
        <div class="flex" style="align-items:flex-end;">
          <button class="btn btn--accent" type="submit">Submit</button>
        </div>
      </form>
      <div class="small mt-2">Tip: select a stock in Market table to auto-fill the symbol.</div>
    `;
    this.form = this.querySelector('form');

    // autofill from selected symbol
    this.unsub = store.subscribe('selectedSymbol', (sym) => {
      if (!sym) return;
      this.form.symbol.value = sym;
    });

    this.form.addEventListener('submit', (e) => this.submit(e));
  }

  disconnectedCallback() {
    this.unsub && this.unsub();
  }

  async submit(e) {
    e.preventDefault();
    const f = new FormData(this.form);
    const symbol = f.get('symbol').toString().trim().toUpperCase();
    const side = f.get('side').toString();
    const type = f.get('type').toString();
    const qty = Number(f.get('qty'));
    const limitPrice = f.get('limitPrice') ? Number(f.get('limitPrice')) : undefined;

    const session = store.get('session');
    if (!session?.user) { toast('Please login first'); location.hash = '#/login'; return; }

    try {
      if (type === 'MARKET') {
        await ordersService.placeMarket(session.user.id, symbol, side, qty);
      } else {
        await ordersService.placeLimit(session.user.id, symbol, side, qty, limitPrice);
      }
      toast('Order submitted');
    } catch (err) {
      console.error(err);
      toast(err?.message || 'Order failed');
    }
  }
}
customElements.define('order-ticket', OrderTicket);
