import { describe, expect, it } from 'vitest';
import {
	cpuPercent,
	DAY_MS,
	hourly,
	memoryPercent,
	networkBytes,
	networkMbps,
	parseCpuTimes,
	parseMonitorMode,
	percentile,
	reclaimRisk,
	type Sample,
} from './rules.js';

describe('/proc 읽기', () => {
	it('CPU: 두 번 읽은 사이에 쓴 비율', () => {
		const before = parseCpuTimes('cpu  100 0 50 800 50 0 0 0 0 0\ncpu0 1 2 3 4\n')!;
		const after = parseCpuTimes('cpu  130 0 70 850 50 0 0 0 0 0\n')!;
		// 쓴 시간 +50, 쉰 시간 +50
		expect(cpuPercent(before, after)).toBe(50);
		expect(parseCpuTimes('없음')).toBeNull();
	});

	it('메모리: 쓸 수 있는 양을 뺀 나머지', () => {
		const meminfo = 'MemTotal:        1000000 kB\nMemFree:          100000 kB\nMemAvailable:     750000 kB\n';
		expect(memoryPercent(meminfo)).toBe(25);
		expect(memoryPercent('')).toBeNull();
	});

	it('네트워크: lo를 빼고 받은·보낸 바이트를 더하고, 초당 Mbps로', () => {
		const netdev = [
			'Inter-|   Receive                                                |  Transmit',
			' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
			'    lo: 999 1 0 0 0 0 0 0 999 1 0 0 0 0 0 0',
			'  eth0: 1000 10 0 0 0 0 0 0 500 5 0 0 0 0 0 0',
		].join('\n');
		expect(networkBytes(netdev)).toBe(1500);
		expect(networkMbps(0, 7_500_000, 60)).toBe(1);
		// 재시작으로 카운터가 되돌아가면 버린다
		expect(networkMbps(100, 50, 60)).toBeNull();
	});

	it('95퍼센타일', () => {
		const values = Array.from({ length: 100 }, (_, index) => index + 1);
		expect(percentile(values, 95)).toBe(95);
		expect(percentile([], 95)).toBeNull();
	});
});

describe('유휴 회수 위험', () => {
	const now = new Date('2026-10-10T00:00:00Z');
	const days = (count: number, cpu: number, network: number, memory = 50): Sample[] =>
		Array.from({ length: count * 24 }, (_, index) => ({
			at: new Date(now.getTime() - (index + 1) * 3_600_000),
			cpu,
			memory,
			network,
		}));
	const e2 = { shape: 'VM.Standard.E2.1.Micro', networkMbps: 50, now };

	it('CPU와 네트워크가 모두 20% 아래면 위험 (E2는 메모리를 보지 않는다)', () => {
		const risk = reclaimRisk(days(7, 3, 0.5), e2);
		expect(risk.level).toBe('danger');
		expect(risk.conditions.map((condition) => condition.metric)).toEqual(['cpu', 'network']);
		expect(risk.conditions[1].value).toBe(1);
		expect(risk.days).toBe(7);
	});

	it('하나라도 기준을 넘으면 위험이 아니고, 모두 기준에 가까우면 주의', () => {
		expect(reclaimRisk(days(7, 25, 0.5), e2).level).toBe('warning');
		expect(reclaimRisk(days(7, 60, 0.5), e2).level).toBe('safe');
	});

	it('CPU는 95퍼센타일: 가끔 높으면 기준을 넘는다', () => {
		const samples = days(7, 3, 0.5);
		samples.slice(0, 20).forEach((sample) => (sample.cpu = 90));
		expect(reclaimRisk(samples, e2).conditions[0].value).toBe(90);
	});

	it('A1은 메모리도 본다', () => {
		const risk = reclaimRisk(days(7, 3, 0.5, 60), { ...e2, shape: 'VM.Standard.A1.Flex' });
		expect(risk.conditions.map((condition) => condition.metric)).toEqual(['cpu', 'network', 'memory']);
		expect(risk.level).toBe('safe');
	});

	it('7일보다 오래된 표본은 쓰지 않고, 표본이 없으면 모른다', () => {
		const old = days(1, 3, 0.5).map((sample) => ({ ...sample, at: new Date(sample.at.getTime() - 10 * DAY_MS) }));
		expect(reclaimRisk(old, e2)).toEqual({ level: 'unknown', conditions: [], days: 0 });
		expect(reclaimRisk(days(2, 3, 0.5), e2).days).toBe(2);
	});
});

it('한 시간 단위로 묶는다', () => {
	const at = (minute: number) => new Date(Date.UTC(2026, 9, 10, 1, minute));
	const rows = hourly([
		{ at: at(0), cpu: 10, memory: 40, network: 1 },
		{ at: at(30), cpu: 20, memory: 60, network: 3 },
	]);
	expect(rows).toEqual([{ at: '2026-10-10T01:00:00.000Z', cpu: 15, memory: 50, network: 2 }]);
});

it('모드는 off·free·payg, 나머지는 off', () => {
	expect(parseMonitorMode('free')).toBe('free');
	expect(parseMonitorMode('payg')).toBe('payg');
	expect(parseMonitorMode('on')).toBe('off');
	expect(parseMonitorMode(undefined)).toBe('off');
});
