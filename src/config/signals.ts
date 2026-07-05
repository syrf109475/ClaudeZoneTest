/**
 * Signal definitions + weighting for the "China user" risk score.
 *
 * This module is isomorphic: the `detect()` functions touch browser APIs
 * (document / navigator / Intl) but are ONLY invoked on the client from
 * `src/scripts/detect.ts`, so nothing here runs during SSR.
 */

export type SignalId =
  | 'timezone'
  | 'timezoneOffset'
  | 'language'
  | 'intlLocale'
  | 'fonts'
  | 'emoji';

export interface DetectOutcome {
  /** Human-readable detected value. */
  raw: string;
  /** 0..1 "how China-like" similarity. */
  score: number;
}

export interface SignalDef {
  id: SignalId;
  /** Scoring weight; the six weights sum to 100. */
  weight: number;
  /** True when Claude Code's real mechanism actually reads this signal. */
  claudeUsed?: boolean;
  /** Inline SVG icon markup. */
  icon: string;
  detect: () => DetectOutcome;
}

export const CN_TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Urumqi',
  'Asia/Chongqing',
  'Asia/Chungking',
  'Asia/Harbin',
  'Asia/Kashgar',
];
export const CLAUDE_TIMEZONES = ['Asia/Shanghai', 'Asia/Urumqi'];
export const GREATER_CN_TIMEZONES = ['Asia/Hong_Kong', 'Asia/Macau', 'Asia/Taipei'];

const FONTS_SC = [
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  'SimSun',
  'NSimSun',
  'SimHei',
  'KaiTi',
  'FangSong',
  'DengXian',
  'PingFang SC',
  'Hiragino Sans GB',
  'STHeiti',
  'STSong',
  'Songti SC',
  'Source Han Sans CN',
  'Source Han Sans SC',
  'Noto Sans CJK SC',
  'Noto Serif CJK SC',
  'WenQuanYi Micro Hei',
  'WenQuanYi Zen Hei',
];
const FONTS_TC = [
  'Microsoft JhengHei',
  'PMingLiU',
  'MingLiU',
  'DFKai-SB',
  'PingFang TC',
  'PingFang HK',
  'Source Han Sans TW',
  'Noto Sans CJK TC',
];

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/** Pure timezone scoring, reused server-side against the Vercel geo timezone. */
export function scoreTimezone(tz: string): number {
  if (CLAUDE_TIMEZONES.includes(tz) || CN_TIMEZONES.includes(tz)) return 1;
  if (GREATER_CN_TIMEZONES.includes(tz)) return 0.6;
  return 0;
}

function detectTimezone(): DetectOutcome {
  const tz = getTimezone();
  return { raw: tz || 'unknown', score: scoreTimezone(tz) };
}

function detectTimezoneOffset(): DetectOutcome {
  const offset = new Date().getTimezoneOffset();
  const utcHours = -offset / 60;
  const sign = utcHours >= 0 ? '+' : '-';
  const raw = `UTC${sign}${Math.abs(utcHours)}`;
  return { raw, score: offset === -480 ? 0.7 : 0 };
}

function normLangs(): string[] {
  const list =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  return list.map((l) => (l || '').toLowerCase());
}

/** Pure language scoring, reused server-side against the Accept-Language header. */
export function scoreLanguages(langs: string[]): number {
  const list = langs.map((l) => (l || '').toLowerCase());
  const primary = list[0] || '';
  const isHansCN = (l: string) => l.startsWith('zh-cn') || l.includes('hans') || l === 'zh';
  const isHant = (l: string) =>
    l.startsWith('zh-tw') || l.startsWith('zh-hk') || l.startsWith('zh-mo') || l.includes('hant');
  if (isHansCN(primary)) return 1;
  if (isHant(primary)) return 0.5;
  if (list.some(isHansCN)) return 0.7;
  if (list.some((l) => l.startsWith('zh'))) return 0.4;
  return 0;
}

function detectLanguage(): DetectOutcome {
  const langs = normLangs();
  return { raw: langs.join(', ') || 'unknown', score: scoreLanguages(langs) };
}

