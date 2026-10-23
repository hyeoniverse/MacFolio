[한국어](../performance.md) | **English**

# Performance measurements

A record of measuring the first-visit performance of the site (macfolio.hyeoniverse.com), fixing the bottlenecks, and measuring again under the same conditions.

- Round 1: #319
- Rounds 2 and 3: #323
- Re-measurement and Round 4: October 23, 2026. The first measurement of production with Rounds 1–3 deployed, and a fix for the initial bundle that had grown again in the meantime

## Summary

Values measured locally under the same conditions. Median of 5 Lighthouse runs; items that varied widely between runs are given as ranges.

**Phone**

| Item                           | Before  | Round 1 | Round 2 | Round 3 | Round 4 (re-measured) |
| ------------------------------ | ------- | ------- | ------- | ------- | --------------------- |
| Lighthouse performance score   | 55      | 68      | 69~72   | 78~87   | **78~97**             |
| FCP (first contentful paint)   | 14.3s   | 4.0s    | 4.0s    | 3.2s    | **2.1~3.2s**          |
| LCP (largest contentful paint) | 25.7s   | 6.2s    | 5.8s    | 3.2s    | **2.1~4.5s**          |
| TBT (total blocking time)      | 115ms   | 0ms     | 0ms     | 0ms     | **0ms**               |
| Transfer size on first visit   | 4,893KB | 1,011KB | 725KB   | 483KB   | **485KB**             |
| Requests                       | 61      | 74      | 75      | 49      | **49**                |
| Transfer size through entering | 4,934KB | 1,053KB | 767KB   | 768KB   | **769KB**             |

**Desktop**

| Item                           | Before  | Round 1 | Round 2 | Round 3 | Round 4 (re-measured) |
| ------------------------------ | ------- | ------- | ------- | ------- | --------------------- |
| Lighthouse performance score   | 62      | 90      | 93      | 98      | **98~100**            |
| FCP                            | 2.5s    | 0.8s    | 0.8s    | 0.7s    | **0.7s**              |
| LCP                            | 5.8s    | 1.9s    | 1.7s    | 1.1s    | **0.7~1.1s**          |
| TBT                            | 9ms     | 0ms     | 0ms     | 0ms     | **0ms**               |
| Transfer size on first visit   | 9,050KB | 2,177KB | 1,848KB | 771KB   | **772KB**             |
| Requests                       | 111     | 101     | 102     | 49      | **49**                |
| Transfer size through entering | 9,065KB | 2,248KB | 1,895KB | 1,895KB | **1,897KB**           |

- CLS was already 0 before.
- Transfer sizes are compressed transfer sizes.
- "Transfer size on first visit" is what Lighthouse counts, up to before the loading screen is tapped.
- "Transfer size through entering" is what Playwright received until 3 seconds after tapping the loading screen.

Round 3 didn't remove transfer, it **deferred it until after entering**. The transfer size through entering is the same as Round 2. The desktop (the home screen on phones), which used to be hidden behind the loading screen, is rendered during the 2.5 seconds the progress bar fills after the tap.

