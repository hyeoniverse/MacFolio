import React, { useEffect, useRef, useState } from 'react';

type Feature = 'translation' | 'summary' | 'cover' | 'tts';
/** cost: 요청 한 번에 쓰는 양 (번역은 글자, 음성은 바이트, 나머지는 번) */
const FEATURES: { key: Feature; label: string; providers: string[]; cost: number }[] = [
	{ key: 'translation', label: '번역', providers: ['DeepL', 'Google Translate', 'Gemini', 'Claude'], cost: 1_800 },
	{ key: 'summary', label: '요약', providers: ['Gemini', 'OpenAI', 'Claude'], cost: 1 },
	{ key: 'cover', label: '커버', providers: ['NanoBanana', 'Hugging Face'], cost: 1 },
	{ key: 'tts', label: '음성', providers: ['Fish Audio', 'Google Cloud TTS', 'Edge'], cost: 24_000 },
];

/** 실패 원인 (그 사이트의 FailureKind). fatal은 사람이 고쳐야 풀리는 원인 */
type Kind = 'network' | 'rate_limit' | 'server' | 'invalid_key' | 'expired' | 'forbidden' | 'quota' | 'billing';
const KINDS: Record<Kind, { label: string; fatal: boolean }> = {
	network: { label: '시간 초과', fatal: false },
	rate_limit: { label: '요청 속도 제한(429)', fatal: false },
	server: { label: '서버 오류(503)', fatal: false },
	invalid_key: { label: '키 오류(401)', fatal: true },
	expired: { label: '키 만료', fatal: true },
	forbidden: { label: '권한 없음(403)', fatal: true },
	quota: { label: '한도 초과', fatal: true },
	billing: { label: '결제 필요', fatal: true },
};
/** 같은 원인으로 이만큼 이어 실패하면 그 공급자를 끈다: 사람이 고쳐야 하는 원인은 3번, 저절로 풀릴 수 있는 원인은 5번 */
const FATAL_LIMIT = 3;
const TRANSIENT_LIMIT = 5;

/**
 * 공급자마다 미리 정해 둔 성향: 이번 달 사용량, 무료 한도(또는 한도 설명), 실패할 확률과 그때의 원인.
 * 응답은 무작위지만, 몇 번 보내다 보면 대체·한도 초과·자동으로 꺼짐·키 없음·앱 상한을 모두 겪게 짜 두었다
 */
type Profile = {
	used: number;
	unit: string;
	/** 한 달 무료 한도 (넘으면 한도 초과) */
	limit?: number;
	/** 이 앱이 스스로 멈추는 상한 (넘을 요청은 보내지 않는다) */
	cap?: number;
	/** 한도를 숫자로 모를 때의 설명 */
	note?: string;
	/** 키가 없으면 부르지 않고 건너뛴다 (실패로 세지 않는다) */
	noKey?: boolean;
	fail: number;
	kinds: Kind[];
	/** 화면에 보이는 성향 한 줄 */
	trait: string;
};
const PROFILES: Record<string, Profile> = {
	DeepL: {
		used: 482_000,
		limit: 500_000,
		unit: '자',
		fail: 0.1,
		kinds: ['network'],
		trait: '무료 한도 직전',
	},
	'Google Translate': {
		used: 61_000,
		limit: 500_000,
		unit: '자',
		fail: 0.6,
		kinds: ['rate_limit', 'server'],
		trait: '자주 불안정',
	},
	Gemini: {
		used: 214,
		unit: '번',
		note: '무료 등급은 분·하루 요청 수 제한',
		fail: 0.35,
		kinds: ['rate_limit'],
		trait: '가끔 429',
	},
	Claude: {
		used: 12,
		unit: '번',
		note: '무료 한도 없음 · 선불 크레딧',
		fail: 0.5,
		kinds: ['billing'],
		trait: '크레딧 바닥',
	},
	OpenAI: {
		used: 3,
		unit: '번',
		note: '무료 한도 없음 · 선불 크레딧',
		fail: 0.6,
		kinds: ['quota', 'expired'],
		trait: '키 만료 임박',
	},
	NanoBanana: { used: 0, unit: '번', note: '무료 한도 없음 · 유료', noKey: true, fail: 0, kinds: [], trait: '키 없음' },
	'Hugging Face': {
		used: 9,
		unit: '번',
		note: '월 무료 크레딧 소량',
		fail: 0.4,
		kinds: ['server', 'network'],
		trait: '모델 깨우는 중 503',
	},
	'Fish Audio': {
		used: 41_200,
		unit: '바이트',
		note: '2026-11-30까지 무료',
		fail: 0.25,
		kinds: ['network', 'forbidden'],
		trait: '가끔 시간 초과',
	},
	'Google Cloud TTS': {
		used: 776_000,
		limit: 1_000_000,
		cap: 800_000,
		unit: '바이트',
		fail: 0.05,
		kinds: ['server'],
		trait: '앱 상한 80만 직전',
	},
	Edge: { used: 31, unit: '번', note: '키 없이 무료', fail: 0.1, kinds: ['network'], trait: '키 없이 무료' },
};
type Health = { fatal: number; transient: number; last?: Kind };
const HEALTHY: Health = { fatal: 0, transient: 0 };
type Step = { name: string; outcome: string; ok?: boolean; skip?: boolean };

