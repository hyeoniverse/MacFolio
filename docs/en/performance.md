[한국어](../performance.md) | **English**

# Performance measurements

A record of measuring the first-visit performance of the site (macfolio.hyeoniverse.com), fixing what made it slow, and measuring again under the same conditions. As of October 22, 2026. Round 1 is #319; Rounds 2 and 3 are the PR that followed it (#323).

## Summary

Values measured locally under the same conditions (median of 5 Lighthouse runs).

**Phone**

| Metric                        | Before  | Round 1 | Round 2 | Round 3   |
| ----------------------------- | ------- | ------- | ------- | --------- |
| Lighthouse performance score  | 55      | 68      | 69~72   | **78~87** |
| FCP (first paint)             | 14.3s   | 4.0s    | 4.0s    | **3.2s**  |
| LCP (largest paint)           | 25.7s   | 6.2s    | 5.8s    | **3.2s**  |
| TBT (blocked time)            | 115ms   | 0ms     | 0ms     | **0ms**   |
| Downloaded on first visit     | 4,893KB | 1,011KB | 725KB   | **483KB** |
| Requests                      | 61      | 74      | 75      | **49**    |
| Downloaded through tapping in | 4,934KB | 1,053KB | 767KB   | 768KB     |

**Desktop**

| Metric                        | Before  | Round 1 | Round 2 | Round 3   |
| ----------------------------- | ------- | ------- | ------- | --------- |
| Lighthouse performance score  | 62      | 90      | 93      | **98**    |
| FCP (first paint)             | 2.5s    | 0.8s    | 0.8s    | **0.7s**  |
| LCP (largest paint)           | 5.8s    | 1.9s    | 1.7s    | **1.1s**  |
| TBT (blocked time)            | 9ms     | 0ms     | 0ms     | **0ms**   |
| Downloaded on first visit     | 9,050KB | 2,177KB | 1,848KB | **771KB** |
| Requests                      | 111     | 101     | 102     | **49**    |
| Downloaded through tapping in | 9,065KB | 2,248KB | 1,895KB | 1,895KB   |

CLS was already 0 before. Download sizes are compressed transfer sizes. "Downloaded on first visit" is what Lighthouse counted (before the loading screen is tapped); "through tapping in" is what Playwright downloaded up to 3 seconds after tapping the loading screen.

Round 3 doesn't eliminate downloads; it **defers them until after the tap**. The amount downloaded through tapping in is the same as Round 2. The desktop (the home screen on phones), which was hidden under the loading screen anyway, is now rendered during the 2.5 seconds the progress bar takes to fill after the tap. The phone Round 3 score split between 78 and 87 across the 5 runs (LCP of 3.2s vs 4.5s; see [Reading the numbers](#reading-the-numbers) below).

![Before and after](../images/performance-chart.svg)

![Downloaded on first visit, by type](../images/performance-weight.svg)

### Production site

Values from running the same Lighthouse 5 times each against the production URL (Cloudflare). It's a real network, so the numbers are noisier than local ones.

| Metric                    | Phone before | After Round 1 deploy | Desktop before | After Round 1 deploy |
| ------------------------- | ------------ | -------------------- | -------------- | -------------------- |
| Lighthouse performance    | 53           | **73**               | 60             | **89**               |
| FCP                       | 15.0s        | **2.4s**             | 2.9s           | **0.9s**             |
| LCP                       | 31.5s        | **7.1s**             | 5.8s           | **2.1s**             |
| Downloaded on first visit | 6,342KB      | **1,239KB**          | 7,134KB        | **3,229KB**          |

"Before" in production is main before #319 was deployed. On desktop, production downloads more images (2.2MB vs 1.0MB locally), because project content edited by the admin (on the server) goes into the Safari page that opens first. Round 2 will be added after it's deployed and measured again.

### Phone with real throttling

Lighthouse's default (simulate) computes a slow network from a fast recording. Actually slowing the browser down (`--throttling-method=devtools`, same slow 4G and 4x CPU) and running 3 times each gives this:

| Metric                    | Before  | Round 2 | Round 3      |
| ------------------------- | ------- | ------- | ------------ |
| Lighthouse performance    | 65      | 78      | **92**       |
| FCP                       | 9.2s    | 1.2s    | 1.2~2.7s     |
| LCP                       | 12.1s   | 6.0s    | **1.2~2.7s** |
| Downloaded on first visit | 5,932KB | 782KB   | **483KB**    |

In both Rounds 2 and 3, FCP came out as a mix of 1.2s and 2.7s across the 3 runs. In Round 3, LCP equals FCP: the first paint (the Apple logo and start prompt in the HTML) is itself the largest paint.

## Methodology

### Conditions

