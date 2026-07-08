/**
 * Sponsor list rendered by `src/components/Sponsors.astro` in the strip right
 * below the site nav. To add a sponsor, drop its logo into `public/sponsors/`
 * and append an entry here.
 */

import type { Lang } from '../i18n/ui';

export interface Sponsor {
  id: string;
  name: string;
  /** Outbound (referral) link; the whole banner row links here. */
  url: Record<Lang, string>;
  /** Path under `public/`, e.g. `/sponsors/foo.png`. */
  logo: string;
  /** Intrinsic logo size, used to reserve space and avoid layout shift. */
  logoWidth: number;
  logoHeight: number;
  /** Bold lead-in shown before the tagline. */
  headline: Record<Lang, string>;
  /** One-line pitch per language. */
  tagline: Record<Lang, string>;
  /** Per-sponsor CTA button label. */
  cta: Record<Lang, string>;
}

export const SPONSORS: Sponsor[] = [
  {
    id: 'ergou',
    name: '二狗 API',
    url: {
      zh: 'https://ergouapi.com/r/gh-fuckclaude',
      en: 'https://ergouapi.com/r/gh-fuckclaude',
    },
    logo: '/sponsors/ergou-wordmark-340x112.png',
    logoWidth: 340,
    logoHeight: 112,
    headline: {
      zh: '接入二狗，稳如老狗。',
      en: 'The rock-solid AI API gateway.',
    },
    tagline: {
      zh: '全站 0.1x~0.2x 超低倍率，Claude/GPT/Gemini 等 100% 纯血大模型接口，顶级 IPLC 线路稳定低延迟',
      en: 'Ultra-low 0.1x–0.2x rates for 100% genuine Claude / GPT / Gemini endpoints over premium IPLC routes',
    },
    cta: {
      zh: '快来试试',
      en: 'Try it now',
    },
  },
  {
    id: 'roxy',
    name: 'Roxy浏览器',
    url: {
      zh: 'https://roxybrowser.cn/invite/0326196A',
      en: 'https://roxybrowser.com/invite/0326196A',
    },
    logo: '/sponsors/roxy-wordmark.jpg',
    logoWidth: 500,
    logoHeight: 200,
    headline: {
      zh: '指纹暴露你是中国用户？',
      en: 'Fingerprints flagging you as a China user?',
    },
    tagline: {
      zh: 'Roxy浏览器，一键伪装干净的海外环境，绕过 Claude 风控',
      en: 'RoxyBrowser fakes a clean overseas environment in one click and slips past Claude risk control',
    },
    cta: {
      zh: '免费使用',
      en: 'Use for free',
    },
  },
  {
    id: 'geek2api',
    name: 'Geek2API',
    url: {
      zh: 'https://hk.geek2api.com?ref=fuckclaude',
      en: 'https://hk.geek2api.com?ref=fuckclaude',
    },
    logo: '/sponsors/geek2api-wordmark-340x108.jpg',
    logoWidth: 340,
    logoHeight: 108,
    headline: {
      zh: '高校企业都在选择的超低倍率中转站。',
      en: 'The ultra-low-rate AI gateway universities & enterprises pick.',
    },
    tagline: {
      zh: 'Claude / GPT / Gemini / Image2 全模型接入，可开发票',
      en: 'Full Claude / GPT / Gemini / Image2 access, invoices available',
    },
    cta: {
      zh: '立即体验',
      en: 'Try it now',
    },
  },
  {
    id: 'hanhui',
    name: '瀚慧AI',
    url: {
      zh: 'https://shop.aishop.chat/',
      en: 'https://shop.aishop.chat/',
    },
    logo: '/sponsors/hanhui-wordmark.png',
    logoWidth: 328,
    logoHeight: 104,
    headline: {
      zh: 'Claude / GPT / Gemini 会员充值，正规可开票。',
      en: 'Claude / GPT / Gemini subscriptions, legit & invoiceable.',
    },
    tagline: {
      zh: '海外 AI 会员订阅、续费、升级服务，稳定交付，售后跟进，企业/高校/个人更省心',
      en: 'Overseas AI membership subscribe, renew & upgrade — reliable delivery with after-sales support for enterprises, universities & individuals',
    },
    cta: {
      zh: '立即选购',
      en: 'Shop now',
    },
  },
];
