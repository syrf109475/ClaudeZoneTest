// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `site` must match the real deployment origin so canonical URLs,
// hreflang links and the generated sitemap point to the correct domain.
export default defineConfig({
  site: 'https://claudezonetest.cfwap.syrf109475.top',
  output: 'static',
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          zh: 'zh-CN',
        },
      },
    }),
  ],
});