- **Tools:** Lighthouse 12.8.2 (performance only), Playwright 1.64 (Chromium 156)
- **Phone:** Lighthouse defaults. Emulates slow 4G (150ms round trip, 1.6Mbps) and 4x CPU slowdown (simulated throttling)
- **Desktop:** `--preset=desktop` (40ms round trip, 10Mbps, CPU unchanged)
- **Server:** the built `dist` is served by a local static server (`apps/react/scripts/perf/serve.mjs`). Text files are brotli-compressed, page routes get `index.html`, and missing `/assets/*` get 404. Same approach as the production Cloudflare Worker, but without the Worker's first-screen content injection (SEO) and CSP
- **Runs:** before and after were run 5 times each, back to back on the same machine, and the median is used. Runs were done one at a time so they didn't overlap with builds or other measurements
- **Before:** build of `52f493bb2` (#311 merge). **Round 1:** build of #319. **Rounds 2 and 3:** builds with Round 2, then Round 3, layered onto main after Round 1

The production site was measured by passing the production URL to the same `measure.mjs`.

### Reading the numbers

- **FCP under simulate:** locally, all 33 chunks (about 400KB) listed for preloading are fully downloaded before the first paint (47ms). Simulate treats "what was downloaded before the first paint" as required for the first paint and computes slow-network time from it, so phone FCP comes out at 4.0s. With real throttling, the HTML's first paint appears at 1.2s (table above). So for phone FCP, look at both values together
- **The local server is HTTP/1.1:** it downloads only 6 at a time. In the real-throttling measurement, the 33 chunks queued up and the last one finished at 5.1s. Production (Cloudflare) is HTTP/2, so they're downloaded together over one connection. I attribute production phone FCP (2.4s) being faster than local simulate (4.0s) to this as well

### Measuring again

```bash
pnpm build
cd apps/react
node scripts/perf/serve.mjs dist 4810 &
node scripts/perf/measure.mjs http://localhost:4810 perf.json 5
```

`measure.mjs` runs Lighthouse N times each for phone and desktop (`pnpm dlx lighthouse@12.8.2`, using the Chrome Playwright downloaded), and measures entering the site N times with Playwright. For entering, without throttling, it records the time until the loading screen appears and until the desktop (the home screen on phones) appears after tapping, the amount downloaded by then, and the JS heap. Results are saved as JSON with the medians and every individual value. Prefix with `THROTTLING=devtools` to measure with the browser actually slowed down, and pass the production URL (`https://macfolio.hyeoniverse.com`) in place of the address to measure production.

## What was slow

Lighthouse's request list and the build output before the fixes pointed to five causes.

| Cause                                            | Size (compressed)                      | Impact                                                                                                     |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Body font `AppleSDGothicNeoR.ttf` (one full TTF) | 3.8MB (1.7MB)                          | A third of the download. First-screen text waits for this font                                             |
| Source of all 199 blog posts in the first chunk  | 2.4MB (740KB)                          | Because of `import.meta.glob(..., { eager: true })`, it comes along even when only desktop icons import it |
| All app code in the first chunk (`boot`)         | 890KB (250KB)                          | Only Memo, Finder and TextEdit were split out                                                              |
| Large images and video                           | Icons 1.2MB, wallpaper JPGs, video 1MB | 2560px icons; the video and first-screen images of the Safari page that opens first, all at once           |
| The loading screen is drawn by JS                | -                                      | On phones, a black screen for 14 seconds until the first chunk finished downloading                        |

Besides that, the Music app downloaded the first part of seven MP3s on the first visit to measure track lengths, and phones also downloaded the desktop wallpaper (2048px) they never use.

## What was fixed

### Round 1 (#319)

| Change                                                                                                                                 | Saved                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Every app is loaded when first opened (`lazy` in `apps/registry.ts`)                                                                   | First chunk 250KB → 47KB (compressed)                                     |
| Blog sources are downloaded the first time the list is requested (`memo/repository/contentFiles.ts`)                                   | 740KB on first visit                                                      |
| Desktop icons and the Dock Trash don't download blog posts (`useLocations({ posts: false })`)                                          | 600KB on desktop first visit                                              |
| Repository docs: paths first, sources when Finder opens them (`finder/docPaths.ts`)                                                    | 75KB on first visit                                                       |
| Font split into two woff2 pieces (`scripts/subset-font.py`, `unicode-range`)                                                           | 1.7MB → 149KB (232KB more only when rare Hangul appears)                  |
| App icons at 256px (`scripts/optimize-icons.py`)                                                                                       | Icon files 1,171KB → 428KB                                                |
| Wallpapers as WebP (`scripts/optimize-wallpapers.py`)                                                                                  | Files 7.9MB → 2.3MB (default desktop 563 → 348KB, phone 308 → 60KB)       |
| On phones, the phone wallpaper for the background too (`index.css`)                                                                    | 348KB on phone first visit                                                |
| Track lengths are written down ahead of time, and tracks aren't downloaded before being tapped (`TRACK_SECONDS` in `music/library.ts`) | MP3 headers (560KB in the production phone measurement)                   |
| Video and first-screen images on project pages load when they come near the viewport (`safari/project/useNearView.ts`)                 | 1MB of video and dozens of images on desktop first visit                  |
| The loading screen's Apple logo is an SVG instead of a font glyph, drawn in HTML before scripts (`#boot-splash` in `index.html`)       | Phone FCP 14.3s → 4.0s                                                    |
| The `boot` chunk and the chunks it uses are preloaded in `index.html` (`bootPreloadPlugin` in `vite.config.ts`)                        | What used to be fetched only after `main` ran is now fetched alongside it |

The font puts the 2,350 precomposed KS X 1001 syllables plus Latin, punctuation and jamo in `core` (149KB), and the remaining 8,822 Hangul syllables in `ext` (232KB). There are two `@font-face` rules with the same name, and the browser downloads `ext` only when it can't find a character in `core`. The PDF résumé still uses the TTF as is.

### Round 2

| Change                                                                      | Saved                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------- |
| App icons as 192px WebP (`scripts/optimize-icons.py`); the UI uses the WebP | Icons 428KB → 51KB                                      |
| Music album art as 512px WebP                                               | 742KB → 146KB                                           |
| The menu bar's Apple logo as an SVG component (`shared/ui/AppleLogo.tsx`)   | Font Awesome brands, 113KB, on the desktop first screen |

The icon PNGs weren't deleted, because project content the admin saved on the server may contain the old PNG URLs.

To reduce the number of chunks, I also tried grouping small shared modules into one chunk with Rolldown's `codeSplitting.groups`. Their dependencies came along too and produced a 672KB chunk; excluding dependencies pulled in every individual blog post (small modules) and made it 596KB, so I dropped it. Production is HTTP/2, so the cost of many chunks is smaller there than locally.

### Round 3

Through Round 2, the phone LCP was the "Files" (파일) icon on the home screen. But on a first visit, the loading screen ("탭하여 로딩을 시작하세요", "Tap to start loading") covers the home screen, so this icon isn't visible. Chrome counts hidden elements as LCP too. The first visit was busy running app code and downloading icons, widget images and even weather just to draw a screen nobody could see.

| Change                                                                                                                                   | Effect                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The desktop (the home screen on phones) is drawn after the loading screen is tapped (`App.tsx`, `onStart` of `LoadingScreen`)            | Downloaded before tapping: phone 725 → 483KB, desktop 1,848 → 771KB |
| The start prompt is also put into the HTML's first paint (`#boot-splash`): "탭" (tap) on phones, "클릭" (click) on desktop (media query) | LCP becomes the prompt drawn early by the HTML                      |
| If tapped before the scripts arrive, `theme-boot.js` records it, and loading starts as soon as the loading screen appears                | No need to tap twice                                                |

The desktop is drawn during the 2.5 seconds the progress bar takes to fill after the tap, so it's visible as soon as the curtain lifts. The time from the tap until the desktop is attached to the page grew from 0.13s to 0.17s, but that time is behind the loading screen.

### Problems fixed along the way

Loading apps when first opened broke 16 E2E tests.

- **The shell was borrowing an app's CSS.** The home indicator and app switcher use styles from `desktop/window/Window.css`, but that CSS is imported by the window frame (`Window.tsx`), and the window frame was only imported by apps. While apps were in the first chunk, it happened to always be loaded. Now the shell (`Desktop.tsx`) loads it from the start
- **The status bar color is briefly late.** At the moment an app opens, its screen doesn't exist yet, so the color is read from the home screen underneath. It's re-read every 0.8 seconds, so it catches up quickly
- **Tests read too early.** Tests that counted list items or pressed shortcuts as soon as a window appeared now wait until the app has rendered. Memo downloads the post-source chunk together with the app, so there's never a moment where the list looks empty

## What's left

- **The phone score splits between 78 and 87:** sometimes (4.5s) the start prompt is picked up as LCP again when React redraws the loading screen. It's the same size as the first paint, so it shouldn't be a new LCP. My guess is that the text box grows slightly when the font swaps, but I haven't confirmed it yet
- **Phone after tapping:** the 768KB download is unchanged. The 33 first chunks and the Font Awesome solid font (117KB) remain. Since icon names can be chosen in project content (on the server), it's hard to keep only the glyphs that are used
- **Measuring Rounds 2 and 3 in production:** measure again against the production URL after deploying
- **Measuring in CI:** this is run by hand for now. A performance budget in CI (first-visit download size, etc.) would keep the site from getting heavy again
