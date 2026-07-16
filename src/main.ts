import './style.css';
import type { ChartSeriesDef } from './chart';
import { countryJa } from './countries';
import { loadHistory, loadIndex, loadLatest } from './data';
import { renderTable } from './table';
import type { HistoryFile, IndexCategory, IndexFile, LatestFile } from './types';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const els = {
  siteUpdated: $<HTMLParagraphElement>('site-updated'),
  sportTabs: $<HTMLDivElement>('sport-tabs'),
  genderTabs: $<HTMLDivElement>('gender-tabs'),
  catUpdated: $<HTMLParagraphElement>('cat-updated'),
  tbody: $<HTMLTableSectionElement>('rank-tbody'),
  expandBtn: $<HTMLButtonElement>('btn-expand'),
  chart: $<HTMLDivElement>('chart'),
  chartNote: $<HTMLParagraphElement>('chart-note'),
  search: $<HTMLInputElement>('team-search'),
  options: $<HTMLDataListElement>('team-options'),
  resetBtn: $<HTMLButtonElement>('btn-reset'),
  sourceLine: $<HTMLParagraphElement>('source-line'),
};

/** ECharts はバンドルが大きいため遅延ロードし、テーブルの初期描画を優先する */
type ChartModule = typeof import('./chart');
let chartMod: ChartModule | null = null;
async function ensureChart(): Promise<ChartModule> {
  if (!chartMod) {
    chartMod = await import('./chart');
    chartMod.initChart(els.chart);
  }
  return chartMod;
}

let index: IndexFile;
let current: IndexCategory | null = null;
let latest: LatestFile | null = null;
let history: HistoryFile | null = null;
let expanded = false;
let selected: ChartSeriesDef[] = [];
let nameToCode = new Map<string, string>();
let loadToken = 0;

function seriesName(code: string): string {
  if (!current) return code;
  if (current.entity === 'country') {
    return countryJa(code) ?? history?.names[code] ?? code;
  }
  return history?.names[code] ?? code;
}

function catById(id: string): IndexCategory | undefined {
  return index.categories.find((c) => c.id === id);
}

function currentHashId(): string | null {
  const m = location.hash.match(/^#\/([\w-]+)$/);
  return m ? m[1] : null;
}

/* ---- タブ描画 ------------------------------------------------------ */

function sportsList(): string[] {
  return [...new Set(index.categories.map((c) => c.sport))];
}

function renderSportTabs(): void {
  els.sportTabs.textContent = '';
  for (const sport of sportsList()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sport-tab';
    btn.role = 'tab';
    btn.textContent = sport;
    btn.setAttribute('aria-selected', String(current?.sport === sport));
    btn.onclick = () => {
      const cats = index.categories.filter((c) => c.sport === sport);
      // 同じ区分(男子/女子)があれば維持、なければ先頭
      const next =
        cats.find((c) => c.category === current?.category) ?? cats[0];
      location.hash = `#/${next.id}`;
    };
    els.sportTabs.appendChild(btn);
  }
}

function renderGenderTabs(): void {
  els.genderTabs.textContent = '';
  if (!current) return;
  const cats = index.categories.filter((c) => c.sport === current!.sport);
  for (const cat of cats) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gender-tab';
    btn.role = 'tab';
    btn.textContent = cat.category;
    btn.setAttribute('aria-selected', String(cat.id === current!.id));
    btn.onclick = () => {
      location.hash = `#/${cat.id}`;
    };
    els.genderTabs.appendChild(btn);
  }
}

/* ---- チャート系列の選択管理 ---------------------------------------- */

function defaultSelection(): ChartSeriesDef[] {
  if (!latest || !current || !chartMod) return [];
  const codes = latest.entries.slice(0, chartMod.MAX_SERIES).map((e) => e.code);
  // 日本(または日本人選手の最上位)が圏外なら8枠目に差し込む
  const jpn =
    current.entity === 'country'
      ? latest.entries.find((e) => e.code === 'JPN')
      : latest.entries.find((e) => e.nat === 'JPN');
  if (jpn && !codes.includes(jpn.code)) codes[codes.length - 1] = jpn.code;
  return codes.map((code, i) => ({
    code,
    name: seriesName(code),
    slot: i,
    pinned: code === jpn?.code,
  }));
}

