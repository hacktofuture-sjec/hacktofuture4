import Script from 'next/script'

import { INTERNAL_THEME_STORAGE_KEY } from '@/components/theme/internal-theme-provider'

/**
 * Pre-hydration theme for protected routes — reduces flash. Runs only when this
 * layout segment is active (internal pages).
 */
export function InternalThemeScript() {
  const themeScript = `
    (function() {
      try {
        var k = ${JSON.stringify(INTERNAL_THEME_STORAGE_KEY)};
        var t = localStorage.getItem(k);
        if (t === 'light') {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        }
      } catch(e) {
        console.error('Theme script error:', e);
      }
    })();
  `;

  return (
    <Script id="internal-theme-hydration" strategy="beforeInteractive">
      {themeScript}
    </Script>
  );
}
