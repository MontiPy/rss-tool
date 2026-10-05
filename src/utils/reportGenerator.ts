import { saveAs } from 'file-saver';
import { CalculationMode, ProjectData } from '../types';
import {
  calculateCapability,
  calculateTolerance,
  evaluateSpecLimit,
  getItemFloatFactor,
  getStackCenter,
  getStackNominal,
} from './rssCalculator';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (n: number, decimals = 4) => (Number.isFinite(n) ? n.toFixed(decimals) : '∞');

const MODE_LABELS: Record<CalculationMode, string> = {
  rss: 'RSS (Statistical)',
  worstCase: 'Worst-Case (Arithmetic)',
  monteCarlo: 'RSS (Statistical)',
};

/**
 * Build a self-contained, printable HTML report of every stack in the project.
 * Monte Carlo projects are reported with the deterministic RSS result.
 */
export function buildReportHTML(data: ProjectData, generatedAt: Date = new Date()): string {
  const unit = data.unit || 'mm';
  const mode = data.analysisSettings?.calculationMode || 'rss';
  const calcMode: CalculationMode = mode === 'worstCase' ? 'worstCase' : 'rss';
  const symmetric = data.toleranceMode === 'symmetric';
  const meta = data.metadata || {};
  const title = meta.projectName || 'Tolerance Stack Analysis';

  const metaRows = [
    ['Description', meta.description],
    ['Author', meta.author],
    ['Drawing Number', meta.drawingNumber],
    ['Revision', meta.revision],
    ['Units', unit],
    ['Tolerance Mode', symmetric ? 'Symmetric (±)' : 'Asymmetric (+/−)'],
    ['Calculation Mode', MODE_LABELS[mode] + (mode === 'monteCarlo' ? ' — Monte Carlo runs are not reproduced in reports' : '')],
    ['Generated', generatedAt.toLocaleString()],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('');

  const stacks = data.directions
    .map((dir) => {
      const header = `<h2>${escapeHtml(dir.name)}</h2>${dir.description ? `<p class="desc">${escapeHtml(dir.description)}</p>` : ''}`;
      if (dir.items.length === 0) {
        return `<section>${header}<p class="muted">No items.</p></section>`;
      }

      const result = calculateTolerance(dir.items, dir.id, dir.name, calcMode);
      const center = getStackCenter(dir.items, dir.targetNominal);
      const stackNominal = getStackNominal(dir.items);

      const summary: [string, string][] = [
        [`${MODE_LABELS[calcMode]} total`, symmetric ? `±${fmt(result.totalPlus)} ${unit}` : `+${fmt(result.totalPlus)} / −${fmt(result.totalMinus)} ${unit}`],
      ];
      if (calcMode === 'rss') {
        summary.push(['Worst-case total', `+${fmt(result.worstCasePlus!)} / −${fmt(result.worstCaseMinus!)} ${unit}`]);
      }
      summary.push(['Σ item nominals', `${fmt(stackNominal)} ${unit}`]);
      if (dir.targetNominal !== undefined) summary.push(['Target nominal', `${fmt(dir.targetNominal)} ${unit}`]);
      summary.push(['Predicted range', `${fmt(center - result.totalMinus)} to ${fmt(center + result.totalPlus)} ${unit}`]);

      const limitRow = (label: string, side: 'upper' | 'lower', limit?: number) => {
        if (limit === undefined) return '';
        const s = evaluateSpecLimit(side, limit, center, side === 'upper' ? result.totalPlus : result.totalMinus);
        const detail = s.exceedsBy > 0 ? ` — exceeds by ${fmt(s.exceedsBy)} ${unit}` : '';
        return `<tr><th>${label}</th><td>${fmt(limit)} ${unit} <span class="badge ${s.status}">${fmt(s.utilization, 1)}% used</span>${detail}</td></tr>`;
      };

      let capability = '';
      if (calcMode === 'rss') {
        const cap = calculateCapability(result.totalPlus, center, dir.usl, dir.lsl);
        if (cap) {
          const status = cap.currentCpk >= 1.33 ? 'pass' : cap.currentCpk >= 1 ? 'warning' : 'fail';
          capability =
            `<tr><th>Cpk</th><td><span class="badge ${status}">${fmt(cap.currentCpk, 2)}</span>` +
            `${cap.cp !== undefined ? ` &nbsp; Cp ${fmt(cap.cp, 2)}` : ''}</td></tr>` +
            `<tr><th>Estimated yield</th><td>${fmt(cap.currentYield, 4)}% (${fmt(cap.ppm, 1)} PPM)</td></tr>`;
        }
      }

      const itemRows = dir.items
        .map((item, i) => {
          const c = result.itemContributions[i];
          const tol = symmetric ? `±${fmt(item.tolerancePlus)}` : `+${fmt(item.tolerancePlus)} / −${fmt(item.toleranceMinus)}`;
          return `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td class="num">${fmt(item.nominal || 0)}</td>
            <td class="num">${tol}</td>
            <td class="num">${fmt(getItemFloatFactor(item), 3)}</td>
            <td class="num">${fmt(c.contributionPlus)}</td>
            <td class="num">${fmt(c.percentPlus, 1)}%</td>
            <td>${escapeHtml(item.source)}${item.notes ? `<div class="muted">${escapeHtml(item.notes)}</div>` : ''}</td>
          </tr>`;
        })
        .join('');

      return `<section>
        ${header}
        <table class="kv">
          ${summary.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')}
          ${limitRow('USL', 'upper', dir.usl)}
          ${limitRow('LSL', 'lower', dir.lsl)}
          ${capability}
        </table>
        <table class="items">
          <thead><tr><th>Item</th><th>Nominal</th><th>Tolerance</th><th>Float</th><th>Contribution</th><th>% of total</th><th>Source / Notes</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #222; margin: 24px auto; max-width: 960px; padding: 0 16px; font-size: 13px; }
  h1 { font-size: 22px; margin-bottom: 4px; } h2 { font-size: 17px; margin: 0 0 4px; border-bottom: 2px solid #1976d2; padding-bottom: 4px; }
  section { margin-top: 28px; page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { text-align: left; padding: 4px 8px; vertical-align: top; }
  table.kv th { width: 180px; color: #555; font-weight: 600; }
  table.items { border: 1px solid #ccc; } table.items th { background: #f3f6fa; border-bottom: 1px solid #ccc; }
  table.items td { border-top: 1px solid #eee; }
  .num { font-family: Consolas, Monaco, monospace; text-align: right; white-space: nowrap; }
  .muted, .desc { color: #666; } .desc { margin: 4px 0; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-weight: 600; font-size: 12px; }
  .badge.pass { background: #e6f4ea; color: #1e7e34; } .badge.warning { background: #fff4e5; color: #b26a00; } .badge.fail { background: #fdecea; color: #c62828; }
  .toolbar { text-align: right; } .toolbar button { padding: 6px 14px; font-size: 13px; cursor: pointer; }
  @media print { .toolbar { display: none; } body { margin: 0; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>${escapeHtml(title)}</h1>
  <table class="kv">${metaRows}</table>
  ${stacks}
</body></html>`;
}

/**
 * Open the report in a new tab (falls back to downloading it if pop-ups are blocked)
 */
export function openReport(data: ProjectData): void {
  const html = buildReportHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const name = (data.metadata?.projectName || 'tolerance-report').replace(/[^\w-]+/g, '_');
    saveAs(blob, `${name}.html`);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