const isOff = (health: Health | undefined) =>
	!!health && (health.fatal >= FATAL_LIMIT || health.transient >= TRANSIENT_LIMIT);

/**
 * 공급자 고르기와 대체 차례, 사용량: 기능마다 기본 공급자와 대체 차례를 정하고, 이번 달 사용량을 무료 한도와 함께 본다.
 * 요청을 보내면 공급자마다 미리 정한 확률로 성공하거나 실패하고, 성공하면 사용량이 오른다. 같은 원인으로 이어 실패하면
 * 꺼지고, 다음 달로 넘기면 사용량과 한도·일시 오류로 꺼진 공급자가 풀린다 (키·결제 문제는 사람이 고쳐야 풀린다)
 */
export const Providers: React.FC = () => {
	const [feature, setFeature] = useState<Feature>('translation');
	const [orders, setOrders] = useState<Record<Feature, string[]>>(
		() => Object.fromEntries(FEATURES.map((item) => [item.key, item.providers])) as Record<Feature, string[]>
	);
	const [fallback, setFallback] = useState(true);
	const [usage, setUsage] = useState<Record<string, number>>(() =>
		Object.fromEntries(Object.entries(PROFILES).map(([name, profile]) => [name, profile.used]))
	);
	const [health, setHealth] = useState<Record<string, Health>>({});
	const [month, setMonth] = useState(10);
	const [busy, setBusy] = useState(false);
	const [trail, setTrail] = useState<Step[] | null>(null);
	const timer = useRef<number>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const current = FEATURES.find((item) => item.key === feature)!;
	const order = orders[feature];
	const move = (i: number, dir: number) => {
		const next = [...order];
		[next[i], next[i + dir]] = [next[i + dir], next[i]];
		setOrders((now) => ({ ...now, [feature]: next }));
		setTrail(null);
	};

	// 차례대로 시도한다: 꺼졌거나 키가 없거나 앱 상한에 닿으면 건너뛰고, 무료 한도를 넘을 요청은 한도 초과,
	// 나머지는 그 공급자의 확률로 성공하거나 실패한다. 성공하면 이어진 실패를 지우고 사용량을 더한다
	const send = () => {
		const steps: Step[] = [];
		const nextHealth = { ...health };
		const nextUsage = { ...usage };
		for (const name of fallback ? order : order.slice(0, 1)) {
			const profile = PROFILES[name];
			const state = nextHealth[name] ?? HEALTHY;
			const used = nextUsage[name];
			if (isOff(state)) {
				steps.push({ name, outcome: '꺼짐', skip: true });
				continue;
			}
			if (profile.noKey) {
				steps.push({ name, outcome: '키 없음', skip: true });
				continue;
			}
			if (profile.cap && used + current.cost > profile.cap) {
				steps.push({ name, outcome: '앱 상한이라 보내지 않음', skip: true });
				continue;
			}
			const kind: Kind | null =
				profile.limit && used + current.cost > profile.limit
					? 'quota'
					: Math.random() < profile.fail
						? profile.kinds[Math.floor(Math.random() * profile.kinds.length)]
						: null;
			if (kind) {
				const fatal = KINDS[kind].fatal;
				// 원인이 바뀌면 그 갈래의 횟수는 새로 센다
				nextHealth[name] = {
					fatal: fatal ? (state.last === kind ? state.fatal : 0) + 1 : state.fatal,
					transient: fatal ? state.transient : state.transient + 1,
					last: kind,
				};
				steps.push({ name, outcome: KINDS[kind].label });
				continue;
			}
			nextHealth[name] = HEALTHY;
			nextUsage[name] = used + current.cost;
			steps.push({ name, outcome: `+${current.cost.toLocaleString()}${profile.unit}`, ok: true });
			break;
		}
		setBusy(true);
		setTrail(null);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			setHealth(nextHealth);
			setUsage(nextUsage);
			setTrail(steps);
			setBusy(false);
		}, 500);
	};

	// 다음 달: 사용량은 0부터, 한도·일시 오류로 꺼진 공급자는 다시 시도한다. 키·결제·권한 문제는 그대로
	const nextMonth = () => {
		setMonth((now) => (now % 12) + 1);
		setUsage(Object.fromEntries(Object.keys(PROFILES).map((name) => [name, 0])));
		setHealth((now) =>
			Object.fromEntries(
				Object.entries(now).filter(([, state]) => state.last && KINDS[state.last].fatal && state.last !== 'quota')
			)
		);
		setTrail(null);
	};
	const handled = trail?.find((item) => item.ok);

	return (
		<div className="cm-providers">
			<div className="cm-row">
				<div className="cd-seg" role="group" aria-label="기능">
					{FEATURES.map((item) => (
						<button
							key={item.key}
							type="button"
							aria-pressed={feature === item.key}
							onClick={() => {
								setFeature(item.key);
								setTrail(null);
							}}
						>
							{item.label}
						</button>
					))}
				</div>
				<label className="cm-check">
					<input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} /> 실패하면
					다음 공급자로
				</label>
			</div>
			<ol className="cm-providers-list">
				{order.map((name, i) => {
					const profile = PROFILES[name];
					const used = usage[name];
					const ceiling = profile.cap ?? profile.limit;
					const ratio = ceiling ? Math.min(1, used / ceiling) : null;
					const state = health[name] ?? HEALTHY;
					const off = isOff(state);
					const step = trail?.find((item) => item.name === name);
					const amount = `이번 달 ${used.toLocaleString()}${ceiling ? ` / ${ceiling.toLocaleString()}` : ''}${profile.unit}`;
					return (
						<li
							key={name}
							data-off={off || undefined}
							data-idle={(!fallback && i > 0) || undefined}
							data-hit={step ? (step.ok ? 'ok' : step.skip ? 'skip' : 'fail') : undefined}
						>
							<span className="cm-providers-rank">{i === 0 ? '기본' : `대체 ${i}`}</span>
							<div className="cm-providers-name">
								<b>
									{name} <em>{profile.trait}</em>
								</b>
								<small>
									{off
										? `꺼짐 · ${state.last ? KINDS[state.last].label : ''} ${
												state.fatal >= FATAL_LIMIT ? FATAL_LIMIT : TRANSIENT_LIMIT
											}번 이어져`
										: profile.noKey
											? `키가 없어 건너뜁니다 · ${profile.note}`
											: `${amount}${profile.cap ? ' (앱 상한)' : ''}${profile.note ? ` · ${profile.note}` : ''}${
													state.fatal || state.transient
														? ` · 이어진 실패 ${
																state.last && KINDS[state.last].fatal
																	? `${state.fatal}/${FATAL_LIMIT}`
																	: `${state.transient}/${TRANSIENT_LIMIT}`
															}`
														: ''
												}`}
								</small>
								{ratio !== null && (
									<i className="cm-providers-bar" data-high={ratio > 0.75 || undefined}>
										<i style={{ width: `${ratio * 100}%` }} />
									</i>
								)}
							</div>
							<div className="cm-providers-tools">
								<button type="button" aria-label={`${name} 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
									<i className="fa-solid fa-chevron-up" />
								</button>
								<button
									type="button"
									aria-label={`${name} 아래로`}
									disabled={i === order.length - 1}
									onClick={() => move(i, 1)}
								>
									<i className="fa-solid fa-chevron-down" />
								</button>
								{/* 꺼진 공급자는 키를 바꾸거나 직접 다시 켠다. 자리는 늘 잡아 둬 칸 폭이 바뀌지 않는다 */}
								<button
									type="button"
									className="cm-providers-revive"
									aria-label={`${name} 다시 켜기`}
									disabled={!off}
									onClick={() => setHealth((now) => ({ ...now, [name]: HEALTHY }))}
								>
									다시 켜기
								</button>
							</div>
						</li>
					);
				})}
			</ol>
			<div className="cm-row">
				<button type="button" className="cd-primary" onClick={send} disabled={busy}>
					{busy ? '보내는 중…' : '요청 보내기'}
				</button>
				<button type="button" className="cd-ghost" onClick={nextMonth}>
					{(month % 12) + 1}월로 넘기기
				</button>
			</div>
			<p className="cm-result" role="status" data-kind={trail ? (handled ? 'ok' : 'conflict') : undefined}>
				{trail
					? `${trail.map((item) => `${item.name} ${item.outcome}`).join(' → ')}${
							handled
								? ` · ${handled.name}에서 처리했습니다`
								: fallback
									? ' · 모든 공급자가 실패해 관리자 알림에 남습니다'
									: ' · 대체를 꺼서 여기서 실패합니다'
						}`
					: '공급자마다 성향이 달라, 여러 번 보내 보면 대체·한도 초과·자동으로 꺼짐·키 없음·앱 상한을 모두 겪습니다'}
			</p>
		</div>
	);
};
