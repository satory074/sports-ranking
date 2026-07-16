import { countryFlag, countryJa } from './countries';
import type { LatestFile, RankingEntry } from './types';

const COLLAPSED_ROWS = 50;

function formatPoints(points: number | null): string {
  if (points == null) return '—';
  return Number.isInteger(points)
    ? points.toLocaleString('ja-JP')
    : points.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function movementCell(e: RankingEntry): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'cell-move';
  if (e.prevRank == null) {
    td.classList.add('move-flat');
    td.textContent = '—';
    return td;
  }
  const diff = e.prevRank - e.rank; // 正 = 上昇
  if (diff > 0) {
    td.classList.add('move-up');
    td.textContent = `▲${diff}`;
    td.setAttribute('aria-label', `${diff}ランク上昇`);
  } else if (diff < 0) {
    td.classList.add('move-down');
    td.textContent = `▼${-diff}`;
    td.setAttribute('aria-label', `${-diff}ランク下降`);
  } else {
    td.classList.add('move-flat');
    td.textContent = '―';
    td.setAttribute('aria-label', '変動なし');
  }
  return td;
}

/** チーム表示名(日本語優先)。個人は選手名+国籍旗 */
export function displayName(e: RankingEntry, entity: 'country' | 'player'): string {
  if (entity === 'player') return e.name;
  return countryJa(e.code) ?? e.name;
}

export function displayFlag(e: RankingEntry, entity: 'country' | 'player'): string {
  return countryFlag(entity === 'player' ? (e.nat ?? '') : e.code);
}

export function renderTable(
  tbody: HTMLTableSectionElement,
  expandBtn: HTMLButtonElement,
  latest: LatestFile,
  entity: 'country' | 'player',
  expanded: boolean,
  onToggle: () => void,
): void {
  tbody.textContent = '';
  const rows = expanded ? latest.entries : latest.entries.slice(0, COLLAPSED_ROWS);

  for (const e of rows) {
    const tr = document.createElement('tr');
    const isJpn = entity === 'player' ? e.nat === 'JPN' : e.code === 'JPN';
    if (isJpn) tr.classList.add('is-jpn');
    if (e.rank <= 3) tr.classList.add('top3');

    const tdRank = document.createElement('td');
    tdRank.innerHTML = `<span class="cell-rank">${e.rank}</span>`;
    tr.appendChild(tdRank);

    const tdTeam = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'cell-team';
    const flag = displayFlag(e, entity);
    if (flag) {
      const fs = document.createElement('span');
      fs.className = 'team-flag';
      fs.textContent = flag;
      fs.setAttribute('aria-hidden', 'true');
      wrap.appendChild(fs);
    }
    const name = document.createElement('span');
    name.className = 'team-name';
    name.textContent = displayName(e, entity);
    const ja = entity === 'country' ? countryJa(e.code) : undefined;
    if (ja && ja !== e.name) {
      const sub = document.createElement('span');
      sub.className = 'team-sub';
      sub.textContent = e.name;
      name.appendChild(sub);
    }
    wrap.appendChild(name);
    tdTeam.appendChild(wrap);
    tr.appendChild(tdTeam);

    const tdPts = document.createElement('td');
    tdPts.className = 'cell-points';
    tdPts.textContent = formatPoints(e.points);
    tr.appendChild(tdPts);

    tr.appendChild(movementCell(e));
    tbody.appendChild(tr);
  }

  const remaining = latest.entries.length - COLLAPSED_ROWS;
  if (remaining > 0) {
    expandBtn.hidden = false;
    expandBtn.textContent = expanded ? '上位50件に戻す' : `残り${remaining}件を表示`;
    expandBtn.onclick = onToggle;
  } else {
    expandBtn.hidden = true;
  }
}
