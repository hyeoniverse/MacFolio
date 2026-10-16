import { describe, expect, it } from 'vitest';
import { DemoInputError, demoInput, failureLine, ProviderFailure, refuse, tryInOrder } from './demo.js';

describe('데모 입력', () => {
	it('검사 결과에서 값을 꺼내고, 맞지 않으면 첫 이유를 DemoInputError로 던진다', () => {
		expect(demoInput({ value: 1 })).toBe(1);
		expect(() => demoInput({ errors: ['비었습니다', '다른 이유'] })).toThrow(new DemoInputError('비었습니다'));
	});
});

describe('공급자 차례', () => {
	it('막은 공급자는 건너뛰고, 실패하면 다음으로, 처음 성공에서 멈춘다', async () => {
		const warned: string[] = [];
		const called: string[] = [];
		const result = await tryInOrder(
			['a', 'b', 'c', 'd'] as const,
			['a'],
			async (provider) => {
				called.push(provider);
				if (provider === 'b') throw new ProviderFailure('키가 없습니다');
				if (provider === 'c') throw new TypeError('fetch failed');
				return `값-${provider}`;
			},
			(message) => warned.push(message)
		);
		expect(called).toEqual(['b', 'c', 'd']);
		expect(result).toEqual({
			provider: 'd',
			value: '값-d',
			attempts: [
				{ provider: 'a', state: 'skip', reason: '막아 둠' },
				{ provider: 'b', state: 'fail', reason: '키가 없습니다' },
				{ provider: 'c', state: 'fail', reason: '연결하지 못했습니다' },
				{ provider: 'd', state: 'ok' },
			],
		});
		// 키·주소가 담길 수 있는 바깥 에러는 화면에 내보내지 않고 로그에만
		expect(warned).toEqual(['c: TypeError: fetch failed']);
		expect(failureLine(result.attempts, { a: 'A', b: 'B', c: 'C', d: 'D' })).toBe(
			'A: 막아 둠 · B: 키가 없습니다 · C: 연결하지 못했습니다'
		);
	});

	it('응답 코드를 사람이 읽을 이유로', () => {
		expect(refuse(new Response(null, { status: 403 })).message).toBe('키가 거절되었습니다');
		expect(refuse(new Response(null, { status: 456 })).message).toBe('사용 한도에 닿았습니다');
		expect(refuse(new Response(null, { status: 500 })).message).toBe('응답 500');
	});
});
