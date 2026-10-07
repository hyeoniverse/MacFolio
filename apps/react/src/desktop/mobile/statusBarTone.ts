// 휴대폰 상태 표시줄 글자 색을 그 밑에 실제로 그려진 화면에 맞춘다 (iOS처럼: 밝은 화면 위에는 검은 글자, 어두운 화면 위에는 흰 글자).
// 앱마다 정해 둔 값이 아니라, 상태 표시줄 밑 몇 군데의 요소를 찾아 바탕색을 읽는다.
import { useEffect, useState } from 'react';

export type StatusBarTone = 'light' | 'dark';

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

/** 읽은 바탕색들로 글자 색을 정한다: 평균 휘도가 어두우면 흰 글자(light). 읽은 색이 없으면 null */
export function toneFor(colors: (string | null)[]): StatusBarTone | null {
	const values = colors.map((color) => (color ? parseColor(color) : null)).filter((rgb) => rgb !== null);
	if (values.length === 0) return null;
	const average = values.reduce((sum, rgb) => sum + luminance(rgb), 0) / values.length;
	return average < 0.4 ? 'light' : 'dark';
}

/** 요소부터 부모로 올라가며 처음 만나는 칠한 바탕색 */
function paintedBackground(element: Element | null): string | null {
	for (let current = element; current; current = current.parentElement) {
		const color = current.ownerDocument.defaultView!.getComputedStyle(current).backgroundColor;
		if (parseColor(color)) return color;
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
	return paintedBackground(target);
}

/** 상태 표시줄 밑 세 군데(왼쪽 시계, 가운데, 오른쪽 아이콘)의 바탕색으로 글자 색을 정한다 */
export function sampleTone(bar: Element): StatusBarTone | null {
	const box = bar.getBoundingClientRect();
	const y = box.top + box.height / 2;
	return toneFor([0.15, 0.5, 0.85].map((at) => colorAt(document, box.left + box.width * at, y, bar)));
}

/** 다시 읽는 간격: 스크롤·크기 바뀜은 바로, 그 밖의 변화(애니메이션, iframe 안 스크롤)는 이만큼마다 */
const RESAMPLE_MS = 800;

/**
 * 켜져 있는 동안 상태 표시줄 밑을 읽어 글자 색을 정한다. 읽을 수 없으면 fallback.
 * key가 바뀌면(맨 앞 앱, 화면 모드) 바로 다시 읽는다
 */
export function useStatusBarTone(
	bar: React.RefObject<Element | null>,
	enabled: boolean,
	fallback: StatusBarTone,
	key: string
): StatusBarTone {
	const [tone, setTone] = useState<StatusBarTone>(fallback);
	useEffect(() => {
		if (!enabled) return;
		let frame = 0;
		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				if (bar.current) setTone(sampleTone(bar.current) ?? fallback);
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
	}, [bar, enabled, fallback, key]);
	return enabled ? tone : fallback;
}
