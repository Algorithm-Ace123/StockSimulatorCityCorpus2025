import { leaderboardService } from '../services/leaderboard.service.js';
import { fmt } from '../utils/fmt.js';

export default async function LeaderboardView(root){
  root.innerHTML = `
    <section class="card">
      <div class="card-header"><h2>Leaderboard</h2></div>
      <div class="card-body">
        <table class="table" id="lb">
          <thead><tr><th>#</th><th>Player</th><th>Equity</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;

  const tbody = root.querySelector('#lb tbody');
  const rows = await leaderboardService.getTop(50);
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${r.display || 'Player'}</td>
      <td>${fmt.money(r.equity)}</td>
    </tr>
  `).join('');
}
