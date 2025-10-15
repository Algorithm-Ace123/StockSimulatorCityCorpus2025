import { mountView } from './utils/dom.js';
import LoginView from './views/login.view.js';
import TradeView from './views/trade.view.js';
import AdminView from './views/admin.view.js';
import LeaderboardView from './views/leaderboard.view.js';
import { requireAuth, requireAdmin } from './utils/guards.js';

const routes = new Map([
  ['#/login', LoginView],
  ['#/trade', requireAuth(TradeView)],
  ['#/admin', requireAdmin(AdminView)],
  ['#/leaderboard', LeaderboardView],
]);

function resolve() {
  const hash = location.hash || '#/login';
  const View = routes.get(hash) || LoginView;
  mountView(View);
}

export function startRouter() {
  addEventListener('hashchange', resolve);
  resolve();
}
