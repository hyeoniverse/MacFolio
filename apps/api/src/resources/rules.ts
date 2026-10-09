// 서버 자원 사용률과 Oracle Always Free 유휴 회수 위험. 파일을 읽는 일은 서비스가 하고, 여기서는 읽은 글자를 계산만 한다.
//
// Oracle은 7일 동안 아래가 모두 맞으면 Always Free 인스턴스를 유휴로 보고 회수할 수 있다:
//   CPU 사용률의 95퍼센타일 < 20%, 네트워크 사용률 < 20%, 메모리 사용률 < 20% (메모리는 A1 shape만)
// CPU는 95퍼센타일로, 네트워크·메모리는 Oracle이 어떻게 세는지 적혀 있지 않아 평균으로 잰다 (평균이 더 낮으니 위험을 덜 놓친다)

export const RECLAIM_THRESHOLD = 20;
/** 이만큼 아래면 '주의' (회수 기준에 가깝다) */
export const WARNING_MARGIN = 10;
export const RECLAIM_WINDOW_DAYS = 7;

export type MonitorMode = 'off' | 'free' | 'payg';

/** /proc/stat의 cpu 줄: 지금까지 쓴 시간과 쉰 시간 (jiffies) */
export interface CpuTimes {
	busy: number;
	idle: number;
}

export function parseCpuTimes(stat: string): CpuTimes | null {
	const line = stat.split('\n').find((row) => row.startsWith('cpu '));
	if (!line) return null;
	// user nice system idle iowait irq softirq steal (guest·guest_nice는 user에 이미 들어 있다)
	const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = line
		.trim()
		.split(/\s+/)
		.slice(1)
		.map(Number);
	if ([user, nice, system, idle].some((value) => !Number.isFinite(value))) return null;
	return { busy: user + nice + system + irq + softirq + steal, idle: idle + iowait };
}

/** 두 번 읽은 사이의 CPU 사용률 (%) */
export function cpuPercent(before: CpuTimes, after: CpuTimes): number | null {
	const busy = after.busy - before.busy;
	const total = busy + (after.idle - before.idle);
	return total > 0 ? round((busy / total) * 100) : null;
}

/** /proc/meminfo로 메모리 사용률 (%): 쓸 수 있는 양(MemAvailable)을 뺀 나머지 */
export function memoryPercent(meminfo: string): number | null {
	const value = (key: string) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1]);
	const total = value('MemTotal');
	const available = value('MemAvailable');
	if (!total || !Number.isFinite(available)) return null;
	return round(((total - available) / total) * 100);
}

/** /proc/net/dev로 받은 바이트와 보낸 바이트의 합 (lo 제외) */
export function networkBytes(netdev: string): number | null {
	let total = 0;
	let found = false;
	for (const line of netdev.split('\n').slice(2)) {
		const [name, rest] = line.split(':');
		if (!rest || name.trim() === 'lo') continue;
		const fields = rest.trim().split(/\s+/).map(Number);
		// 받은 바이트(0번째)와 보낸 바이트(8번째)
		if (Number.isFinite(fields[0]) && Number.isFinite(fields[8])) {
			total += fields[0] + fields[8];
			found = true;
		}
	}
	return found ? total : null;
}

/** 두 번 읽은 사이의 네트워크 속도 (Mbps). 카운터가 되돌아갔으면(재시작) null */
export function networkMbps(beforeBytes: number, afterBytes: number, seconds: number): number | null {
	if (seconds <= 0 || afterBytes < beforeBytes) return null;
	return round(((afterBytes - beforeBytes) * 8) / seconds / 1_000_000, 3);
}

export function percentile(values: number[], p: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export const average = (values: number[]) =>
	values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

export interface Sample {
	at: Date;
	cpu: number;
	memory: number;
	network: number;
}

export interface Condition {
	metric: 'cpu' | 'network' | 'memory';
	/** 어떻게 잰 값인지 (95퍼센타일, 평균) */
	measure: string;
	/** 사용률 (%) */
	value: number;
	/** 회수 기준 (이 아래면 기준에 걸린다) */
	threshold: number;
	below: boolean;
}

export interface ReclaimRisk {
	/** danger: 지금 회수 기준에 모두 걸린다, warning: 기준에 가깝다, safe: 여유가 있다, unknown: 잰 값이 없다 */
	level: 'danger' | 'warning' | 'safe' | 'unknown';
	conditions: Condition[];
	/** 계산에 쓴 기간 (일). 7일이 안 되면 그동안의 값으로 미리 본 것이다 */
	days: number;
}

/** A1 shape만 메모리 조건이 있다 */
export const checksMemory = (shape: string) => /\.A1\./i.test(shape);

/**
 * 최근 7일 표본으로 유휴 회수 위험을 정한다. 네트워크 사용률은 shape의 대역폭(networkMbps) 대비.
 * 모든 조건이 기준 아래면 danger, 모두 기준+여유 아래면 warning, 아니면 safe
 */
export function reclaimRisk(
	samples: Sample[],
	options: { shape: string; networkMbps: number; now: Date }
): ReclaimRisk {
	const since = options.now.getTime() - RECLAIM_WINDOW_DAYS * DAY_MS;
	const recent = samples.filter((sample) => sample.at.getTime() >= since);
	if (recent.length === 0) return { level: 'unknown', conditions: [], days: 0 };
	const first = Math.min(...recent.map((sample) => sample.at.getTime()));
	const days = round((options.now.getTime() - first) / DAY_MS);

	const cpu = percentile(
		recent.map((sample) => sample.cpu),
		95
	)!;
	const network = (average(recent.map((sample) => sample.network))! / options.networkMbps) * 100;
	const conditions: Condition[] = [
		{
			metric: 'cpu',
			measure: '95퍼센타일',
			value: round(cpu),
			threshold: RECLAIM_THRESHOLD,
			below: cpu < RECLAIM_THRESHOLD,
		},
		{
			metric: 'network',
			measure: '평균',
			value: round(network, 2),
			threshold: RECLAIM_THRESHOLD,
			below: network < RECLAIM_THRESHOLD,
		},
	];
	if (checksMemory(options.shape)) {
		const memory = average(recent.map((sample) => sample.memory))!;
		conditions.push({
			metric: 'memory',
			measure: '평균',
			value: round(memory),
			threshold: RECLAIM_THRESHOLD,
			below: memory < RECLAIM_THRESHOLD,
		});
	}
	const level = conditions.every((condition) => condition.below)
		? 'danger'
		: conditions.every((condition) => condition.value < condition.threshold + WARNING_MARGIN)
			? 'warning'
			: 'safe';
	return { level, conditions, days };
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** 한 시간 단위로 묶은 평균 (화면의 그래프) */
export function hourly(samples: Sample[]): { at: string; cpu: number; memory: number; network: number }[] {
	const buckets = new Map<number, Sample[]>();
	for (const sample of samples) {
		const hour = Math.floor(sample.at.getTime() / 3_600_000) * 3_600_000;
		buckets.set(hour, [...(buckets.get(hour) ?? []), sample]);
	}
	return [...buckets.entries()]
		.sort(([a], [b]) => a - b)
		.map(([hour, list]) => ({
			at: new Date(hour).toISOString(),
			cpu: round(average(list.map((sample) => sample.cpu))!),
			memory: round(average(list.map((sample) => sample.memory))!),
			network: round(average(list.map((sample) => sample.network))!, 3),
		}));
}

export function parseMonitorMode(value: string | undefined): MonitorMode {
	return value === 'free' || value === 'payg' ? value : 'off';
}
