import { store } from '../store/index.js';

export const requireAuth = (View) => async (root) => {
  const s = store.get('session');
  if (!s || !s.user) {
    location.hash = '#/login';
    return;
  }
  return View(root);
};

export const requireAdmin = (View) => async (root) => {
  const s = store.get('session');
  if (!(s && s.user && (s.role === 'ADMIN' || s.user.role === 'ADMIN'))) {
    location.hash = '#/trade';
    return;
  }
  return View(root);
};
