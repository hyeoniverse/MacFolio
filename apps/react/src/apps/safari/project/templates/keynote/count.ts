// keynote 템플릿의 큰 숫자를 나누고 세는 순수 함수 (Figure.tsx가 쓴다, count.test.ts)

/** "1,800명", "92%", "4주", "v2.5"를 앞말·숫자·뒷말로 (숫자가 없으면 null) */
export function splitFigure(text: string): { before: string; number: string; after: string } | null {
	const match = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(text.trim());
	return match ? { before: match[1], number: match[2], after: match[3] } : null;
}

/** 0~1의 진행에 맞춰 숫자 글을 원래 모양(쉼표, 소수 자리)대로 */
export function partialFigure(number: string, t: number): string {
	const decimals = number.split('.')[1]?.length ?? 0;
	const target = Number(number.replace(/,/g, ''));
	const value = (target * t).toFixed(decimals);
	if (!number.includes(',')) return value;
	const [whole, fraction] = value.split('.');
	return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}
