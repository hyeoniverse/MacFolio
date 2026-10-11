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

/**
 * 띠 그림을 세로줄(1칸 너비)로 칠하는 붓: 바로 옆 줄과 색·위치·높이가 같으면 한 사각형으로 넓혀 사각형 수를 줄인다.
 * 한 붓은 겹치지 않는 한 겹에만 쓴다 (겹이 바뀌면 새 붓)
 */
export function columns(px: Px[]) {
	const open = new Map<string, Px>();
	return (fill: string, x: number, y: number, h: number) => {
		if (h <= 0) return;
		const key = `${fill}|${y}|${h}`;
		const last = open.get(key);
		if (last && last[1] + last[3] === x) {
			last[3] += 1;
			return;
		}
		const rect: Px = [fill, x, y, 1, h];
		open.set(key, rect);
		px.push(rect);
	};
}

/** 그림을 좌우로 뒤집는다 */
export function mirror(art: Art): Art {
	return { ...art, px: art.px.map(([fill, x, y, w, h]) => [fill, art.w - x - w, y, w, h] as Px) };
}

/**
 * 그림의 색을 k가지 팔레트로 줄인다 (rgba 배열을 그 자리에서 고친다). 작은 k-평균:
 * 밝기 순으로 고르게 뽑은 색에서 시작해 몇 번 다듬는다. 넓은 면은 한 색으로 평평해지고 경계는 또렷하다
 */
export function quantize(data: Uint8ClampedArray | number[], k: number, rounds = 6) {
	const n = Math.floor(data.length / 4);
	if (n === 0) return;
	const lum = (i: number) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => lum(a) - lum(b));
	let centers: number[][] = [];
	for (let c = 0; c < k; c++) {
		const i = order[Math.min(n - 1, Math.floor(((c + 0.5) / k) * n))];
		const color = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
		if (!centers.some((d) => d[0] === color[0] && d[1] === color[1] && d[2] === color[2])) centers.push(color);
	}
	const owner = new Uint16Array(n);
	for (let round = 0; round <= rounds; round++) {
		for (let i = 0; i < n; i++) {
			let best = 0;
			let bestD = Infinity;
			for (let c = 0; c < centers.length; c++) {
				const dr = data[i * 4] - centers[c][0];
				const dg = data[i * 4 + 1] - centers[c][1];
				const db = data[i * 4 + 2] - centers[c][2];
				const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
				if (d < bestD) {
					bestD = d;
					best = c;
				}
			}
			owner[i] = best;
		}
		if (round === rounds) break;
		const sums = centers.map(() => [0, 0, 0, 0]);
		for (let i = 0; i < n; i++) {
			const sum = sums[owner[i]];
			sum[0] += data[i * 4];
			sum[1] += data[i * 4 + 1];
			sum[2] += data[i * 4 + 2];
			sum[3] += 1;
		}
		centers = centers.map((center, c) =>
			sums[c][3] ? [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]] : center
		);
	}
	for (let i = 0; i < n; i++) {
		const [r, g, b] = centers[owner[i]];
		data[i * 4] = Math.round(r);
		data[i * 4 + 1] = Math.round(g);
		data[i * 4 + 2] = Math.round(b);
	}
}
