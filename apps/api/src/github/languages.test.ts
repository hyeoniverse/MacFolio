import { describe, expect, it } from 'vitest';
import { languageShares } from './languages.js';

const sum = (list: { percent: number }[]) =>
	Math.round(list.reduce((total, item) => total + item.percent, 0) * 10) / 10;

describe('languageShares', () => {
	it('많은 순서로, 비율은 소수 첫째 자리까지이고 합이 100이다', () => {
		const list = languageShares({ CSS: 2000, TypeScript: 7000, HTML: 1000 });
		expect(list).toEqual([
			{ name: 'TypeScript', bytes: 7000, percent: 70 },
			{ name: 'CSS', bytes: 2000, percent: 20 },
			{ name: 'HTML', bytes: 1000, percent: 10 },
		]);
	});

	it('반올림해도 합이 100이 되게 나머지가 큰 쪽에 0.1을 더한다', () => {
		const list = languageShares({ A: 1, B: 1, C: 1 });
		expect(list.map((item) => item.percent)).toEqual([33.4, 33.3, 33.3]);
		expect(sum(languageShares({ TypeScript: 724_301, CSS: 201_877, JavaScript: 70_004, HTML: 3_818 }))).toBe(100);
	});

	it('0.5% 미만과 여섯째 뒤의 언어는 Other 하나로 묶는다', () => {
		const list = languageShares({
			TypeScript: 50_000,
			CSS: 20_000,
			JavaScript: 10_000,
			HTML: 8_000,
			Shell: 6_000,
			Dockerfile: 5_000,
			Python: 900,
			Makefile: 100,
		});
		expect(list.map((item) => item.name)).toEqual([
			'TypeScript',
			'CSS',
			'JavaScript',
			'HTML',
			'Shell',
			'Dockerfile',
			'Other',
		]);
		expect(list.at(-1)).toMatchObject({ bytes: 1_000, percent: 1 });
		expect(sum(list)).toBe(100);

		const small = languageShares({ TypeScript: 99_800, Shell: 100, Batchfile: 100 });
		expect(small.map((item) => [item.name, item.percent])).toEqual([
			['TypeScript', 99.8],
			['Other', 0.2],
		]);
	});

	it('묶일 언어가 하나뿐이면 그 이름 그대로 둔다', () => {
		expect(languageShares({ TypeScript: 99_900, Shell: 100 }).map((item) => [item.name, item.percent])).toEqual([
			['TypeScript', 99.9],
			['Shell', 0.1],
		]);
	});

	it('빈 저장소나 모양이 틀린 응답은 빈 목록이고, 숫자가 아닌 값과 0바이트는 버린다', () => {
		expect(languageShares({})).toEqual([]);
		expect(languageShares(null)).toEqual([]);
		expect(languageShares([1, 2])).toEqual([]);
		expect(languageShares({ Go: 0, Rust: '12', C: 10 })).toEqual([{ name: 'C', bytes: 10, percent: 100 }]);
	});
});
