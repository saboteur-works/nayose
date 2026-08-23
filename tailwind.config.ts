import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 config.
 *
 * Token definitions live in `@theme` blocks inside the CSS entry point
 * (src/renderer/styles/index.css -> saboteur-base.css -> nayose-theme.css),
 * not here — that is the v4 convention this project follows, matching
 * the styles repo's own approach (see saboteur-styles/styles/storybook.css).
 * This file only declares content sources; it intentionally carries no
 * `theme.extend` colors, radii, spacing, or fonts, so nothing here can
 * diverge from saboteur-base.css.
 */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
} satisfies Config;