The phone score varies widely between runs in both Round 3 and Round 4. In some runs the start prompt is counted again as LCP (4.5s). See [Reading the numbers](#reading-the-numbers) below.

![Before and after](../images/performance-chart.svg)

![Transfer size on first visit, by resource type](../images/performance-weight.svg)

### Production site

Values from running the same Lighthouse 5 times each against the production URL (Cloudflare). It's a real network, so the numbers vary more than locally.

| Item                         | Phone before | After Round 1 | After Round 3 (re-measured) | Desktop before | After Round 1 | After Round 3 (re-measured) |
| ---------------------------- | ------------ | ------------- | --------------------------- | -------------- | ------------- | --------------------------- |
| Lighthouse performance       | 53           | 73            | **98** (86~98)              | 60             | 89            | **97** (96~100)             |
| FCP                          | 15.0s        | 2.4s          | **1.9s** (1.8~3.3)          | 2.9s           | 0.9s          | **1.0s** (0.6~1.05)         |
| LCP                          | 31.5s        | 7.1s          | **1.9s** (1.8~3.3)          | 5.8s           | 2.1s          | **1.0s** (0.6~1.05)         |
| Transfer size on first visit | 6,342KB      | 1,239KB       | **602KB**                   | 7,134KB        | 3,229KB       | **889KB**                   |

- "Before" is main before #319 was deployed.
- "After Round 3" is production on October 23, 2026 (with the quote widget; Round 4's initial bundle fix not yet deployed).
- Production transfers about 100KB more on first visit than local. There are two reasons.
  - Cloudflare serves JS at a lower compression level than the local measurement server (maximum brotli). The same files are 10–15% larger.
  - The production Worker injects body content for search engines into the HTML. Local `index.html` 2KB → production 15KB.
- After entering, desktop transfers 1.9MB of images in production versus 1.0MB locally. The project content edited by the admin (on the server) goes into the Safari page that opens first.

### Phone with real throttling

Lighthouse's default (simulate) computes a slow network from a fast recording. Measuring with the browser actually slowed down (`--throttling-method=devtools`, same slow 4G and 4x CPU) gives this.

| Item                         | Before  | Round 2 | Round 3  | Round 4 (re-measured)      |
| ---------------------------- | ------- | ------- | -------- | -------------------------- |
| Lighthouse performance       | 65      | 78      | 92       | **100** (one of 5 runs 92) |
| FCP                          | 9.2s    | 1.2s    | 1.2~2.7s | **1.2s**                   |
| LCP                          | 12.1s   | 6.0s    | 1.2~2.7s | **1.2s**                   |
| Transfer size on first visit | 5,932KB | 782KB   | 483KB    | **485KB**                  |

From Round 3 on, LCP equals FCP. The first render (the Apple logo and start prompt in the HTML) is the largest content.

## Round 4: what the re-measurement found

Transfer on first visit grew again as features were added after Round 3 (phone 483KB → 505KB, desktop 771KB → 793KB). Opening the builds of the Round 3 merge (`3e0c919ca`) and current main the same way and comparing per-file transfer sizes, the only file that changed was the `boot` bundle (46KB → 65KB compressed).

| Cause                                                                                                      | Size                                 | Fix                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| The quote widget's (#330) 365 quotes (`desktop/widgets/quotes.ts`) were included in `boot` with the widget | 66KB source, `boot` +19KB compressed | Split the quote widget with `React.lazy` (`Widget.tsx`). It's received as a separate chunk when the widget first renders |

The quote widget only appears with the desktop after the loading screen is tapped, so there's no need to receive it ahead on the first visit. After the fix, `boot` is 47KB compressed and the first visit transfers 485KB on phone and 772KB on desktop, back to Round 3 levels.

Growth like this doesn't show up unless you measure. So the CI performance budget in [Remaining work](#remaining-work) has moved up in priority.

## How it was measured

### Conditions

- **Tools:** Lighthouse 12.8.2 (performance only), Playwright 1.64 (Chromium 156)
- **Phone:** Lighthouse defaults. Simulates slow 4G (150ms round trip, 1.6Mbps) and 4x CPU slowdown (simulated throttling)
- **Desktop:** `--preset=desktop` (40ms round trip, 10Mbps, CPU unchanged)
- **Server:** the built `dist` is served by a local static server (`apps/react/scripts/perf/serve.mjs`).
  - Text files are compressed with brotli.
  - Screen paths respond with `index.html`, and missing `/assets/*` with 404.
  - Same approach as the production Cloudflare Worker, but without the Worker's first-screen content injection (SEO) and CSP
- **Runs:** 5 runs each on the same computer, using the median. One at a time so they don't overlap with builds or other measurements. Measurements that overlapped with other work were discarded and re-run
- **Builds:**
  - Before: `52f493bb2` (#311 merged)
  - Round 1: #319
  - Rounds 2 and 3: builds applying Round 2 and then Round 3 on top of main after Round 1
  - Round 4: main on October 23, 2026 (`35ecb8006`) with the quote widget split applied

Production was measured by passing the production URL to the same `measure.mjs`.

### Reading the numbers

- **Phone FCP under simulate:**
  - Locally, before the first render (47ms), all 33 bundles listed for modulepreload (about 400KB) have already been received.
  - Simulate treats "what was received before the first render" as needed for the first render and computes the slow-network time from it. So phone FCP comes out in the 3-second range.
  - With real throttling, the HTML's first render is at 1.2s (table above). So look at both values for phone FCP.
- **Why phone LCP varies:**
  - In some runs, the start prompt re-rendered by React is counted again as LCP (4.5s).
  - It's the same text as the first render, so it shouldn't be a new LCP. The guess is that the text box grows slightly when the web font swaps in, but it hasn't been confirmed.
  - With real throttling, 4 out of 5 runs are 1.2s.
- **The local server is HTTP/1.1:**
  - It allows 6 concurrent connections, so the 33 bundles queue up.
  - Production (Cloudflare) is HTTP/2 and receives them together over one connection. This is also why production phone FCP (1.9s) is faster than local simulate (3.2s).

### Measuring again

```bash
pnpm build
cd apps/react
node scripts/perf/serve.mjs dist 4810 &
node scripts/perf/measure.mjs http://localhost:4810 perf.json 5
```

`measure.mjs` measures the following and saves the medians and per-run values as JSON.

- Runs Lighthouse N times each for phone and desktop (`pnpm dlx lighthouse@12.8.2`, using the Chrome Playwright downloaded).
- Measures entering N times with Playwright. Without throttling, it looks at:
  - time until the loading screen appears
  - time from the tap until the desktop (the home screen on phones) appears
  - transfer size up to that point
  - the JS heap

Options:

- Prefix with `THROTTLING=devtools` to measure with the browser actually slowed down.
- Pass the production URL (`https://macfolio.hyeoniverse.com`) instead of the local address to measure production.
- If the port is already in use, `serve.mjs` doesn't start, and `measure.mjs` ends up measuring whatever other server is on that port. Use a free port.

## Bottleneck analysis (before)

Lighthouse's request list and the build output before the fixes pointed to five causes.

| Cause                                            | Size (compressed)                      | Impact                                                                                               |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Body font `AppleSDGothicNeoR.ttf` (a full TTF)   | 3.8MB (1.7MB)                          | A third of the transfer. Text on the first screen waits for this font                                |
| Raw text of 199 blog posts in the initial bundle | 2.4MB (740KB)                          | `import.meta.glob(..., { eager: true })`, so it's loaded along even when the desktop icons import it |
| All app code in the initial bundle (`boot`)      | 890KB (250KB)                          | Only Notes, Finder and TextEdit were split out                                                       |
| Large images · videos                            | Icons 1.2MB, JPG wallpapers, video 1MB | 2560px icons, videos and poster images of the Safari page that opens first, all at once              |
| The loading screen rendered by JS                | -                                      | A black screen on phones for 14 seconds until the initial bundle was fully received                  |

In addition, the Music app received the first part of 7 MP3s on the first visit to find track lengths, and phones also received the desktop wallpaper (2048px) they never use.

## Fixes

### Round 1 (#319)

| Change                                                                                                                         | Reduction                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Every app is loaded when first opened (`lazy` in `apps/registry.ts`)                                                           | Initial bundle 250KB → 47KB (compressed)                               |
| Raw blog text is received when the list is first queried (`memo/repository/contentFiles.ts`)                                   | 740KB on first visit                                                   |
| Desktop icons and the Dock trash don't receive blog posts (`useLocations({ posts: false })`)                                   | 600KB on desktop first visit                                           |
| Repository docs: paths first, raw text when Finder opens them (`finder/docPaths.ts`)                                           | 75KB on first visit                                                    |
| Split the font into two woff2 pieces (`scripts/subset-font.py`, `unicode-range`)                                               | 1.7MB → 149KB (232KB more only when rare Hangul appears)               |
| Shrink app icons to 256px (`scripts/optimize-icons.py`)                                                                        | Icons 1,171KB → 428KB                                                  |
| Convert wallpapers to WebP (`scripts/optimize-wallpapers.py`)                                                                  | 7.9MB → 2.3MB (default desktop 563 → 348KB, phone 308 → 60KB)          |
| On phones, use the phone wallpaper for the background too (`index.css`)                                                        | 348KB on phone first visit                                             |
| Record track lengths ahead of time, and don't receive tracks before playback (`TRACK_SECONDS` in `music/library.ts`)           | MP3 heads (560KB in a production phone measurement)                    |
| Load project-page videos and poster images when they near the screen (`safari/project/useNearView.ts`)                         | 1MB of video and dozens of images on desktop first visit               |
| Loading-screen Apple logo as SVG instead of a font glyph, rendered by the HTML before scripts (`#boot-splash` in `index.html`) | Phone FCP 14.3s → 4.0s                                                 |
| List the `boot` bundle and its dependencies as modulepreload in `index.html` (`bootPreloadPlugin` in `vite.config.ts`)         | Bundles that were received only after `main` ran are received together |

The font puts the 2,350 KS X 1001 precomposed syllables plus Latin, punctuation and jamo in `core` (149KB), and the remaining 8,822 Hangul syllables in `ext` (232KB). Two `@font-face` rules with the same name are defined, and the browser receives `ext` only when a glyph isn't in `core`. The PDF résumé uses the TTF as is.

### Round 2 (#323)

| Change                                                                            | Reduction                                             |
| --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| App icons as 192px WebP (`scripts/optimize-icons.py`), with the screen using WebP | Icons 428KB → 51KB                                    |
| Music album art as 512px WebP                                                     | 742KB → 146KB                                         |
| The menu bar Apple logo as an SVG component (`shared/ui/AppleLogo.tsx`)           | Font Awesome brands 113KB on the desktop first screen |

The icon PNGs weren't deleted. Project content the admin saved on the server may still contain the old PNG URLs.

I also tried merging small shared modules into one bundle with Rolldown's `codeSplitting.groups` to reduce the bundle count. Dependent modules came along and produced a 672KB bundle; excluding dependencies pulled in every blog post (small modules) for 596KB, so it wasn't applied. Production is HTTP/2, so the cost of the bundle count is smaller there than locally.

### Round 3 (#323)

Through Round 2, the phone LCP element was the "Files" icon on the home screen. But on the first visit the loading screen ("Tap to start loading") covers the home screen, so this icon isn't visible. Chrome counts hidden elements as LCP candidates too. Running app code to render an invisible screen and receiving icons, widget images and weather used up the first visit's network and CPU.

| Change                                                                                                                      | Effect                                                             |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Render the desktop (the home screen on phones) after the loading screen is tapped (`App.tsx`, `onStart` of `LoadingScreen`) | Transfer before entering: phone 725 → 483KB, desktop 1,848 → 771KB |
| Include the start prompt in the HTML's first render (`#boot-splash`) too. "Tap" on phones, "Click" on desktop (media query) | LCP becomes the prompt the HTML renders first                      |
| If tapped before the scripts arrive, `theme-boot.js` records it and the loading screen starts as soon as it appears         | No need to tap twice                                               |

The desktop renders during the 2.5 seconds the progress bar fills after the tap, so it's visible as soon as the loading screen lifts. The time from the tap until the desktop appears grew from 0.13s to 0.17s, but that time is behind the loading screen.

### Round 4 (re-measurement)

See [Round 4: what the re-measurement found](#round-4-what-the-re-measurement-found) above. Splitting the quote widget with `React.lazy` brought the `boot` bundle back from 65KB to 47KB compressed.

### Problems fixed along the way

Switching apps to load when first opened broke 16 E2E tests.

- **The shell relied on an app's CSS.** The home indicator and app switcher use styles in `desktop/window/Window.css`, which is imported by the window frame (`Window.tsx`), and the window frame was imported only by apps. While apps were in the initial bundle, it happened to always be loaded. The shell (`Desktop.tsx`) now loads it from the start
- **The status bar color updates briefly late.** Right after an app opens, the app screen isn't there yet, so it reads the home screen color underneath. It re-reads every 0.8 seconds and catches up quickly
- **Tests checked too early.** Tests that counted list items or pressed shortcuts as soon as the window appeared now wait until the app has rendered. Notes receives the raw post bundle together with the app, so the list is never briefly empty

## Remaining work

- **CI performance budget:** measurements are manual for now. To keep the initial bundle from growing again as features are added, as in Round 4, CI should check upper limits for first-visit transfer size and the `boot` size
- **Phone LCP variance:** in some runs the start prompt is counted again as LCP when React re-renders the loading screen (4.5s). The cause hasn't been confirmed
- **Phone transfer after entering:** 769KB is unchanged. The 33 initial bundles and the Font Awesome solid font (117KB) remain. Since icon names can be picked in project content (on the server), it's hard to keep only the icons in use
- **Production measurement of Round 4:** measure the production URL again after deploying
