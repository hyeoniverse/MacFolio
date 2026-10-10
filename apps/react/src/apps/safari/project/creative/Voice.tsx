import React, { useState, useEffect, useRef } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { env } from '@/shared/config/env';
import { cheer } from './demoEvent';

type Provider = 'fish' | 'google' | 'edge';
type ProviderState = 'idle' | 'trying' | 'fail' | 'ok' | 'skip';
const PROVIDERS: Provider[] = ['fish', 'google', 'edge'];
const PROVIDER_NAME: Record<Provider, string> = { fish: 'Fish', google: 'Google', edge: 'Edge' };

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** 음성 만들기: 한 번에 읽는 글자 수 (서버도 같은 값으로 막는다) */
const MAX_SPEECH_CHARS = 80;
const SPEECH_DEFAULT = {
	ko: '지금 들으시는 목소리는 방금 이 글로 만든 음성입니다.',
	en: 'The voice you hear was generated from this text just now.',
};
type Attempt = { provider: Provider; state: 'ok' | 'fail' | 'skip'; reason?: string };

/**
 * 음성 만들기: 쓴 글을 MacFolio API가 Fish → Google → Edge 차례로 실제 음성으로 만든다.
 * 공급자를 눌러 막아 두면 그 공급자를 건너뛰어, 실패하면 다음으로 넘어가는 대체 순서를 실제로 볼 수 있다.
 * 비용 때문에 80자까지, IP마다 하루 3번(사이트 전체 50번)
 */
