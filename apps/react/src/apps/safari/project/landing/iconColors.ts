// 프로젝트 아이콘의 픽셀에서 주요 색을 뽑는다 (랜딩 템플릿의 강조색 accent.ts가 쓴다)

interface Hsl {
	h: number;
	s: number;
	l: number;
}

function toHsl(r: number, g: number, b: number): Hsl {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return { h: h * 60, s, l };
}

/**
 * 그림의 픽셀에서 주요 색 두 가지 (채도 있는 색 우선, 너무 어둡거나 흰 것은 뺀다). 색이 없으면(흑백 아이콘) null.
 * 색상환을 15° 칸으로 나눠 채도만큼 무게를 더하고, 두 번째 색은 첫 색과 40° 넘게 떨어진 칸에서
 */
export function dominantColors(data: ArrayLike<number>): Hsl[] | null {
	const bins = Array.from({ length: 24 }, () => ({ weight: 0, h: 0, s: 0, l: 0, n: 0 }));
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 160) continue;
		const c = toHsl(data[i], data[i + 1], data[i + 2]);
		if (c.l < 0.16 || c.l > 0.9 || c.s < 0.22) continue;
		const bin = bins[Math.floor(c.h / 15) % 24];
		const weight = c.s * (1 - Math.abs(c.l - 0.5));
		bin.weight += weight;
		bin.h += c.h;
		bin.s += c.s;
		bin.l += c.l;
		bin.n += 1;
	}
	const ranked = bins
		.map((bin, i) => ({ ...bin, i }))
		.filter((bin) => bin.n > 0)
		.sort((a, b) => b.weight - a.weight);
	if (ranked.length === 0) return null;
	const avg = (bin: (typeof ranked)[number]): Hsl => ({ h: bin.h / bin.n, s: bin.s / bin.n, l: bin.l / bin.n });
	const first = avg(ranked[0]);
	const second = ranked.find((bin) => {
		const dh = Math.abs(bin.h / bin.n - first.h);
		return Math.min(dh, 360 - dh) >= 40 && bin.weight >= ranked[0].weight * 0.15;
	});
	return second ? [first, avg(second)] : [first];
}
