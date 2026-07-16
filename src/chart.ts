import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { LineSeriesOption } from 'echarts/charts';
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type { HistoryFile } from './types';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

type Option = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>;

/** dataviz 検証済みカテゴリカルパレット(ライト/ダーク) */
const SERIES_LIGHT = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
const SERIES_DARK = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];
export const MAX_SERIES = SERIES_LIGHT.length;

const darkMq = window.matchMedia('(prefers-color-scheme: dark)');

function ink(): { primary: string; secondary: string; muted: string; grid: string; surface: string } {
  const s = getComputedStyle(document.documentElement);
  return {
    primary: s.getPropertyValue('--ink').trim(),
    secondary: s.getPropertyValue('--ink-2').trim(),
    muted: s.getPropertyValue('--muted').trim(),
    grid: s.getPropertyValue('--grid').trim(),
    surface: s.getPropertyValue('--surface').trim(),
  };
}

export interface ChartSeriesDef {
  code: string;
  name: string; // 表示名(日本語優先)
  slot: number; // 0-7 固定カラースロット(エンティティに紐づく)
  /** ユーザーが明示追加した系列(または日本)。自動入れ替えの対象外 */
  pinned?: boolean;
}

let chart: echarts.ECharts | null = null;

export function initChart(el: HTMLElement): void {
  chart = echarts.init(el, undefined, { renderer: 'canvas' });
  window.addEventListener('resize', () => chart?.resize());
  darkMq.addEventListener('change', () => {
    // テーマ変更時は保持中のオプションを色だけ差し替えて再描画
    rerender?.();
  });
}

let rerender: (() => void) | null = null;

export function renderChart(history: HistoryFile, defs: ChartSeriesDef[]): void {
  if (!chart) return;
  rerender = () => renderChart(history, defs);

  const palette = darkMq.matches ? SERIES_DARK : SERIES_LIGHT;
  const c = ink();
  const dates = history.snapshots.map((s) => s.date);
  const fewPoints = dates.length < 3;

  const series: LineSeriesOption[] = defs.map((d) => {
    const data: [string, number][] = [];
    for (const s of history.snapshots) {
      const r = s.ranks[d.code];
      if (r != null) data.push([s.date, r]);
    }
    return {
      name: d.name,
      type: 'line',
      data,
      color: palette[d.slot % palette.length],
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: fewPoints ? 8 : 4,
      showSymbol: fewPoints,
      connectNulls: false,
      emphasis: { focus: 'series', lineStyle: { width: 3 } },
      blur: { lineStyle: { opacity: 0.12 }, itemStyle: { opacity: 0.12 } },
      endLabel: {
        show: true,
        formatter: (p) => `${p.seriesName}`,
        color: c.primary,
        fontSize: 11,
        distance: 6,
        width: 90,
        overflow: 'truncate',
      },
      labelLayout: { moveOverlap: 'shiftY' },
    };
  });

  // 長期データはデフォルトで直近10年に絞る(スライダーで全期間へ)
  let startPct = 0;
  if (dates.length > 1) {
    const first = Date.parse(dates[0]);
    const last = Date.parse(dates[dates.length - 1]);
    const spanYears = (last - first) / (365.25 * 24 * 3600 * 1000);
    if (spanYears > 12) startPct = (1 - 10 / spanYears) * 100;
  }

  const option: Option = {
    animationDuration: 300,
    grid: { left: 44, right: 110, top: 40, bottom: 64 },
    legend: {
      type: 'scroll',
      top: 6,
      left: 8,
      right: 8,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: c.secondary, fontSize: 11 },
      pageTextStyle: { color: c.secondary },
      pageIconColor: c.secondary,
      pageIconInactiveColor: c.grid,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.primary, fontSize: 12 },
      confine: true,
      formatter: (params) => {
        const list = (Array.isArray(params) ? params : [params])
          .filter((p) => p.value != null)
          .sort((a, b) => Number((a.value as [string, number])[1]) - Number((b.value as [string, number])[1]));
        if (list.length === 0) return '';
        const date = (list[0].value as [string, number])[0];
        const rows = list
          .map((p) => {
            const rank = (p.value as [string, number])[1];
            return `<div>${p.marker}${rank}位 ${p.seriesName}</div>`;
          })
          .join('');
        return `<div style="font-weight:700;margin-bottom:2px">${date}</div>${rows}`;
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: c.grid } },
      axisLabel: { color: c.muted, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      inverse: true,
      min: 1,
      minInterval: 1,
      axisLabel: { color: c.muted, fontSize: 11, formatter: '{value}位' },
      splitLine: { lineStyle: { color: c.grid } },
    },
    dataZoom: [
      { type: 'inside', start: startPct, end: 100 },
      {
        type: 'slider',
        start: startPct,
        end: 100,
        height: 24,
        bottom: 10,
        borderColor: c.grid,
        backgroundColor: 'transparent',
        fillerColor: darkMq.matches ? 'rgba(57,135,229,0.15)' : 'rgba(42,120,214,0.10)',
        handleStyle: { color: c.surface, borderColor: c.muted },
        textStyle: { color: c.muted, fontSize: 10 },
      },
    ],
    series,
  };

  chart.setOption(option, { notMerge: true });
}