function addTeam(code: string): void {
  if (!history || !chartMod) return;
  if (selected.some((s) => s.code === code)) return;
  if (selected.length >= chartMod.MAX_SERIES) {
    // 上限時はデフォルト系列(未ピン)の末尾を外して入れ替える
    let i = selected.length - 1;
    while (i >= 0 && selected[i].pinned) i--;
    if (i < 0) {
      showNote(`同時に表示できるのは${chartMod.MAX_SERIES}チームまでです。リセットで初期表示に戻せます。`);
      return;
    }
    selected.splice(i, 1);
  }
  const used = new Set(selected.map((s) => s.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  selected.push({ code, name: seriesName(code), slot, pinned: true });
  chartMod.renderChart(history, selected);
}

function showNote(text: string): void {
  els.chartNote.textContent = text;
  els.chartNote.hidden = false;
}

function renderAccumulatingNote(): void {
  if (!history || !current) return;
  if (history.snapshots.length < 3) {
    showNote('この競技の時系列データは蓄積を開始したばかりです。更新のたびに推移が積み上がります。');
  } else {
    els.chartNote.hidden = true;
  }
}

function populateSearchOptions(): void {
  els.options.textContent = '';
  nameToCode = new Map();
  if (!history) return;
  const codes = Object.keys(history.names);
  for (const code of codes) {
    const names = new Set<string>();
    names.add(history.names[code]);
    const ja = current?.entity === 'country' ? countryJa(code) : undefined;
    if (ja) names.add(ja);
    for (const n of names) nameToCode.set(n, code);
  }
  const sorted = [...nameToCode.keys()].sort((a, b) => a.localeCompare(b, 'ja'));
  for (const n of sorted) {
    const opt = document.createElement('option');
    opt.value = n;
    els.options.appendChild(opt);
  }
}

/* ---- カテゴリ切替 --------------------------------------------------- */

async function selectCategory(id: string): Promise<void> {
  const cat = catById(id);
  if (!cat) return;
  const token = ++loadToken;
  current = cat;
  expanded = false;
  renderSportTabs();
  renderGenderTabs();
  els.catUpdated.textContent = `最終更新: ${cat.updatedAt}`;
  els.sourceLine.innerHTML = `出典: <a href="${cat.sourceUrl}" target="_blank" rel="noopener">${cat.source}</a>${
    cat.license ? `(${cat.license})` : ''
  }`;

  latest = null;
  history = null;

  try {
    const l = await loadLatest(id);
    if (token !== loadToken) return;
    latest = l;
    drawTable();
  } catch {
    if (token !== loadToken) return;
    els.tbody.innerHTML = '<tr class="empty-row"><td colspan="4">データを読み込めませんでした</td></tr>';
    return;
  }

  try {
    const [h, mod] = await Promise.all([loadHistory(id), ensureChart()]);
    if (token !== loadToken) return;
    history = h;
    selected = defaultSelection();
    populateSearchOptions();
    renderAccumulatingNote();
    mod.renderChart(history, selected);
  } catch {
    if (token !== loadToken) return;
    showNote('推移データを読み込めませんでした');
  }
}

function drawTable(): void {
  if (!latest || !current) return;
  renderTable(els.tbody, els.expandBtn, latest, current.entity, expanded, () => {
    expanded = !expanded;
    drawTable();
  });
}

/* ---- 起動 ----------------------------------------------------------- */

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  return `データ更新: ${d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })} JST`;
}

async function boot(): Promise<void> {
  els.search.addEventListener('change', () => {
    const code = nameToCode.get(els.search.value.trim());
    if (code) {
      addTeam(code);
      els.search.value = '';
    }
  });
  els.resetBtn.addEventListener('click', () => {
    if (!history || !chartMod) return;
    selected = defaultSelection();
    renderAccumulatingNote();
    chartMod.renderChart(history, selected);
  });
  window.addEventListener('hashchange', () => {
    const id = currentHashId();
    if (id && id !== current?.id) void selectCategory(id);
  });

  index = await loadIndex();
  els.siteUpdated.textContent = formatGeneratedAt(index.generatedAt);
  const id = currentHashId();
  const first = (id && catById(id)) ? id : index.categories[0].id;
  await selectCategory(first!);
}

void boot();
