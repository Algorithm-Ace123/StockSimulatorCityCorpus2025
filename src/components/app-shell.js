import { el } from '../utils/dom.js';

class AppShell extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="app-header">
        <nav class="navbar">
          <div class="brand">
            <div class="logo"></div>
            <span>StockSim</span>
          </div>
          <div class="flex right">
            <a href="#/leaderboard" class="btn small">Leaderboard</a>
            <a href="#/trade" class="btn small">Trade</a>
            <a href="#/admin" class="btn small">Admin</a>
            <a href="#/login" class="btn small">Login</a>
          </div>
        </nav>
      </header>
      <main class="app-main"><div class="container" id="view"></div></main>
      <footer class="app-footer">
        <div class="container small">Built for the fest • Vanilla JS + Supabase • Realtime</div>
      </footer>
      <div id="toast-root"></div>
    `;
    this.viewRoot = this.querySelector('#view');
  }

  mount(View) {
    if (!this.viewRoot) return;
    this.viewRoot.replaceChildren();
    View?.(this.viewRoot);
  }
}
customElements.define('app-shell', AppShell);
