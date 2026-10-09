import { describe, expect, it } from 'vitest';
import type { ResourceStatus } from './data';
import { batteryOf, usageLine } from './serverResources';

const free = (level: 'danger' | 'warning' | 'safe' | 'unknown'): ResourceStatus => ({
	mode: 'free',
	shape: 'VM.Standard.E2.1.Micro',
	networkMbps: 50,
	latest: { at: '2026-10-10T00:00:00Z', cpu: 3.24, memory: 41, network: 0.3 },
	risk: { level, conditions: [], days: 7 },
});

describe('메뉴 막대의 배터리 (서버 자원)', () => {
	it('지금 사용률 한 줄: 네트워크는 대역폭에 견준 비율', () => {
		expect(usageLine(free('safe'))).toBe('CPU 3.2% · 메모리 41% · 네트워크 0.6%');
		expect(usageLine({ mode: 'payg', latest: null })).toBeNull();
	});

	it('Always Free면 유휴 회수에서 먼 만큼 차 있다', () => {
		expect(batteryOf(free('safe'))).toMatchObject({ icon: 'fa-battery-full', fill: 100, tone: null });
		expect(batteryOf(free('warning'))).toMatchObject({ icon: 'fa-battery-quarter', tone: 'warning' });
		expect(batteryOf(free('danger'))).toMatchObject({
			icon: 'fa-battery-empty',
			tone: 'danger',
			summary: 'CPU 3.2% · 메모리 41% · 네트워크 0.6% · 유휴 회수 위험',
		});
		expect(batteryOf(free('unknown'))).toMatchObject({ icon: 'fa-battery-half', tone: null });
	});

	it('종량제·꺼짐·불러오는 중에는 평소 모양', () => {
		const plain = { icon: 'fa-battery-three-quarters', tone: null };
		expect(batteryOf({ ...free('danger'), mode: 'payg', risk: undefined })).toMatchObject({
			...plain,
			summary: 'CPU 3.2% · 메모리 41% · 네트워크 0.6%',
		});
		expect(batteryOf({ mode: 'off' })).toMatchObject({ ...plain, summary: '감시 꺼짐' });
		expect(batteryOf(null)).toMatchObject({ ...plain, summary: '불러오는 중' });
	});
});
