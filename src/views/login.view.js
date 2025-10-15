import { auth } from '../services/auth.service.js';
import { store } from '../store/index.js';
import { toast } from '../components/toast.js';

export default function LoginView(root){
  root.innerHTML = `
    <div class="grid" style="grid-template-columns: 1.2fr .8fr;">
      <section class="card">
        <div class="card-header"><h2>Sign in</h2></div>
        <div class="card-body">
          <form id="loginForm" class="grid" style="grid-template-columns: 1fr 1fr; gap:.8rem;">
            <div style="grid-column: span 2;">
              <label class="small">Email</label>
              <input name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div style="grid-column: span 2;">
              <label class="small">Password</label>
              <input name="password" type="password" placeholder="••••••••" required />
            </div>
            <div class="flex" style="grid-column: span 2; justify-content: space-between;">
              <button class="btn btn--accent" type="submit">Login</button>
              <a href="#/trade" class="small">Skip (dev)</a>
            </div>
          </form>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2>Create account</h2></div>
        <div class="card-body">
          <form id="signupForm" class="grid" style="grid-template-columns: 1fr 1fr; gap:.8rem;">
            <div style="grid-column: span 2;">
              <label class="small">Display name</label>
              <input name="display" placeholder="Player One" />
            </div>
            <div style="grid-column: span 2;">
              <label class="small">Email</label>
              <input name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div style="grid-column: span 2;">
              <label class="small">Password</label>
              <input name="password" type="password" placeholder="At least 6 chars" required />
            </div>
            <div style="grid-column: span 2;">
              <button class="btn" type="submit">Sign up</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;

  const loginForm = root.querySelector('#loginForm');
  const signupForm = root.querySelector('#signupForm');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    try {
      await auth.signIn(fd.get('email'), fd.get('password'));
      const session = await auth.getSession();
      store.set('session', { user: session.user, role: session.user.user_metadata?.role || 'PLAYER' });
      toast('Welcome back!');
      location.hash = '#/trade';
    } catch (err) {
      toast(err.message || 'Login failed');
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(signupForm);
    try {
      await auth.signUp(fd.get('email'), fd.get('password'), fd.get('display'));
      const session = await auth.getSession();
      if (session?.user) {
        store.set('session', { user: session.user, role: session.user.user_metadata?.role || 'PLAYER' });
        toast('Account created!');
        location.hash = '#/trade';
      } else {
        toast('Check your email to confirm, then login.');
      }
    } catch (err) {
      toast(err.message || 'Signup failed');
    }
  });
}

