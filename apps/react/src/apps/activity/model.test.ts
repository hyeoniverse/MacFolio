import { describe, expect, it } from 'vitest';
import { change, eventLabel, formatDuration, kstToday, labelOf, periodRange } from './model';

describe('활동 상태 보기의 값 바꾸기', () => {
	it('기간은 오늘(한국 시간)까지', () => {
		expect(kstToday(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07');
		expect(periodRange('today', '2026-10-07')).toEqual({ from: '2026-10-07', to: '2026-10-07' });
		expect(periodRange('7d', '2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-07' });
		expect(periodRange('30d', '2026-03-01')).toEqual({ from: '2026-01-31', to: '2026-03-01' });
	});

	it('앞 기간과 비교: 앞 기간이 없으면 비교하지 않는다', () => {
		expect(change(112, 100)).toEqual({ text: '+12%', direction: 'up' });
		expect(change(95, 100)).toEqual({ text: '-5%', direction: 'down' });
		expect(change(100, 100)).toEqual({ text: '0%', direction: 'same' });
		expect(change(5, 0)).toBeNull();
		expect(change(null, 3)).toBeNull();
	});

	it('머문 시간', () => {
		expect(formatDuration(161)).toBe('2분 41초');
		expect(formatDuration(42)).toBe('42초');
		expect(formatDuration(null)).toBe('–');
	});

	it('표의 이름: 앱 이름, 나라 이름, 빈 값', () => {
		expect(labelOf('app', 'memo')).toBe('메모');
		expect(labelOf('item', 'memo/hello')).toBe('메모 › hello');
		expect(labelOf('country', 'KR')).toBe('대한민국 (KR)');
		expect(labelOf('device', 'mobile')).toBe('모바일');
		expect(labelOf('referrer', '')).toBe('직접 들어옴');
		expect(labelOf('browser', '')).toBe('알 수 없음');
	});

	it('실시간 흐름의 한 줄', () => {
		const at = '2026-10-07T00:00:00Z';
		expect(eventLabel({ type: 'visit', app: null, item: null, at })).toBe('들어옴');
		expect(eventLabel({ type: 'app', app: 'safari', item: null, at })).toBe('Safari 열기');
		expect(eventLabel({ type: 'item', app: 'memo', item: 'hello', at })).toBe('메모 › hello 보기');
		expect(eventLabel({ type: 'link', app: null, item: 'github.com/hyeoniverse', at })).toBe(
			'github.com/hyeoniverse 누름'
		);
	});
});
