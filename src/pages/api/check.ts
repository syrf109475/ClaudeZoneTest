/**
 * Server-side "China user" estimate, reachable over curl / HTTP.
 *
 * The in-browser scan reads OS-level signals (timezone, fonts, Intl locale, …)
 * that a plain HTTP request can't see. This endpoint instead estimates the risk
 * from what Vercel exposes about the request:
 *   - `x-vercel-ip-timezone` — IANA timezone of the requester's IP (the big one)
 *   - `x-vercel-ip-country`   — country of the requester's IP
 *   - `accept-language`       — browser/UA language preferences
 *   - `user-agent`            — OS/vendor guess for the emoji signal
 *
 * Fonts + Intl locale are browser-only, so the score is computed over the
 * measurable weight (70/100) and normalised to 0–100. It reuses the exact same
 * pure scorers as the client so results stay consistent.
 *
 * Response format:
 *   - curl / wget / httpie (or `?format=text`)  → pretty plain-text report
 *   - `Accept: application/json` (or `?format=json`) → JSON
 *   - `?lang=zh` / `?lang=en` (default: Accept-Language) → localised output
 *
 * Needs the Vercel adapter + on-demand rendering; geo headers are only present
 * on a real Vercel deployment (absent locally / on other hosts).
 */
import type { APIRoute } from 'astro';
import {
  SIGNALS,
  riskBand,
  scoreTimezone,
  scoreLanguages,
  scoreEmojiVendor,
  type RiskBand,
  type SignalId,
} from '../../config/signals';
import { useTranslations, type Lang } from '../../i18n/ui';

export const prerender = false;

const SITE = 'https://fuck-claude.vercel.app';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface SignalResult {
  id: SignalId;
  name: string;
  weight: number;
  measured: boolean;
  value: string | null;
  score: number | null;
  contribution: number;
}

interface Analysis {
  score: number;
  band: RiskBand;
  measuredWeight: number;
  totalWeight: number;
  rawContribution: number;
  geo: { country: string | null; timezone: string | null };
  signals: SignalResult[];
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean);
}

/** Minutes east of UTC for an IANA timezone (Asia/Shanghai → 480), or null. */
function tzOffsetEastMinutes(timeZone: string): number | null {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    const h = parseInt(m[2] ?? '0', 10);
    const min = parseInt(m[3] ?? '0', 10);
    return sign * (h * 60 + min);
  } catch {
    return null;
  }
}

function fmtOffset(min: number | null): string {
  if (min === null) return 'unknown';
  const sign = min >= 0 ? '+' : '-';
  const h = Math.abs(min) / 60;
  return `UTC${sign}${Number.isInteger(h) ? h : h.toFixed(1)}`;
}

