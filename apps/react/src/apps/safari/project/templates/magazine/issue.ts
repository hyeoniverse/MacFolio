// magazine 템플릿의 표지 글: 프로젝트 이름에서 제호를, 기간에서 호수 줄을 만든다 (issue.test.ts)

const pad = (n: number) => String(n).padStart(2, '0');

/** 표지 제호: 'OO – 설명'이면 앞말만 제호로, 뒷말은 제호 아래 작은 줄로 */
export const mastOf = (name: string) => {
	const [title, ...rest] = name.split(/\s+[–—-]\s+/);
	return { title: title || name, sub: rest.join(' – ') };
};

/** 호수 줄: '2025.03.04 – 2025.06.27' → '2025.03 – 06' (해가 다르면 '2025.11 – 2026.02') */
export function issueOf(period?: string): string {
	const dates = [...(period ?? '').matchAll(/(\d{4})[.\-/](\d{1,2})/g)].map((m) => ({ y: m[1], m: pad(Number(m[2])) }));
	let span = period?.trim() ?? '';
	if (dates.length >= 2) {
		const [a, b] = [dates[0], dates[dates.length - 1]];
		span = a.y === b.y ? `${a.y}.${a.m} – ${b.m}` : `${a.y}.${a.m} – ${b.y}.${b.m}`;
	} else if (dates.length === 1) span = `${dates[0].y}.${dates[0].m}`;
	return ['Vol. 1', span].filter(Boolean).join(' · ');
}