function detectIntlLocale(): DetectOutcome {
  let locale = '';
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
  } catch {
    locale = '';
  }
  const l = locale.toLowerCase();
  let score = 0;
  if (l.startsWith('zh-cn') || l.includes('hans') || l === 'zh') score = 1;
  else if (l.startsWith('zh')) score = 0.5;
  return { raw: locale || 'unknown', score };
}

function isFontAvailable(font: string, ctx: CanvasRenderingContext2D): boolean {
  const testString = '中文字体检测ABCabc012';
  const size = '72px';
  const bases = ['monospace', 'sans-serif', 'serif'];
  return bases.some((base) => {
    ctx.font = `${size} ${base}`;
    const baseWidth = ctx.measureText(testString).width;
    ctx.font = `${size} "${font}", ${base}`;
    const testWidth = ctx.measureText(testString).width;
    return Math.abs(testWidth - baseWidth) > 0.5;
  });
}

function detectFonts(): DetectOutcome {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { raw: 'canvas unavailable', score: 0 };

  const sc = FONTS_SC.filter((f) => isFontAvailable(f, ctx));
  const tc = FONTS_TC.filter((f) => isFontAvailable(f, ctx));

  let score = 0;
  if (sc.length >= 1) score = Math.min(1, 0.75 + 0.08 * sc.length);
  else if (tc.length >= 1) score = 0.5;

  const hit = [...sc, ...tc];
  const raw = hit.length ? hit.slice(0, 4).join(', ') + (hit.length > 4 ? '…' : '') : 'none detected';
  return { raw, score };
}

/** Pure emoji-vendor guess, reused server-side against the User-Agent header. */
export function scoreEmojiVendor(probe: string): { vendor: string; score: number } {
  const p = probe.toLowerCase();

  let vendor = 'Unknown';
  if (/iphone|ipad|ipod|mac/.test(p)) vendor = 'Apple';
  else if (/android/.test(p)) vendor = 'Google';
  else if (/win/.test(p)) vendor = 'Microsoft';
  else if (/cros/.test(p)) vendor = 'Google';
  else if (/linux/.test(p)) vendor = 'Linux / Other';

  const vendorScore: Record<string, number> = {
    Apple: 0.25,
    Microsoft: 0.4,
    Google: 0.35,
    'Linux / Other': 0.5,
    Unknown: 0.4,
  };

  return { vendor, score: vendorScore[vendor] ?? 0.4 };
}

function detectEmoji(): DetectOutcome {
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  const { vendor, score } = scoreEmojiVendor(`${platform} ${ua}`);
  return { raw: `${vendor} style`, score };
}

const ICON = {
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  clockOffset:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4h4"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/></svg>',
  type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6V5h14v1M12 5v14M9 19h6"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/></svg>',
  smile:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.4 2 3.5 2 3.5-2 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>',
};

export const SIGNALS: SignalDef[] = [
  { id: 'timezone', weight: 30, claudeUsed: true, icon: ICON.clock, detect: detectTimezone },
  { id: 'language', weight: 24, icon: ICON.globe, detect: detectLanguage },
  { id: 'fonts', weight: 20, icon: ICON.type, detect: detectFonts },
  { id: 'intlLocale', weight: 10, icon: ICON.sliders, detect: detectIntlLocale },
  { id: 'timezoneOffset', weight: 8, icon: ICON.clockOffset, detect: detectTimezoneOffset },
  { id: 'emoji', weight: 8, icon: ICON.smile, detect: detectEmoji },
];

export type RiskBand = 'low' | 'medium' | 'high';

export function riskBand(total: number): RiskBand {
  if (total <= 30) return 'low';
  if (total <= 60) return 'medium';
  return 'high';
}

/** Per-signal verdict (drives colours + whether it counts as a "hit"). */
export function signalVerdict(score: number): RiskBand {
  if (score >= 0.6) return 'high';
  if (score >= 0.25) return 'medium';
  return 'low';
}