function pickLang(url: URL, acceptLang: string[]): Lang {
  const q = (url.searchParams.get('lang') || '').toLowerCase();
  if (q === 'zh' || q === 'en') return q;
  return (acceptLang[0] || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function wantsText(url: URL, req: Request): boolean {
  const fmt = (url.searchParams.get('format') || '').toLowerCase();
  if (fmt === 'text' || fmt === 'txt') return true;
  if (fmt === 'json') return false;
  const accept = (req.headers.get('accept') || '').toLowerCase();
  if (accept.includes('application/json')) return false;
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  return /curl|wget|httpie|python-requests|libcurl|go-http-client|powershell/.test(ua);
}

function analyze(req: Request, lang: Lang): Analysis {
  const t = useTranslations(lang);
  const tz = req.headers.get('x-vercel-ip-timezone') || '';
  const country = req.headers.get('x-vercel-ip-country') || '';
  const acceptLang = parseAcceptLanguage(req.headers.get('accept-language') || '');
  const ua = req.headers.get('user-agent') || '';

  const offsetEast = tzOffsetEastMinutes(tz);
  const emoji = scoreEmojiVendor(ua);

  const measured: Partial<Record<SignalId, { value: string; score: number }>> = {
    timezone: { value: tz || 'unknown', score: scoreTimezone(tz) },
    language: { value: acceptLang.join(', ') || 'unknown', score: scoreLanguages(acceptLang) },
    timezoneOffset: { value: fmtOffset(offsetEast), score: offsetEast === 480 ? 0.7 : 0 },
    emoji: { value: `${emoji.vendor} style`, score: emoji.score },
  };

  let rawContribution = 0;
  let measuredWeight = 0;
  let totalWeight = 0;

  const signals: SignalResult[] = SIGNALS.map((s) => {
    totalWeight += s.weight;
    const m = measured[s.id];
    if (m) {
      const contribution = Math.round(m.score * s.weight);
      rawContribution += contribution;
      measuredWeight += s.weight;
      return {
        id: s.id,
        name: t(`signal.${s.id}.name`),
        weight: s.weight,
        measured: true,
        value: m.value,
        score: Math.round(m.score * 100) / 100,
        contribution,
      };
    }
    return {
      id: s.id,
      name: t(`signal.${s.id}.name`),
      weight: s.weight,
      measured: false,
      value: null,
      score: null,
      contribution: 0,
    };
  });

  const score = measuredWeight ? Math.round((rawContribution / measuredWeight) * 100) : 0;

  return {
    score,
    band: riskBand(score),
    measuredWeight,
    totalWeight,
    rawContribution,
    geo: { country: country || null, timezone: tz || null },
    signals,
  };
}

function jsonBody(a: Analysis, lang: Lang) {
  const t = useTranslations(lang);
  return {
    app: 'Fuck Claude',
    estimate: true,
    lang,
    score: a.score,
    band: a.band,
    verdict: t(`band.${a.band}.title`),
    message: t(`band.${a.band}.desc`),
    coverage: { measuredWeight: a.measuredWeight, totalWeight: a.totalWeight },
    geo: a.geo,
    signals: a.signals,
    note:
      lang === 'zh'
        ? '基于 IP 归属地与请求头的服务端估算,与浏览器端读取操作系统的检测结果可能不同;中文字体与 Intl locale 只能在浏览器里检测。'
        : 'Server-side estimate from IP geo + request headers; it can differ from the in-browser OS scan. Chinese fonts and Intl locale can only be measured in a browser.',
    docs: lang === 'zh' ? `${SITE}/zh/` : `${SITE}/`,
  };
}

function textBody(a: Analysis, lang: Lang): string {
  const t = useTranslations(lang);
  const L =
    lang === 'zh'
      ? {
          title: 'Fuck Claude — 你是「Claude 中国用户」吗?',
          tagline: '基于你的 IP 归属地 + 请求头的服务端估算。',
          score: '得分',
          verdict: '结论',
          measured: '可检测信号(服务端可见):',
          browserOnly: '无法通过 curl 检测(仅浏览器):',
          coverage: '覆盖率',
          coverageBody: `${a.measuredWeight}/${a.totalWeight} 权重可在服务端检测。`,
          geo: '归属地',
          note: '说明',
          noteBody: 'IP/请求头估算,与浏览器端读取系统的检测结果可能不同。',
          full: '完整浏览器检测',
          hintJson: 'JSON:追加 ?format=json',
          hintLang: '语言:自动跟随 Accept-Language 请求头',
          none: '无',
        }
      : {
          title: 'Fuck Claude — Are you a Claude "China user"?',
          tagline: 'Server-side estimate from your IP geo + request headers.',
          score: 'Score',
          verdict: 'Verdict',
          measured: 'Measured signals (server-visible):',
          browserOnly: "Can't be measured over curl (browser-only):",
          coverage: 'Coverage',
          coverageBody: `${a.measuredWeight}/${a.totalWeight} weight measurable server-side.`,
          geo: 'Geo',
          note: 'Note',
          noteBody: 'IP/header estimate; differs from the in-browser OS scan.',
          full: 'Full in-browser check',
          hintJson: 'JSON     → append ?format=json',
          hintLang: 'Language → follows your Accept-Language header',
          none: 'none',
        };

  const home = lang === 'zh' ? `${SITE}/zh/` : `${SITE}/`;
  const browserOnly = a.signals
    .filter((s) => !s.measured)
    .map((s) => `${s.name} (${s.weight})`);
  const geoStr = [a.geo.country, a.geo.timezone].filter(Boolean).join(' · ') || L.none;

  const lines: string[] = [];
  lines.push(L.title);
  lines.push(L.tagline);
  lines.push('');
  lines.push(`  ${L.score}: ${a.score} / 100  [${a.band.toUpperCase()}]`);
  lines.push(`  ${L.verdict}: ${t(`band.${a.band}.title`)} — ${t(`band.${a.band}.desc`)}`);
  lines.push('');
  lines.push(`  ${L.measured}`);
  for (const s of a.signals) {
    if (!s.measured) continue;
    const sign = s.contribution > 0 ? `+${s.contribution}` : `${s.contribution}`;
    lines.push(`    ${s.name} — ${s.value} → ${sign}`);
  }
  lines.push('');
  lines.push(`  ${L.browserOnly}`);
  lines.push(`    ${browserOnly.join(' · ') || L.none}`);
  lines.push('');
  lines.push(`  ${L.coverage}: ${L.coverageBody}`);
  lines.push(`  ${L.geo}: ${geoStr}`);
  lines.push(`  ${L.note}: ${L.noteBody}`);
  lines.push('');
  lines.push(`  ${L.full} → ${home}`);
  lines.push(`  ${L.hintJson}`);
  lines.push(`  ${L.hintLang}`);
  lines.push('');
  return lines.join('\n');
}

export const GET: APIRoute = ({ request, url }) => {
  const acceptLang = parseAcceptLanguage(request.headers.get('accept-language') || '');
  const lang = pickLang(url, acceptLang);
  const analysis = analyze(request, lang);

  if (wantsText(url, request)) {
    return new Response(textBody(analysis, lang), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        ...CORS,
      },
    });
  }

  return new Response(JSON.stringify(jsonBody(analysis, lang), null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
    },
  });
};

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });
