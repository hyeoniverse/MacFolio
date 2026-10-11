// dialogue 모양의 배경 장면을 그리는 픽셀 그림 도구: 글자 격자나 사각형 목록을 SVG 사각형으로 (모서리를 흐리지 않는다)

/** 칠할 사각형 하나: 색, x, y, 너비, 높이 (픽셀 칸 단위) */
export type Px = [fill: string, x: number, y: number, w: number, h: number];

/** 픽셀 그림 한 장: 크기(칸)와 사각형들 */
export interface Art {
	w: number;
	h: number;
	px: Px[];
}

/** 글자 격자 → 그림. '.'과 공백은 비우고, 같은 글자가 가로로 이어지면 한 사각형으로 묶는다 */
export function fromRows(rows: string[], colors: Record<string, string>): Art {
	const px: Px[] = [];
	rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const char = row[x];
			let end = x + 1;
			while (end < row.length && row[end] === char) end++;
			const fill = colors[char];
			if (fill) px.push([fill, x, y, end - x, 1]);
			x = end;
		}
	});
	return { w: Math.max(...rows.map((row) => row.length)), h: rows.length, px };
}

/** 정해진 씨앗으로 늘 같은 순서의 난수 (장면이 그릴 때마다 바뀌지 않게) */
export function seeded(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 칸 원: 가운데(cx, cy)와 반지름 r. color(dx, dy, 가로 반폭)가 칸마다 색을 정한다 (없으면 비움) */
export function disc(
	cx: number,
	cy: number,
	r: number,
	color: (dx: number, dy: number, half: number) => string | null
): Px[] {
	const out: Px[] = [];
	for (let dy = -r; dy <= r; dy++) {
		const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
		let fill: string | null = null;
		let start = -half;
		for (let dx = -half; dx <= half + 1; dx++) {
			const next = dx <= half ? color(dx, dy, half) : null;
			if (dx > -half && next === fill && dx <= half) continue;
			if (fill) out.push([fill, cx + start, cy + dy, dx - start, 1]);
			fill = next;
			start = dx;
		}
	}
	return out;
}

/** 그림을 CSS 배경으로 쓸 SVG 주소 (반복 무늬 타일) */
export function artUrl(art: Art, scale: number): string {
	const rects = art.px.map(
		([fill, x, y, w, h]) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'/>`
	);
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${art.w * scale}' height='${art.h * scale}' viewBox='0 0 ${art.w} ${art.h}' shape-rendering='crispEdges'>${rects.join('')}</svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
