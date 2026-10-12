// friendly의 장식 그래프(앱 화면 모형, 숫자 카드)가 함께 쓰는 고정된 수: 같은 글자는 언제나 같은 모양
/** 글자에서 뽑는 고정된 수 (같은 프로젝트는 언제나 같은 그래프) */
export function seeded(text: string) {
	let h = 2166136261;
	for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	};
}
