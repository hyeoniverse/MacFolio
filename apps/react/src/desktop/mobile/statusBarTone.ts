// 휴대폰 상태 표시줄과 홈 인디케이터의 색을 그 밑에 실제로 그려진 화면에 맞춘다
// (iOS처럼: 밝은 화면 위에는 검은색, 어두운 화면 위에는 흰색).
// 앱마다 정해 둔 값이 아니라, 막대 밑 몇 군데의 요소를 찾아 바탕색을 읽는다. 배경화면·사진처럼 그림이면 그림의 그 자리 색을 읽는다.
import { useEffect, useState } from 'react';

export type StatusBarTone = 'light' | 'dark';

type Rgb = [number, number, number];

/** rgba()의 불투명도 (없으면 1) */
function alphaOf(color: string): number {
	const match = color.match(/^rgba\(.*[\s,/]([\d.]+)\s*\)$/i);
	return match ? Number(match[1]) : 1;
}

/** 반투명한 색(위)을 밑의 색에 겹친 색 */
export function blend(top: Rgb, alpha: number, below: Rgb): Rgb {
	return top.map((channel, index) => Math.round(channel * alpha + below[index] * (1 - alpha))) as Rgb;
}

/** #rgb·#rrggbb·rgb()·rgba() 색을 [r, g, b]로. 투명하거나 읽을 수 없으면 null */
export function parseColor(color: string): [number, number, number] | null {
	const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit) : hex[1].match(/../g)!;
		return digits.map((pair) => parseInt(pair, 16)) as [number, number, number];
	}
	const rgb = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
	if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return null;
	return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