export const Voice: React.FC = () => {
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [text, setText] = useState(SPEECH_DEFAULT.ko);
	const [blocked, setBlocked] = useState<Provider[]>([]);
	const [states, setStates] = useState<Record<Provider, ProviderState>>({ fish: 'idle', google: 'idle', edge: 'idle' });
	const [reasons, setReasons] = useState<Partial<Record<Provider, string>>>({});
	const [running, setRunning] = useState(false);
	const [made, setMade] = useState<{ provider: Provider; text: string } | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [quota, setQuota] = useState<{ remaining: number; perIp: number; total: number } | null>(null);
	const [time, setTime] = useState(0);
	const [length, setLength] = useState(0);
	const [playing, setPlaying] = useState(false);
	const audio = useRef<HTMLAudioElement | null>(null);
	const objectUrl = useRef<string | null>(null);
	const timers = useRef<number[]>([]);
	const api = env.apiUrl;

	useEffect(() => {
		if (!api) return;
		const controller = new AbortController();
		fetch(`${api}/speech`, { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => data && setQuota(data))
			.catch(() => undefined);
		return () => controller.abort();
	}, [api]);
	useEffect(
		() => () => {
			timers.current.forEach((timer) => window.clearTimeout(timer));
			audio.current?.pause();
			if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
		},
		[]
	);

	const player = () => {
		if (audio.current) return audio.current;
		const el = new Audio();
		el.ontimeupdate = () => setTime(el.currentTime);
		el.onloadedmetadata = () => setLength(el.duration);
		el.onplay = () => setPlaying(true);
		el.onpause = () => setPlaying(false);
		el.onended = () => setPlaying(false);
		audio.current = el;
		return el;
	};

	/** 서버가 알려 준 시도 결과를 한 공급자씩 차례로 보여 준다 */
	const reveal = (attempts: Attempt[], done: () => void) => {
		attempts.forEach((attempt, i) => {
			timers.current.push(
				window.setTimeout(() => {
					setStates((now) => ({ ...now, [attempt.provider]: attempt.state }));
					if (attempt.reason) setReasons((now) => ({ ...now, [attempt.provider]: attempt.reason }));
					if (i === attempts.length - 1) done();
				}, i * 350)
			);
		});
		if (!attempts.length) done();
	};

	const make = async () => {
		if (!api) {
			setMessage('이 화면에는 음성을 만들 서버가 연결되어 있지 않습니다.');
			return;
		}
		timers.current.forEach((timer) => window.clearTimeout(timer));
		audio.current?.pause();
		setRunning(true);
		setMade(null);
		setMessage(null);
		setReasons({});
		setTime(0);
		const first = PROVIDERS.find((provider) => !blocked.includes(provider));
		setStates({
			fish: blocked.includes('fish') ? 'skip' : first === 'fish' ? 'trying' : 'idle',
			google: blocked.includes('google') ? 'skip' : first === 'google' ? 'trying' : 'idle',
			edge: blocked.includes('edge') ? 'skip' : first === 'edge' ? 'trying' : 'idle',
		});
		cheer('voice', 'busy');
		try {
			const response = await fetch(`${api}/speech`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, lang, skip: blocked }),
			});
			const data = (await response.json().catch(() => ({}))) as {
				provider?: Provider;
				attempts?: Attempt[];
				audio?: string;
				remaining?: number;
				message?: string | string[];
			};
			if (typeof data.remaining === 'number') setQuota((now) => (now ? { ...now, remaining: data.remaining! } : now));
			if (!response.ok || !data.audio || !data.provider) {
				const reason = Array.isArray(data.message) ? data.message[0] : data.message;
				reveal(data.attempts ?? [], () => {
					setRunning(false);
					cheer('voice', 'error');
					setMessage(reason ?? '음성을 만들지 못했습니다.');
					if (!data.attempts) setStates({ fish: 'idle', google: 'idle', edge: 'idle' });
				});
				return;
			}
			const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
			if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
			objectUrl.current = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
			const provider = data.provider;
			reveal(data.attempts ?? [], () => {
				setRunning(false);
				cheer('voice', 'done');
				setMade({ provider, text });
				const el = player();
				el.src = objectUrl.current!;
				void el.play().catch(() => undefined);
			});
		} catch {
			setRunning(false);
			cheer('voice', 'error');
			setStates({ fish: 'idle', google: 'idle', edge: 'idle' });
			setMessage('서버에 닿지 못했습니다. 잠시 뒤 다시 해 보세요.');
		}
	};

	const read = made && length ? Math.round((time / length) * made.text.length) : 0;
	const left = quota?.remaining;
	const status = message
		? message
		: made
			? `${PROVIDER_NAME[made.provider]}로 만들었습니다${made.provider !== 'fish' && !blocked.includes('fish') ? ' (앞 공급자가 실패해 넘어감)' : ''}`
			: running
				? '만드는 중'
				: '글을 고치고 만들어 보세요';

	return (
		<div className="cd-voice">
			<div className="cd-voice-head">
				<div className="cd-seg" role="group" aria-label="대본 언어">
					{(['ko', 'en'] as const).map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={lang === value}
							disabled={running}
							onClick={() => {
								setLang(value);
								setText(SPEECH_DEFAULT[value]);
							}}
						>
							{value.toUpperCase()}
						</button>
					))}
				</div>
				<p>
					<i className="fa-solid fa-circle-info" />
					실제로 음성을 만듭니다. {MAX_SPEECH_CHARS}자까지, 하루 {quota?.perIp ?? 3}번(사이트 전체 {quota?.total ?? 50}
					번) 만들 수 있습니다. 공급자를 눌러 막아 두면, 실패했을 때 다음 공급자로 넘어가는 대체 순서를 볼 수 있습니다.
				</p>
			</div>
			<label className="cd-voice-input">
				<span>대본</span>
				<textarea
					value={text}
					maxLength={MAX_SPEECH_CHARS}
					rows={2}
					disabled={running}
					onChange={(event) => setText(event.target.value)}
				/>
				<small>
					{[...text].length}/{MAX_SPEECH_CHARS}
				</small>
			</label>
			{/* 자리는 늘 잡아 두고 내용만 바꾼다 (상태에 따라 아래가 밀리지 않게) */}
			<p className="cd-voice-lyric" aria-label={made?.text} data-empty={!made || undefined}>
				<span className="cd-lyric">
					{made ? (
						<>
							<b>{made.text.slice(0, read)}</b>
							{made.text.slice(read)}
						</>
					) : (
						'만든 음성을 틀면 여기서 대본이 읽는 만큼 채워집니다'
					)}
				</span>
			</p>
			<ol className="cd-voice-chain" aria-label="공급자 차례 (눌러서 막아 보기)">
				{PROVIDERS.map((provider) => (
					<li key={provider}>
						<button
							type="button"
							data-state={states[provider]}
							data-blocked={blocked.includes(provider) || undefined}
							disabled={running}
							aria-pressed={blocked.includes(provider)}
							title={reasons[provider]}
							onClick={() =>
								setBlocked((now) =>
									now.includes(provider) ? now.filter((name) => name !== provider) : [...now, provider]
								)
							}
						>
							<strong>{PROVIDER_NAME[provider]}</strong>
							<small>
								{states[provider] === 'trying'
									? '만드는 중'
									: states[provider] === 'ok'
										? '완료'
										: states[provider] === 'fail'
											? `실패 · ${reasons[provider] ?? ''}`
											: states[provider] === 'skip' || blocked.includes(provider)
												? '막아 둠'
												: '대기'}
							</small>
						</button>
					</li>
				))}
			</ol>
			<div className="cd-player" data-empty={!made || undefined}>
				<button
					type="button"
					disabled={!made}
					aria-label={playing ? '일시정지' : '재생'}
					onClick={() => {
						const el = player();
						if (el.paused) void el.play().catch(() => undefined);
						else el.pause();
					}}
				>
					<i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} />
				</button>
				<input
					type="range"
					aria-label="재생 위치"
					disabled={!made}
					min={0}
					max={length || 1}
					step={0.05}
					value={time}
					onChange={(event) => {
						const el = player();
						el.currentTime = Number(event.target.value);
						setTime(el.currentTime);
					}}
					style={cssVars({ fill: `${length ? (time / length) * 100 : 0}%` })}
				/>
				<span>
					{clock(time)} / {clock(length)}
				</span>
			</div>
			<div className="cd-voice-foot">
				<button type="button" className="cd-primary" onClick={make} disabled={running || !text.trim() || left === 0}>
					<i className="fa-solid fa-wand-magic-sparkles" /> 음성 만들기
				</button>
				<p role="status">{status}</p>
				<span className="cd-chip">
					{typeof left === 'number' ? `오늘 ${left}번 남음` : `하루 ${quota?.perIp ?? 3}번`}
				</span>
			</div>
		</div>
	);
};