/** 상대 휘도 (WCAG, 0 검정 ~ 1 흰색) */
function luminance([r, g, b]: [number, number, number]): number {
	const [lr, lg, lb] = [r, g, b].map((value) => {
		const channel = value / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** 어두운 색인지 (그 위의 글자는 흰색). 상대 휘도가 0.4보다 낮으면 어둡다 */
export function isDarkColor(color: string): boolean {
	const rgb = parseColor(color);
	return rgb !== null && luminance(rgb) < 0.4;
}

/** 막대의 두 색 (흰색, 검은색 #1c1c1e)의 상대 휘도 */
const WHITE_LUMINANCE = 1;
const DARK_LUMINANCE = luminance([28, 28, 30]);

/** 두 휘도의 대비 (WCAG, 1 ~ 21) */
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * 흰색에 주는 덤. 대비만 보면 휘도 0.2 언저리(iOS 파랑 #3b82f6 같은 막대)부터 검은색이 근소하게 앞서는데,
 * iOS는 그런 파랑 위에 흰 글자를 쓴다. 덤을 주면 갈리는 자리가 휘도 0.24쯤이 되어, 파랑은 흰색, 베이지·회갈색(0.3)은 검은색이다
 */
const WHITE_BIAS = 1.3;

/**
 * 읽은 바탕색들로 막대의 색을 정한다: 바탕들과의 평균 대비가 더 큰 쪽 (흰색이면 light, 검은색이면 dark).
 * 휘도를 평균하지 않고 대비를 평균해서, 대부분 어둡고 한 군데만 밝으면 흰색이다. 읽은 색이 없으면 null
 */
export function toneFor(colors: (string | null)[]): StatusBarTone | null {
	const values = colors.map((color) => (color ? parseColor(color) : null)).filter((rgb) => rgb !== null);
	if (values.length === 0) return null;
	const average = (target: number) =>
		values.reduce((sum, rgb) => sum + contrast(luminance(rgb), target), 0) / values.length;
	return average(WHITE_LUMINANCE) * WHITE_BIAS >= average(DARK_LUMINANCE) ? 'light' : 'dark';
}

/** 그라데이션(background-image)의 첫 색: 사진 위의 어두운 띠처럼 바탕색 없이 그라데이션만 칠한 곳 */
export function gradientStart(image: string): string | null {
	if (!image.includes('gradient(')) return null;
	return image.match(/rgba?\([^)]*\)|#[0-9a-f]{3,6}\b/i)?.[0] ?? null;
}

/** 그림이 상자 안에 놓인 자리. fit은 CSS의 background-size / object-fit (cover·contain, 그 밖은 상자에 맞춰 늘인다) */
export function imageRect(
	box: { width: number; height: number },
	image: { width: number; height: number },
	fit: string
): { x: number; y: number; width: number; height: number } {
	if (fit !== 'cover' && fit !== 'contain') return { x: 0, y: 0, width: box.width, height: box.height };
	const scales = [box.width / image.width, box.height / image.height];
	const scale = fit === 'cover' ? Math.max(...scales) : Math.min(...scales);
	const width = image.width * scale;
	const height = image.height * scale;
	// 가운데 맞춤 (배경화면·사진은 모두 center)
	return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/** 줄여 그린 그림의 화소. 읽을 수 없는 그림(다른 사이트, 아직 불러오는 중)은 null */
interface Pixels {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

/** 그림마다 한 번만 줄여 그려 둔다 (주소 → 화소, 불러오는 중이면 'loading', 못 읽으면 null) */
const pixelCache = new Map<string, Pixels | 'loading' | null>();

/** 그림을 이만큼 폭으로 줄여 읽는다 (막대 밑 몇 점의 밝기만 보면 된다) */
const SAMPLE_WIDTH = 64;

function drawPixels(image: CanvasImageSource, width: number, height: number): Pixels | null {
	const w = Math.max(1, Math.min(SAMPLE_WIDTH, width));
	const h = Math.max(1, Math.round((height / width) * w));
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) return null;
	try {
		context.drawImage(image, 0, 0, w, h);
		return { width: w, height: h, data: context.getImageData(0, 0, w, h).data };
	} catch {
		// 다른 사이트의 그림(CORS 없음)은 읽을 수 없다
		return null;
	}
}

/** 주소의 그림 화소. 처음에는 불러오기만 시작하고 null (다음에 다시 읽을 때 쓴다) */
function pixelsOf(url: string): Pixels | null {
	const cached = pixelCache.get(url);
	if (cached !== undefined) return cached === 'loading' ? null : cached;
	pixelCache.set(url, 'loading');
	const image = new Image();
	image.crossOrigin = 'anonymous';
	image.decoding = 'async';
	image.onload = () => pixelCache.set(url, drawPixels(image, image.naturalWidth, image.naturalHeight));
	image.onerror = () => pixelCache.set(url, null);
	image.src = url;
	return null;
}

/** 그림의 (x, y) 자리 둘레 3×3 화소의 평균 색 */
function pixelColor(pixels: Pixels, x: number, y: number): Rgb | null {
	const sum: Rgb = [0, 0, 0];
	let count = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const px = Math.round(x * pixels.width) + dx;
			const py = Math.round(y * pixels.height) + dy;
			if (px < 0 || py < 0 || px >= pixels.width || py >= pixels.height) continue;
			const at = (py * pixels.width + px) * 4;
			if (pixels.data[at + 3] < 128) continue;
			sum[0] += pixels.data[at];
			sum[1] += pixels.data[at + 1];
			sum[2] += pixels.data[at + 2];
			count++;
		}
	}
	return count ? (sum.map((value) => Math.round(value / count)) as Rgb) : null;
}

/** 요소에 그려진 그림(<img>, 배경 url())의 (x, y) 화면 자리 색. 그림이 없거나 그 자리가 그림 밖이면 null */
function imageColorAt(element: Element, x: number, y: number): Rgb | null {
	const style = element.ownerDocument.defaultView!.getComputedStyle(element);
	const isImage = element instanceof HTMLImageElement;
	const url = isImage
		? element.currentSrc || element.src
		: (style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1] ?? null);
	const fit = isImage ? style.objectFit : style.backgroundSize.split(' ')[0];
	if (!url) return null;
	const pixels = pixelsOf(url);
	if (!pixels) return null;
	const box = element.getBoundingClientRect();
	const rect = imageRect(box, pixels, fit);
	const u = (x - box.left - rect.x) / rect.width;
	const v = (y - box.top - rect.y) / rect.height;
	if (u < 0 || v < 0 || u > 1 || v > 1) return null;
	return pixelColor(pixels, u, v);
}

/**
 * 요소부터 부모로 올라가며 처음 만나는 칠한 바탕 (그림, 바탕색, 없으면 그라데이션의 첫 색).
 * 반투명한 바탕(유리 위젯처럼)은 더 밑의 바탕에 겹쳐 본다
 */
function paintedBackground(element: Element | null, x: number, y: number): string | null {
	for (let current = element; current; current = current.parentElement) {
		const image = imageColorAt(current, x, y);
		if (image) return `rgb(${image.join(', ')})`;
		const style = current.ownerDocument.defaultView!.getComputedStyle(current);
		const color = parseColor(style.backgroundColor);
		if (color) {
			const alpha = alphaOf(style.backgroundColor);
			if (alpha >= 0.95) return style.backgroundColor;
			const below = paintedBackground(current.parentElement, x, y);
			const base = below ? parseColor(below) : null;
			return base ? `rgb(${blend(color, alpha, base).join(', ')})` : style.backgroundColor;
		}
		const start = gradientStart(style.backgroundImage);
		if (start && parseColor(start)) return start;
	}
	return null;
}

/**
 * 한 점 밑에 그려진 바탕색. skip(상태 표시줄)은 건너뛴다.
 * 같은 사이트의 iframe은 그 안으로 들어가 읽고, 다른 사이트의 iframe은 읽을 수 없어 iframe을 둘러싼 바탕을 읽는다
 */
function colorAt(doc: Document, x: number, y: number, skip: Element): string | null {
	const target = doc.elementsFromPoint(x, y).find((element) => !skip.contains(element)) ?? null;
	if (target instanceof HTMLIFrameElement) {
		try {
			const inner = target.contentDocument;
			if (inner) {
				const box = target.getBoundingClientRect();
				const color = colorAt(inner, x - box.left, y - box.top, skip);
				if (color) return color;
			}
		} catch {
			// 다른 사이트: 안을 읽을 수 없다
		}
	}
	return paintedBackground(target, x, y);
}

/** 막대를 가로질러 읽는 자리 (막대 폭에 대한 비율) */
export const ACROSS = [0.15, 0.5, 0.85];
/** 상태 표시줄의 시계 쪽과 아이콘 쪽. 배경화면은 왼쪽과 오른쪽 밝기가 크게 다를 수 있어 따로 읽는다 */
export const CLOCK_SIDE = [0.08, 0.15, 0.22];
export const ICONS_SIDE = [0.78, 0.85, 0.92];

/**
 * 막대 밑 몇 군데(points: 막대 폭에 대한 비율)의 바탕색으로 막대의 색을 정한다.
 * area를 주면 그 상자 안에서 읽는다 (홈 인디케이터는 누르는 자리가 화면 폭 전체라, 보이는 막대 밑만 읽는다)
 */
export function sampleTone(
	bar: Element,
	points: readonly number[] = ACROSS,
	area: Element | null = null
): StatusBarTone | null {
	const box = (area ?? bar).getBoundingClientRect();
	const y = box.top + box.height / 2;
	return toneFor(points.map((at) => colorAt(document, box.left + box.width * at, y, bar)));
}

/** 다시 읽는 간격: 스크롤·크기 바뀜은 바로, 그 밖의 변화(애니메이션, iframe 안 스크롤)는 이만큼마다 */
const RESAMPLE_MS = 800;

/**
 * 켜져 있는 동안 막대(상태 표시줄, 홈 인디케이터) 밑을 읽어 색을 정한다. 읽을 수 없으면 fallback.
 * key가 바뀌면(맨 앞 앱, 화면 모드) 바로 다시 읽는다
 */
export function useStatusBarTone(
	bar: React.RefObject<Element | null>,
	enabled: boolean,
	fallback: StatusBarTone,
	key: string,
	points: readonly number[] = ACROSS,
	area: React.RefObject<Element | null> | null = null
): StatusBarTone {
	const [tone, setTone] = useState<StatusBarTone>(fallback);
	useEffect(() => {
		if (!enabled) return;
		let frame = 0;
		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				if (bar.current) setTone(sampleTone(bar.current, points, area?.current ?? null) ?? fallback);
			});
		};
		update();
		document.addEventListener('scroll', update, { capture: true, passive: true });
		window.addEventListener('resize', update);
		const timer = setInterval(update, RESAMPLE_MS);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener('scroll', update, { capture: true });
			window.removeEventListener('resize', update);
			clearInterval(timer);
		};
	}, [bar, enabled, fallback, key, points, area]);
	return enabled ? tone : fallback;
}
