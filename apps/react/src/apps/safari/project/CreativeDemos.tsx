// HYEONIVERSE 페이지에서 직접 만져 보는 데모: 그 사이트의 관리자 기능(슬라이드 갤러리와 음성, TTS, 파형 편집,
// PDF·PPTX 변환, 자동 번역, AI 요약)과 테마 프리셋을 같은 규칙으로 흉내 낸다. 소리는 내지 않는다
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectPoint, ThemeSwatch } from '@/shared/profile';
import { scrollParent } from '@/apps/safari/project/scroll';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/CreativeDemos.css';

/** 화면(페이지를 스크롤하는 칸)에 ratio만큼 들어와 있는지 */
const useInView = <T extends HTMLElement>(ratio = 0.5) => {
	const ref = useRef<T>(null);
	// 관찰할 수 없는 곳(시험 환경 등)에서는 늘 보이는 것으로 둔다
	const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
	useEffect(() => {
		const node = ref.current;
		if (!node || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
			root: scrollParent(node),
			threshold: ratio,
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [ratio]);
	return [ref, inView] as const;
};

const GALLERY = '/imgs/projects/hyeoniverse/gallery';

/**
 * 갤러리 데모의 장: HYEONIVERSE 발표 자료(19쪽) 가운데 8장과, 그 사이트 갤러리가 실제로 트는 Fish TTS 음성.
 * 1장은 대본까지 실제 그대로, 나머지 음성이 있는 장은 대본을 아직 옮기지 않아 자막 없이 음성만 나온다. 12장은 대본이 없다
 */
const SLIDE_DATA: { page: number; script: string; audio?: boolean; ms?: number }[] = [
	{
		page: 1,
		script:
			"지금 보시는 프로젝트는 제가 직접 기획하고 설계해서 운영하고 있는 'Hyeoniverse'입니다. 단순히 포트폴리오를 보여주는 웹사이트를 만드는 것을 목표로 하지 않았습니다. 실제 서비스라고 생각하고, 공개된 사이트뿐만 아니라 콘텐츠를 관리할 수 있는 CMS와 데이터베이스, 권한, 보안, 테스트, 배포까지 직접 구성했습니다. 기술 스택은 Next.js, React, TypeScript를 중심으로 Supabase와 Vercel을 사용했습니다.",
		audio: true,
		ms: 26267,
	},
	{ page: 2, script: '', audio: true, ms: 41220 },
	{ page: 3, script: '', audio: true, ms: 40100 },
	{ page: 4, script: '', audio: true, ms: 35660 },
	{ page: 5, script: '', audio: true, ms: 76640 },
	{ page: 8, script: '', audio: true, ms: 38060 },
	{ page: 11, script: '', audio: true, ms: 39110 },
	{ page: 12, script: '' },
];
const SLIDES = SLIDE_DATA.map(({ page, audio, ...slide }) => ({
	...slide,
	page,
	src: `${GALLERY}/slide-${String(page).padStart(2, '0')}.jpg`,
	audio: audio ? `${GALLERY}/narration-${page}.mp3` : undefined,
}));

/** 대본 없는 장을 보여 주는 시간, 대본 한 글자를 읽는 시간 (ms) */
const SILENT_SLIDE_MS = 4000;
const MS_PER_CHAR = 85;
const slideMs = (slide: (typeof SLIDES)[number]) =>
	slide.ms ?? (slide.script ? Math.max(3200, slide.script.length * MS_PER_CHAR) : SILENT_SLIDE_MS);
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
/** 그 장을 무엇으로 읽는지 */
const sourceOf = (slide: (typeof SLIDES)[number]) =>
	slide.audio
		? `Fish TTS 음성 파일 · 발표 ${slide.page}쪽`
		: slide.script
			? '브라우저 음성 (대본만 있는 장)'
			: '대본 없음 · 4초 뒤 넘김';

/** ask: 소리를 낼지 묻는 중, sound: 소리와 함께, silent: 소리 없이 자막만, stopped: 끝까지 보고 멈춤 */
type SlideMode = 'ask' | 'sound' | 'silent' | 'stopped';

/**
 * 발표처럼 넘어가는 갤러리: 가운데 장이 크고 양옆은 원근으로 기운다. 브라우저는 소리 자동 재생을 막으므로 그 사이트처럼
 * "음성과 함께 보기 / 음성 없이 보기"를 먼저 묻는다. 화면에 절반 넘게 들어와 있는 동안 읽고, 한 장을 다 읽으면 다음 장으로,
 * 마지막 장이 끝나면 멈춘다. 음성 파일 → 브라우저 음성 → 4초 순서로 읽는다. 끌기·←→·옆 장 누르기로 넘긴다
 */
const Slides: React.FC = () => {
	const [stage, inView] = useInView<HTMLDivElement>(0.5);
	const [current, setCurrent] = useState(0);
	const [mode, setMode] = useState<SlideMode>('ask');
	const [captions, setCaptions] = useState(true);
	// 같은 장을 다시 읽을 때도 진행 막대와 음성이 처음부터 돌게 바꾸는 번호
	const [run, setRun] = useState(0);
	const drag = useRef<number | null>(null);
	const audio = useRef<HTMLAudioElement | null>(null);
	const lastRun = useRef(-1);
	const slide = SLIDES[current];
	const playing = inView && (mode === 'sound' || mode === 'silent');
	// 소리와 함께일 때 음성 파일·브라우저 음성이 있는 장은 음성이 끝나야 넘어간다 (막대는 어림 시간)
	const voiced = mode === 'sound' && (!!slide.audio || (!!slide.script && canSpeak()));
	const go = (index: number) => {
		setCurrent(Math.max(0, Math.min(SLIDES.length - 1, index)));
		setRun((n) => n + 1);
	};
	const ended = () => {
		if (current === SLIDES.length - 1) setMode('stopped');
		else go(current + 1);
	};
	const endedRef = useRef(ended);
	useEffect(() => {
		endedRef.current = ended;
	});

	// 소리 내기: 화면에 보이는 동안만. 장이 바뀌면 처음부터, 화면 밖에 나갔다 오면 음성 파일은 멈춘 자리부터
	useEffect(() => {
		if (mode !== 'sound') return;
		if (slide.audio) {
			const el = (audio.current ??= new Audio());
			if (!el.src.endsWith(slide.audio)) el.src = slide.audio;
			if (lastRun.current !== run) {
				el.currentTime = 0;
				lastRun.current = run;
			}
			el.onended = () => endedRef.current();
			if (inView) void el.play().catch(() => setMode('silent'));
			else el.pause();
			return () => el.pause();
		}
		if (slide.script && canSpeak() && inView) {
			const speech = new SpeechSynthesisUtterance(slide.script);
			speech.lang = 'ko-KR';
			speech.onend = () => endedRef.current();
			window.speechSynthesis.cancel();
			window.speechSynthesis.speak(speech);
			return () => {
				speech.onend = null;
				window.speechSynthesis.cancel();
			};
		}
	}, [mode, slide, run, inView]);
	useEffect(
		() => () => {
			audio.current?.pause();
			if (canSpeak()) window.speechSynthesis.cancel();
		},
		[]
	);

	// 자막은 문장 하나씩: 문장마다 글자 수 비율로 나온 시간(--s0)과 길이(--len)를 정하고, 그 안에서 낱말이 진해진다
	const sentences = slide.script.split(/(?<=[.?!])\s+/).filter(Boolean);
	const total = Math.max(1, sentences.join('').length);
	let start = 0;
	const cues = sentences.map((sentence) => {
		const cue = { start, length: sentence.length / total, words: sentence.split(' ') };
		start += cue.length;
		return cue;
	});
	const ms = slideMs(slide);
	const choose = (next: 'sound' | 'silent') => {
		setMode(next);
		go(current);
	};

	return (
		<div className="cd-slides" style={{ '--ms': `${ms}ms` } as React.CSSProperties}>
			<div
				className="cd-slides-stage"
				ref={stage}
				tabIndex={0}
				role="group"
				aria-roledescription="슬라이드 갤러리"
				aria-label={`${current + 1} / ${SLIDES.length}장`}
				onKeyDown={(event) => {
					if (event.key === 'ArrowRight') go(current + 1);
					if (event.key === 'ArrowLeft') go(current - 1);
				}}
				onPointerDown={(event) => {
					drag.current = event.clientX;
				}}
				onPointerUp={(event) => {
					if (drag.current === null) return;
					const dx = event.clientX - drag.current;
					drag.current = null;
					if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
				}}
			>
				{SLIDES.map((item, i) => {
					const d = i - current;
					return (
						<button
							key={item.src}
							type="button"
							className="cd-slide"
							data-far={Math.abs(d) > 2 || undefined}
							aria-hidden={d !== 0}
							tabIndex={-1}
							style={
								{
									'--d': Math.max(-2, Math.min(2, d)),
									'--a': Math.min(2, Math.abs(d)),
									'--r': Math.max(-1, Math.min(1, d)),
								} as React.CSSProperties
							}
							onClick={() => d !== 0 && go(i)}
						>
							<img src={item.src} alt={d === 0 ? `${i + 1}장` : ''} loading="lazy" draggable={false} />
						</button>
					);
				})}
				{mode === 'ask' && (
					<div className="cd-ask" onPointerDown={(event) => event.stopPropagation()}>
						<button type="button" className="cd-primary" onClick={() => choose('sound')}>
							<i className="fa-solid fa-volume-high" /> 음성과 함께 보기
						</button>
						<button type="button" className="cd-ghost" onClick={() => choose('silent')}>
							음성 없이 보기
						</button>
					</div>
				)}
			</div>
			{captions && (
				<p className="cd-caption" key={`c${run}-${current}`} data-playing={playing || undefined}>
					{slide.script ? (
						cues.map((cue) => (
							<span
								key={cue.start}
								className="cd-cue"
								style={{ '--s0': cue.start, '--len': cue.length } as React.CSSProperties}
							>
								{cue.words.map((word, i) => (
									<span
										key={i}
										style={{ '--at': cue.start + (i / cue.words.length) * cue.length } as React.CSSProperties}
									>
										{word}{' '}
									</span>
								))}
							</span>
						))
					) : slide.audio ? null : (
						<em>대본이 없는 장은 4초 보여 주고 넘어갑니다</em>
					)}
				</p>
			)}
			<div className="cd-slides-bar">
				<button
					type="button"
					aria-pressed={mode === 'sound'}
					onClick={() => {
						if (mode === 'stopped') go(0);
						setMode(mode === 'sound' ? 'silent' : 'sound');
					}}
				>
					<i className={`fa-solid ${mode === 'sound' ? 'fa-volume-high' : 'fa-volume-xmark'}`} /> 음성
				</button>
				<button type="button" aria-pressed={captions} onClick={() => setCaptions(!captions)}>
					<i className="fa-solid fa-closed-captioning" /> 자막
				</button>
				<span className="cd-slides-source">
					<i className="fa-solid fa-wave-square" /> {sourceOf(slide)}
				</span>
				<span className="cd-slides-count">
					{current + 1} / {SLIDES.length}
				</span>
			</div>
			<ol className="cd-slides-strip">
				{SLIDES.map((item, i) => (
					<li key={item.src}>
						<button
							type="button"
							aria-label={`${i + 1}장으로`}
							aria-current={i === current || undefined}
							onClick={() => go(i)}
						>
							<img src={item.src} alt="" loading="lazy" />
							{i === current && (
								<i
									key={run}
									className="cd-slides-progress"
									data-playing={playing || undefined}
									onAnimationEnd={() => !voiced && ended()}
								/>
							)}
						</button>
					</li>
				))}
			</ol>
		</div>
	);
};

type Provider = 'Fish' | 'Google' | 'Edge';
type ProviderState = 'idle' | 'trying' | 'fail' | 'ok' | 'skip';
const PROVIDERS: Provider[] = ['Fish', 'Google', 'Edge'];

/**
 * 대본: HYEONIVERSE 발표 1장 대본의 앞 두 문장. 표기(자막에 보이는 말)와 읽을 말, 그 읽기를 정한 곳.
 * 'Hyeoniverse → 허니버스'는 그 사이트 읽기 사전에 실제로 있는 짝이다
 */
const SCRIPTS = {
	ko: [
		{ text: "지금 보시는 프로젝트는 제가 직접 기획하고 설계해서 운영하고 있는 '" },
		{ text: 'Hyeoniverse', say: '허니버스', by: '사전' },
		{ text: "'입니다. 단순히 포트폴리오를 보여주는 웹사이트를 만드는 것을 목표로 하지 않았습니다." },
	],
	en: [
		{ text: "The project you are looking at is '" },
		{ text: 'Hyeoniverse', say: 'Hyeon-iverse', by: '사전' },
		{
			text: "', which I planned, designed and run myself. It was never meant to be just a website that shows a portfolio.",
		},
	],
} as const satisfies Record<'ko' | 'en', { text: string; say?: string; by?: string }[]>;

/** Fish로 만든 실제 음성 (그 사이트 갤러리가 트는 파일에서 이 두 문장만 잘라 냈다) */
const FISH_SAMPLE = '/imgs/projects/hyeoniverse/gallery/voice-sample.mp3';
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/**
 * 음성 만들기: 고른 공급자부터 차례로 시도하고, 막아 둔 곳은 실패로 넘어간다. Fish로 만들면 실제 음성 파일을 틀고
 * 재생을 따라 자막이 가사처럼 채워진다. 세 곳 모두 실패하면 그 사이트처럼 방문자 브라우저의 음성 합성이 대본을 읽는다
 */
const Voice: React.FC = () => {
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [blocked, setBlocked] = useState<Provider[]>([]);
	const [states, setStates] = useState<Record<Provider, ProviderState>>({ Fish: 'idle', Google: 'idle', Edge: 'idle' });
	const [running, setRunning] = useState(false);
	const [made, setMade] = useState<Provider | 'none' | null>(null);
	const [time, setTime] = useState(0);
	const [length, setLength] = useState(0);
	const [playing, setPlaying] = useState(false);
	const timers = useRef<number[]>([]);
	const audio = useRef<HTMLAudioElement | null>(null);
	useEffect(
		() => () => {
			timers.current.forEach((timer) => window.clearTimeout(timer));
			audio.current?.pause();
			if (canSpeak()) window.speechSynthesis.cancel();
		},
		[]
	);

	const player = () => {
		if (audio.current) return audio.current;
		const el = new Audio(FISH_SAMPLE);
		el.preload = 'auto';
		el.ontimeupdate = () => setTime(el.currentTime);
		el.onloadedmetadata = () => setLength(el.duration);
		el.onplay = () => setPlaying(true);
		el.onpause = () => setPlaying(false);
		el.onended = () => setPlaying(false);
		audio.current = el;
		return el;
	};
	const stopSound = () => {
		audio.current?.pause();
		if (canSpeak()) window.speechSynthesis.cancel();
		setTime(0);
	};
	const reset = () => {
		timers.current.forEach((timer) => window.clearTimeout(timer));
		stopSound();
		setStates({ Fish: 'idle', Google: 'idle', Edge: 'idle' });
		setMade(null);
		setRunning(false);
	};
	const script = SCRIPTS[lang];
	const caption = script.map((part) => part.text).join('');
	const spoken = script.map((part) => ('say' in part ? part.say : part.text)).join('');
	const make = () => {
		reset();
		setRunning(true);
		// 누른 순간에 미리 준비해 두면, 만들기가 끝난 뒤 바로 틀 수 있다 (브라우저의 자동 재생 제한)
		if (lang === 'ko' && !blocked.includes('Fish')) player().load();
		const next: Record<Provider, ProviderState> = { Fish: 'idle', Google: 'idle', Edge: 'idle' };
		let at = 0;
		const step = (fn: () => void, wait: number) => {
			at += wait;
			timers.current.push(window.setTimeout(fn, at));
		};
		let done: Provider | null = null;
		for (const provider of PROVIDERS) {
			if (done) break;
			if (lang === 'en' && provider === 'Fish') {
				next.Fish = 'skip';
				step(() => setStates({ ...next }), 200);
				continue;
			}
			const fails = blocked.includes(provider);
			step(() => setStates((now) => ({ ...now, [provider]: 'trying' })), 250);
			next[provider] = fails ? 'fail' : 'ok';
			const snapshot = { ...next };
			step(() => setStates(snapshot), 750);
			if (!fails) done = provider;
		}
		step(() => {
			setRunning(false);
			setMade(done ?? 'none');
			if (done === 'Fish') {
				const el = player();
				el.currentTime = 0;
				void el.play().catch(() => undefined);
			} else if (!done && canSpeak()) {
				const speech = new SpeechSynthesisUtterance(spoken);
				speech.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
				window.speechSynthesis.cancel();
				window.speechSynthesis.speak(speech);
			}
		}, 300);
	};
	const first = lang === 'en' ? 'Google' : 'Fish';
	// 가사처럼: 재생한 비율만큼 자막 글자를 진하게
	const read = made === 'Fish' && length ? Math.round((time / length) * caption.length) : 0;
	const result =
		made === null
			? '공급자를 눌러 막아 두고 돌려 보세요. 막힌 곳은 건너뜁니다'
			: made === 'none'
				? '세 곳 모두 실패 · 음성 파일 없이 방문자 브라우저의 음성 합성이 대본을 읽습니다'
				: `narration-01.mp3 · ${made}로 만들었습니다${made !== first ? ` (${first}가 ${lang === 'en' ? '영어라 건너뜀' : '실패해 넘어감'})` : ''}`;

	return (
		<div className="cd-voice">
			<div className="cd-voice-head">
				<div className="cd-seg" role="group" aria-label="편집 언어">
					{(['ko', 'en'] as const).map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={lang === value}
							disabled={running}
							onClick={() => {
								setLang(value);
								reset();
							}}
						>
							{value.toUpperCase()}
						</button>
					))}
				</div>
				<p>
					<i className="fa-solid fa-circle-info" />
					대체 순서 시연입니다. 여기서 음성을 새로 만들지는 않고, 막아 둔 공급자는 실패로 처리해 다음 공급자로 넘깁니다.
					Fish에서 끝나면 그 사이트가 Fish로 실제 만든 이 대본의 음성을 들려 드립니다.
				</p>
			</div>
			<dl className="cd-voice-script" data-locked={running || undefined}>
				<div>
					<dt>
						대본
						{running && (
							<span className="cd-lock">
								<i className="fa-solid fa-lock" /> 잠금
							</span>
						)}
					</dt>
					<dd>
						{made === 'Fish' ? (
							<span className="cd-lyric" aria-label={caption}>
								<b>{caption.slice(0, read)}</b>
								{caption.slice(read)}
							</span>
						) : (
							caption
						)}
					</dd>
				</div>
				<div>
					<dt>읽는 말</dt>
					<dd>
						{script.map((part, i) =>
							'say' in part ? (
								<mark key={i} title="읽기 사전">
									{part.say}
								</mark>
							) : (
								part.text
							)
						)}
					</dd>
				</div>
			</dl>
			<ol className="cd-voice-chain" aria-label="공급자 차례 (눌러서 막아 보기)">
				{PROVIDERS.map((provider) => (
					<li key={provider}>
						<button
							type="button"
							data-state={states[provider]}
							data-blocked={blocked.includes(provider) || undefined}
							disabled={running}
							aria-pressed={blocked.includes(provider)}
							onClick={() =>
								setBlocked((now) =>
									now.includes(provider) ? now.filter((name) => name !== provider) : [...now, provider]
								)
							}
						>
							<strong>{provider}</strong>
							<small>
								{states[provider] === 'skip'
									? '영어는 건너뜀'
									: states[provider] === 'trying'
										? '만드는 중'
										: states[provider] === 'ok'
											? '완료'
											: states[provider] === 'fail'
												? '실패'
												: blocked.includes(provider)
													? '막힘'
													: '대기'}
							</small>
						</button>
					</li>
				))}
			</ol>
			{made === 'Fish' && (
				<div className="cd-player">
					<button
						type="button"
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
						min={0}
						max={length || 1}
						step={0.05}
						value={time}
						onChange={(event) => {
							const el = player();
							el.currentTime = Number(event.target.value);
							setTime(el.currentTime);
						}}
						style={{ '--fill': `${length ? (time / length) * 100 : 0}%` } as React.CSSProperties}
					/>
					<span>
						{clock(time)} / {clock(length)}
					</span>
				</div>
			)}
			<div className="cd-voice-foot">
				<button type="button" className="cd-primary" onClick={make} disabled={running}>
					<i className="fa-solid fa-wand-magic-sparkles" /> 대체 순서 돌려 보기
				</button>
				<p role="status">{result}</p>
			</div>
			{made !== null && made !== 'Fish' && made !== 'none' && (
				<p className="cd-hint">
					이 데모에는 Fish로 만든 실제 음성 파일만 있어, {made} 결과는 소리 없이 결과만 보여 드립니다.
				</p>
			)}
		</div>
	);
};

/** 파형 데모의 녹음: 실제 Fish 음성(FISH_SAMPLE, 9.5초)을 0.1초마다 잰 세기 (0~1) */
const SAMPLES = [
	0.04, 0.12, 0.8, 0.96, 0.85, 0.57, 0.72, 0.6, 0.56, 0.73, 0.62, 0.32, 0.58, 0.65, 0.4, 0.21, 0.57, 0.75, 0.16, 0.35,
	0.54, 0.64, 0.08, 0.48, 0.96, 0.32, 0.54, 0.58, 0.35, 0.8, 0.52, 0.87, 0.51, 0.75, 0.49, 0.62, 0.65, 0.44, 0.37, 0.52,
	0.52, 0.11, 0.62, 0.58, 0.63, 0.12, 0.58, 0.35, 0.29, 0.23, 0.04, 0.46, 0.57, 0.55, 0.67, 0.32, 0.37, 0.45, 0.39,
	0.79, 0.72, 0.71, 0.63, 0.41, 1.0, 0.6, 0.56, 0.52, 0.65, 0.16, 0.56, 0.67, 0.34, 0.71, 0.38, 0.4, 0.58, 0.56, 0.5,
	0.23, 0.69, 0.39, 0.04, 0.83, 0.74, 0.57, 0.41, 0.44, 0.43, 0.08, 0.34, 0.22, 0.3, 0.04, 0.04,
];

/** 편집기가 트는 실제 음성: 처음 재생할 때 한 번만 받아 풀어 둔다 */
let sampleBuffer: Promise<AudioBuffer> | null = null;
const loadSample = (context: AudioContext) =>
	(sampleBuffer ??= fetch(FISH_SAMPLE)
		.then((response) => response.arrayBuffer())
		.then((data) => context.decodeAudioData(data)));

/** 이어 붙은 조각들: 원래 녹음에서 연속인 칸끼리 묶는다 ([시작 칸, 칸 수]) */
const runsOf = (bins: number[]) =>
	bins.reduce<[number, number][]>((runs, bin) => {
		const last = runs.at(-1);
		if (last && last[0] + last[1] === bin) last[1] += 1;
		else runs.push([bin, 1]);
		return runs;
	}, []);

/** 클립 하나를 다른 자리로 옮긴다 (to는 옮긴 뒤 놓일 순서) */
const moveClip = (clips: Clips, from: number, to: number): Clips => {
	const next = [...clips];
	const [clip] = next.splice(from, 1);
	next.splice(to, 0, clip);
	return next;
};
/** 표본 하나의 길이 (초) */
const SAMPLE_SEC = 0.1;
const HISTORY = 50;
type Clips = number[][];

/** 구간 [a, b)를 지운 클립들 (빈 클립은 빠진다) */
const deleteSpan = (clips: Clips, a: number, b: number): Clips => {
	let at = 0;
	const out: Clips = [];
	for (const clip of clips) {
		const keep = clip.filter((_, i) => at + i < a || at + i >= b);
		at += clip.length;
		if (keep.length) out.push(keep);
	}
	return out;
};

/** 위치 i에서 클립을 둘로 나눈다 (클립 경계면 그대로) */
const splitAt = (clips: Clips, i: number): Clips => {
	let at = 0;
	return clips.flatMap((clip) => {
		const start = at;
		at += clip.length;
		return i > start && i < at ? [clip.slice(0, i - start), clip.slice(i - start)] : [clip];
	});
};

/** 위치 i에 조각을 새 클립으로 끼운다 */
const insertAt = (clips: Clips, i: number, piece: number[]): Clips => {
	const split = splitAt(clips, i);
	let at = 0;
	const out: Clips = [];
	let placed = false;
	for (const clip of split) {
		if (!placed && at >= i) {
			out.push(piece);
			placed = true;
		}
		out.push(clip);
		at += clip.length;
	}
	if (!placed) out.push(piece);
	return out;
};

/**
 * 녹음 파형 편집기: 실제 Fish 음성을 클립으로 다룬다. 누르면 커서, 끌면 구간. 잘라내기·복사·붙여넣기·지우기·선택만 남기기·나누기,
 * 되돌리기 50단계. 클립 번호 손잡이를 끌면 순서가 바뀌고, 재생하면 편집한 순서 그대로 소리가 난다.
 * 단축키는 편집기에 초점이 있을 때 받는다 (Space 재생, ⌘/Ctrl+X C V B Z, Delete, Esc, ←→)
 */
const Wave: React.FC = () => {
	const [clips, setClips] = useState<Clips>(() => [SAMPLES.map((_, i) => i)]);
	const [past, setPast] = useState<Clips[]>([]);
	const [future, setFuture] = useState<Clips[]>([]);
	const [cursor, setCursor] = useState(0);
	const [span, setSpan] = useState<[number, number] | null>(null);
	const [clipboard, setClipboard] = useState<number[] | null>(null);
	const [playhead, setPlayhead] = useState<number | null>(null);
	// 끌고 있는 클립: 몇 번째인지, 놓일 순서, 손잡이가 움직인 거리(px), 놓일 자리 선의 위치(px)
	const [drag, setDrag] = useState<{ from: number; to: number; dx: number; line: number } | null>(null);
	const track = useRef<HTMLDivElement>(null);
	const anchor = useRef<number | null>(null);
	const frame = useRef(0);
	const context = useRef<AudioContext | null>(null);
	const sources = useRef<AudioBufferSourceNode[]>([]);
	const flat = clips.flat();
	const total = flat.length;

	const commit = (next: Clips) => {
		stop();
		setPast((now) => [...now, clips].slice(-HISTORY));
		setFuture([]);
		setClips(next);
	};
	/** 손잡이 x 위치에서 놓일 순서와 그 자리 선 (클립 가운데를 지나면 그 뒤로) */
	const dropAt = (clientX: number, from: number) => {
		const box = track.current?.getBoundingClientRect();
		const nodes = [...(track.current?.querySelectorAll<HTMLElement>('.cd-clip') ?? [])];
		if (!box || !nodes.length) return { to: from, line: 0 };
		// 끌고 있는 클립은 손을 따라 움직이므로 자리 셈에서 뺀다
		let slot = nodes.findIndex((node, i) => {
			if (i === from) return false;
			const rect = node.getBoundingClientRect();
			return clientX < rect.left + rect.width / 2;
		});
		if (slot < 0) slot = nodes.length;
		const edge = slot < nodes.length ? nodes[slot].getBoundingClientRect().left - 2 : box.right;
		return { to: slot > from ? slot - 1 : slot, line: edge - box.left };
	};
	const indexAt = (clientX: number) => {
		const box = track.current?.getBoundingClientRect();
		if (!box) return 0;
		return Math.round(Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * total);
	};
	const stop = useCallback(() => {
		cancelAnimationFrame(frame.current);
		sources.current.forEach((source) => {
			source.onended = null;
			source.stop();
		});
		sources.current = [];
		setPlayhead(null);
	}, []);
	useEffect(
		() => () => {
			stop();
			void context.current?.close();
		},
		[stop]
	);

	const actions = {
		cut: () => {
			if (!span) return;
			setClipboard(flat.slice(...span));
			commit(deleteSpan(clips, ...span));
			setCursor(span[0]);
			setSpan(null);
		},
		copy: () => span && setClipboard(flat.slice(...span)),
		paste: () => {
			if (!clipboard) return;
			const at = span ? span[0] : cursor;
			commit(insertAt(span ? deleteSpan(clips, ...span) : clips, at, clipboard));
			setCursor(at + clipboard.length);
			setSpan(null);
		},
		remove: () => {
			if (!span) return;
			commit(deleteSpan(clips, ...span));
			setCursor(span[0]);
			setSpan(null);
		},
		keep: () => {
			if (!span) return;
			commit([flat.slice(...span)]);
			setCursor(0);
			setSpan(null);
		},
		split: () => commit(span ? splitAt(splitAt(clips, span[0]), span[1]) : splitAt(clips, cursor)),
		undo: () => {
			const previous = past.at(-1);
			if (!previous) return;
			setPast(past.slice(0, -1));
			setFuture([clips, ...future]);
			setClips(previous);
			setSpan(null);
			setCursor((at) => Math.min(at, previous.flat().length));
		},
		redo: () => {
			const [next, ...rest] = future;
			if (!next) return;
			setFuture(rest);
			setPast([...past, clips].slice(-HISTORY));
			setClips(next);
			setSpan(null);
			setCursor((at) => Math.min(at, next.flat().length));
		},
		play: () => {
			if (playhead !== null) return stop();
			const from = span ? span[0] : cursor >= total ? 0 : cursor;
			const to = span ? span[1] : total;
			if (to <= from) return;
			if (typeof AudioContext === 'undefined') return;
			const audio = (context.current ??= new AudioContext());
			void audio.resume();
			setPlayhead(from);
			void loadSample(audio).then((buffer) => {
				// 편집한 순서대로 원래 녹음의 조각들을 이어 틀어 준다
				let at = audio.currentTime + 0.05;
				const begin = at;
				sources.current = runsOf(flat.slice(from, to)).map(([bin, count]) => {
					const source = audio.createBufferSource();
					source.buffer = buffer;
					source.connect(audio.destination);
					source.start(at, bin * SAMPLE_SEC, count * SAMPLE_SEC);
					at += count * SAMPLE_SEC;
					return source;
				});
				const last = sources.current.at(-1);
				if (last) last.onended = () => stop();
				const tick = () => {
					setPlayhead(from + Math.max(0, audio.currentTime - begin) / SAMPLE_SEC);
					frame.current = requestAnimationFrame(tick);
				};
				frame.current = requestAnimationFrame(tick);
			});
		},
	};

	const onKey = (event: React.KeyboardEvent) => {
		const mod = event.metaKey || event.ctrlKey;
		const key = event.key.toLowerCase();
		const run = (action: () => void) => {
			event.preventDefault();
			action();
		};
		if (event.key === ' ') run(actions.play);
		else if (mod && key === 'x') run(actions.cut);
		else if (mod && key === 'c') run(actions.copy);
		else if (mod && key === 'v') run(actions.paste);
		else if (mod && key === 'b') run(actions.split);
		else if (mod && key === 'z') run(event.shiftKey ? actions.redo : actions.undo);
		else if (mod && key === 'y') run(actions.redo);
		else if (event.key === 'Delete' || event.key === 'Backspace') run(actions.remove);
		else if (event.key === 'Escape') run(() => setSpan(null));
		else if (event.key === 'ArrowLeft') run(() => setCursor((at) => Math.max(0, at - 1)));
		else if (event.key === 'ArrowRight') run(() => setCursor((at) => Math.min(total, at + 1)));
	};

	const tools: { label: string; icon: string; keys: string; run: keyof typeof actions; off: boolean }[] = [
		{ label: '재생', icon: playhead !== null ? 'fa-pause' : 'fa-play', keys: 'Space', run: 'play', off: false },
		{ label: '잘라내기', icon: 'fa-scissors', keys: '⌘X', run: 'cut', off: !span },
		{ label: '복사', icon: 'fa-copy', keys: '⌘C', run: 'copy', off: !span },
		{ label: '붙여넣기', icon: 'fa-paste', keys: '⌘V', run: 'paste', off: !clipboard },
		{ label: '지우기', icon: 'fa-trash-can', keys: 'Delete', run: 'remove', off: !span },
		{ label: '선택만 남기기', icon: 'fa-crop-simple', keys: '', run: 'keep', off: !span },
		{ label: '나누기', icon: 'fa-table-columns', keys: '⌘B', run: 'split', off: false },
		{ label: '되돌리기', icon: 'fa-rotate-left', keys: '⌘Z', run: 'undo', off: !past.length },
		{ label: '다시 하기', icon: 'fa-rotate-right', keys: '⇧⌘Z', run: 'redo', off: !future.length },
	];
	const pct = (at: number) => `${(at / Math.max(1, total)) * 100}%`;
	// 클립마다 녹음 전체에서 시작하는 위치
	const starts = clips.map((_, n) => clips.slice(0, n).reduce((sum, clip) => sum + clip.length, 0));

	return (
		<div className="cd-wave" tabIndex={0} onKeyDown={onKey} aria-label="녹음 파형 편집기">
			<div className="cd-wave-tools" role="toolbar" aria-label="편집 도구">
				{tools.map((tool) => (
					<button
						key={tool.label}
						type="button"
						disabled={tool.off}
						title={tool.keys ? `${tool.label} (${tool.keys})` : tool.label}
						aria-label={tool.label}
						onClick={() => actions[tool.run]()}
					>
						<i className={`fa-solid ${tool.icon}`} />
					</button>
				))}
			</div>
			<div
				className="cd-wave-track"
				ref={track}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					const at = indexAt(event.clientX);
					anchor.current = at;
					setCursor(at);
					setSpan(null);
				}}
				onPointerMove={(event) => {
					if (anchor.current === null) return;
					const at = indexAt(event.clientX);
					const a = Math.min(anchor.current, at);
					const b = Math.max(anchor.current, at);
					setSpan(b - a > 0 ? [a, b] : null);
				}}
				onPointerUp={() => {
					anchor.current = null;
				}}
			>
				{clips.map((clip, n) => {
					const start = starts[n];
					return (
						<div
							key={`${n}-${start}`}
							className="cd-clip"
							style={
								{
									flexGrow: clip.length,
									'--dx': drag?.from === n ? `${drag.dx}px` : '0px',
								} as React.CSSProperties
							}
							data-dragging={drag?.from === n || undefined}
						>
							<span
								className="cd-clip-no"
								title="끌어서 순서 바꾸기"
								onPointerDown={(event) => {
									event.stopPropagation();
									event.preventDefault();
									if (clips.length < 2) return;
									const startX = event.clientX;
									let latest = { from: n, dx: 0, ...dropAt(startX, n) };
									setDrag(latest);
									// 손잡이를 잡은 뒤로는 창 전체에서 움직임을 받는다 (클립이 손잡이째 움직여도 놓치지 않게)
									const move = (next: PointerEvent) => {
										latest = { from: n, dx: next.clientX - startX, ...dropAt(next.clientX, n) };
										setDrag(latest);
									};
									const up = () => {
										window.removeEventListener('pointermove', move);
										window.removeEventListener('pointerup', up);
										window.removeEventListener('pointercancel', up);
										if (latest.to !== latest.from) commit(moveClip(clips, latest.from, latest.to));
										setDrag(null);
									};
									window.addEventListener('pointermove', move);
									window.addEventListener('pointerup', up);
									window.addEventListener('pointercancel', up);
								}}
							>
								<i className="fa-solid fa-grip-vertical" /> {n + 1}
							</span>
							{clip.map((sample, i) => (
								<i
									key={i}
									style={{ '--h': SAMPLES[sample] } as React.CSSProperties}
									data-on={(span && start + i >= span[0] && start + i < span[1]) || undefined}
								/>
							))}
						</div>
					);
				})}
				{total === 0 && <p className="cd-wave-empty">모두 지웠습니다. 되돌리기로 살려 보세요</p>}
				{span && <span className="cd-wave-span" style={{ left: pct(span[0]), width: pct(span[1] - span[0]) }} />}
				<span className="cd-wave-cursor" style={{ left: pct(cursor) }} />
				{playhead !== null && <span className="cd-wave-head" style={{ left: pct(playhead) }} />}
				{drag && drag.to !== drag.from && <span className="cd-wave-drop" style={{ left: drag.line }} />}
			</div>
			<p className="cd-wave-meta">
				<span>
					{(total * SAMPLE_SEC).toFixed(1)}초 · 클립 {clips.length}개
				</span>
				<span>
					{span
						? `${((span[1] - span[0]) * SAMPLE_SEC).toFixed(1)}초 고름`
						: `커서 ${(cursor * SAMPLE_SEC).toFixed(1)}초`}
				</span>
				<span>
					되돌리기 {past.length}/{HISTORY}
				</span>
			</p>
			<p className="cd-hint">
				실제 Fish 음성입니다. 구간을 골라 지우거나 나눈 뒤, 클립 번호 손잡이를 끌어 순서를 바꾸고 재생해 보세요
			</p>
		</div>
	);
};

/** 변환 데모의 단계: 읽기 → 장마다 그리기 → 올리기 → 끝 */
type Phase = 'idle' | 'read' | 'draw' | 'upload' | 'done';

/** PDF·PPTX를 장마다 그림으로: 화면에 들어오면 한 번 돌고, 파일 종류를 바꾸거나 다시 누르면 처음부터 */
const Convert: React.FC = () => {
	const [box, inView] = useInView<HTMLDivElement>(0.4);
	const [kind, setKind] = useState<'pptx' | 'pdf'>('pptx');
	// 움직임 줄이기면 처음부터 다 그린 상태로 둔다
	const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'done' : 'idle'));
	const [drawn, setDrawn] = useState(() => (prefersReducedMotion() ? SLIDES.length : 0));
	const timers = useRef<number[]>([]);
	const started = useRef(false);
	const total = SLIDES.length;

	const start = useCallback(() => {
		timers.current.forEach((timer) => window.clearTimeout(timer));
		timers.current = [];
		const later = (fn: () => void, at: number) => timers.current.push(window.setTimeout(fn, at));
		setDrawn(0);
		setPhase('read');
		later(() => setPhase('draw'), 700);
		for (let i = 1; i <= total; i += 1) later(() => setDrawn(i), 700 + i * 360);
		later(() => setPhase('upload'), 900 + total * 360);
		later(() => setPhase('done'), 1700 + total * 360);
	}, [total]);
	useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
	useEffect(() => {
		if (!inView || started.current || prefersReducedMotion()) return;
		started.current = true;
		start();
	}, [inView, start]);

	const label = {
		idle: '파일을 끌어 놓으면 여기서 펼칩니다',
		read: '읽는 중',
		draw: `그리는 중 ${drawn}/${total}`,
		upload: '올리는 중',
		done: `갤러리에 ${total}장을 올렸습니다${kind === 'pptx' ? ` · 발표자 노트 ${SLIDES.filter((item) => item.script || item.audio).length}개를 대본으로` : ''}`,
	}[phase];

	return (
		<div className="cd-convert" ref={box}>
			<div className="cd-convert-head">
				<div className="cd-seg" role="group" aria-label="파일 종류">
					{(['pptx', 'pdf'] as const).map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={kind === value}
							onClick={() => {
								setKind(value);
								start();
							}}
						>
							{value.toUpperCase()}
						</button>
					))}
				</div>
				<p className="cd-file">
					<i className={`fa-solid ${kind === 'pptx' ? 'fa-file-powerpoint' : 'fa-file-pdf'}`} />
					hyeoniverse-portfolio.{kind}
				</p>
				<button type="button" className="cd-ghost" onClick={start} aria-label="다시 변환">
					<i className="fa-solid fa-rotate-right" />
				</button>
			</div>
			<p className="cd-convert-status" role="status" data-phase={phase}>
				{phase !== 'done' && phase !== 'idle' && <i className="cd-spin" />}
				{label}
			</p>
			<ol className="cd-convert-grid">
				{SLIDES.map((slide, i) => (
					<li key={slide.src} data-drawn={i < drawn || undefined}>
						<img src={slide.src} alt="" loading="lazy" />
						<span className="cd-convert-no">{String(i + 1).padStart(2, '0')}.jpg</span>
						{kind === 'pptx' && i < drawn && (slide.script || slide.audio) && (
							<span className="cd-convert-note">
								<i className="fa-solid fa-note-sticky" /> 노트 → 대본
							</span>
						)}
					</li>
				))}
			</ol>
		</div>
	);
};

/** 번역 데모의 칸: HYEONIVERSE 작업물의 실제 한국어·영어 부제와 설명 */
const FIELDS = [
	{
		label: '부제',
		ko: '디자인 시스템부터 관리자 CMS 까지 혼자 설계하고 운영하는 포트폴리오 사이트',
		en: 'A portfolio site designed, built and operated solo, from the design system to the admin CMS',
	},
	{
		label: '설명',
		ko: '흩어져 있던 프로젝트와 글을 한 곳에서 보여 주고 계속 갱신하기 위해 만든 개인 포트폴리오입니다.',
		en: 'A personal portfolio that gathers scattered projects and writing in one place and keeps them current.',
	},
	{
		label: '갤러리 대본 4',
		ko: '방문자가 보는 사이트와, 그 사이트를 운영하는 관리자 CMS를 함께 만들었습니다.',
		en: 'I built the site visitors see together with the admin CMS that runs it.',
	},
];

/** 편집 언어를 EN으로 바꾸면 비어 있는 칸을 번역해 채운다. 다시 번역은 전체를 새로, 비우기로 처음 상태로 */
const Translate: React.FC = () => {
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [filled, setFilled] = useState(false);
	const [busy, setBusy] = useState(false);
	const [run, setRun] = useState(0);
	const timer = useRef(0);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const translate = () => {
		setBusy(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			setBusy(false);
			setFilled(true);
			setRun((n) => n + 1);
		}, 1200);
	};
	const switchTo = (value: 'ko' | 'en') => {
		setLang(value);
		if (value === 'en' && !filled && !busy) translate();
	};

	return (
		<div className="cd-translate">
			<div className="cd-translate-head">
				<div className="cd-seg" role="group" aria-label="편집 언어">
					{(['ko', 'en'] as const).map((value) => (
						<button key={value} type="button" aria-pressed={lang === value} onClick={() => switchTo(value)}>
							{value.toUpperCase()}
						</button>
					))}
				</div>
				<span className="cd-chip">
					<i className="fa-solid fa-language" /> DeepL
				</span>
				{lang === 'en' && (
					<>
						<button type="button" className="cd-ghost" onClick={translate} disabled={busy}>
							다시 번역
						</button>
						<button
							type="button"
							className="cd-ghost"
							disabled={busy || !filled}
							onClick={() => {
								setFilled(false);
								setLang('ko');
							}}
						>
							EN 비우기
						</button>
					</>
				)}
			</div>
			<dl className="cd-fields">
				{FIELDS.map((field, i) => (
					<div key={field.label}>
						<dt>{field.label}</dt>
						<dd data-busy={(lang === 'en' && busy) || undefined}>
							{lang === 'ko' ? (
								field.ko
							) : busy ? (
								<span className="cd-shimmer" />
							) : filled ? (
								<span className="cd-typed" key={run} style={{ '--i': i } as React.CSSProperties}>
									{field.en}
								</span>
							) : (
								<em>비어 있음</em>
							)}
						</dd>
					</div>
				))}
			</dl>
			<p className="cd-hint" role="status">
				{lang === 'ko'
					? 'EN을 눌러 보세요. 비어 있는 영어 칸을 번역해 채웁니다'
					: busy
						? 'DeepL로 번역하는 중'
						: '번역한 값은 그대로 고쳐 쓸 수 있습니다'}
			</p>
		</div>
	);
};

const SUMMARY = {
	ko: '흩어져 있던 프로젝트와 글을 한 곳에서 보여 주고 계속 갱신하기 위해 만든 개인 포트폴리오입니다. 공개 페이지와 디자인 시스템, 글 편집기와 관리자 CMS까지 한 사람이 설계하고 운영합니다.',
	en: 'A personal portfolio that gathers scattered projects and writing in one place and keeps them current. Public pages, the design system, the editor and the admin CMS are all designed and operated by one person.',
};

/** AI 요약 상자: 발행하면 만드는 중이 보였다가 두 언어 요약이 붙는다. 머리를 누르면 접고 펼친다 */
const Summary: React.FC = () => {
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [open, setOpen] = useState(true);
	const [busy, setBusy] = useState(false);
	const timer = useRef(0);
	useEffect(() => () => window.clearTimeout(timer.current), []);

	return (
		<div className="cd-summary">
			<div className="cd-translate-head">
				<button
					type="button"
					className="cd-primary"
					disabled={busy}
					onClick={() => {
						setBusy(true);
						setOpen(true);
						timer.current = window.setTimeout(() => setBusy(false), 1600);
					}}
				>
					<i className="fa-solid fa-paper-plane" /> 발행
				</button>
				<span className="cd-chip">Gemini</span>
				<div className="cd-seg" role="group" aria-label="보는 언어">
					{(['ko', 'en'] as const).map((value) => (
						<button key={value} type="button" aria-pressed={lang === value} onClick={() => setLang(value)}>
							{value.toUpperCase()}
						</button>
					))}
				</div>
			</div>
			<div className="cd-summary-box" data-open={open || undefined}>
				<button type="button" className="cd-summary-head" aria-expanded={open} onClick={() => setOpen(!open)}>
					<span>
						<i className="fa-solid fa-wand-magic-sparkles" /> AI 요약
					</span>
					<i className="fa-solid fa-chevron-down" />
				</button>
				<div className="cd-summary-body">
					<div>
						{busy ? (
							<p className="cd-dots">
								<i />
								<i />
								<i /> 요약을 만드는 중
							</p>
						) : (
							<p key={lang} className="cd-typed">
								{SUMMARY[lang]}
							</p>
						)}
					</div>
				</div>
			</div>
			<p className="cd-hint">예시: HYEONIVERSE 작업물의 설명으로 만든 요약</p>
		</div>
	);
};

/** 장 글 묶음에 붙는 데모 */
export const Demo: React.FC<{ kind: NonNullable<ProjectPoint['demo']> }> = ({ kind }) => {
	if (kind === 'slides') return <Slides />;
	if (kind === 'voice') return <Voice />;
	if (kind === 'wave') return <Wave />;
	if (kind === 'convert') return <Convert />;
	if (kind === 'translate') return <Translate />;
	return <Summary />;
};

/** "#rrggbb" → 0~1 sRGB */
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hexOf = (rgb: number[]) =>
	`#${rgb
		.map((c) =>
			Math.round(Math.min(1, Math.max(0, c)) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;

/** 상대 휘도 (WCAG) */
const luminance = (hex: string) => {
	const [r, g, b] = rgbOf(hex).map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** 두 색의 대비 (1~21) */
const contrast = (a: string, b: string) => {
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
};
const grade = (ratio: number) => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? '큰 글자 AA' : '부족');
/** 글자 최소 대비 (WCAG AA 본문) */
const MIN_TEXT_CONTRAST = 4.5;

/** sRGB ↔ OKLab (명도만 옮기고 색상·채도는 두려고) */
const toOklab = (hex: string) => {
	const [r, g, b] = rgbOf(hex).map(toLinear);
	const [l, m, s] = [
		0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
		0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
		0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
	].map(Math.cbrt);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
};
/** OKLab → sRGB (0~1, 색역 밖이면 0~1을 벗어난다) */
const fromOklab = ([L, a, b]: number[]) => {
	const [l, m, s] = [
		L + 0.3963377774 * a + 0.2158037573 * b,
		L - 0.1055613458 * a - 0.0638541728 * b,
		L - 0.0894841775 * a - 1.291485548 * b,
	].map((v) => v ** 3);
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map(fromLinear);
};
const inGamut = (rgb: number[]) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/** 강조 글자: 바탕 위 대비가 모자라면 그 사이트처럼 OKLCH 명도만 바탕 반대쪽으로 옮긴다 (색역 밖이면 채도를 줄여 안으로) */
const readableAccent = (accent: string, bg: string) => {
	if (contrast(accent, bg) >= MIN_TEXT_CONTRAST) return accent;
	const [L, a, b] = toOklab(accent);
	const step = contrast(bg, '#000000') < contrast(bg, '#ffffff') ? 0.01 : -0.01;
	for (let l = L + step; l > 0 && l < 1; l += step) {
		let k = 1;
		while (k > 0 && !inGamut(fromOklab([l, a * k, b * k]))) k -= 0.02;
		const hex = hexOf(fromOklab([l, a * Math.max(0, k), b * Math.max(0, k)]));
		if (contrast(hex, bg) >= MIN_TEXT_CONTRAST) return hex;
	}
	return step > 0 ? '#ffffff' : '#000000';
};

/** 강조색 면 위 글자: 그 모드의 바탕 → 글자 → 반대 모드의 바탕·글자 순으로 대비 4.5가 되는 첫 색 */
const textOnAccent = (theme: ThemeSwatch, mode: 'light' | 'dark') => {
	const own = mode === 'light' ? [theme.lightBg, theme.lightText] : [theme.darkBg, theme.darkText];
	const other = mode === 'light' ? [theme.darkBg, theme.darkText] : [theme.lightBg, theme.lightText];
	const found = [...own, ...other].find((color) => contrast(color, theme.accent) >= MIN_TEXT_CONTRAST);
	return found ?? (contrast('#ffffff', theme.accent) >= contrast('#000000', theme.accent) ? '#ffffff' : '#000000');
};

/** 홈의 3D 토러스 재질: 색 프리셋과 상관없이 라이트·다크 두 벌뿐 */
const TORUS = {
	light: { color: '#e8ecf2', glow: '#3b6fc0' },
	dark: { color: '#c0c8d8', glow: '#2a4a8a' },
};
/** 프리셋이 혼자 넘어가는 간격 (ms), 몇 번 넘어갈 때마다 모드도 바꾸는지 */
const CYCLE_MS = 2200;
const FLIP_EVERY = 4;

/**
 * 테마 미리보기: 프리셋을 고르거나 라이트·다크를 바꾸면 작은 홈 화면의 색이 그 테마로 바뀐다.
 * 화면에 보이는 동안 프리셋이 혼자 넘어가고, 한 번이라도 직접 고르면 멈춘다
 */
export const Themes: React.FC<{ palette: ThemeSwatch[] }> = ({ palette }) => {
	const [box, inView] = useInView<HTMLDivElement>(0.4);
	const [index, setIndex] = useState(0);
	const [mode, setMode] = useState<'light' | 'dark'>('light');
	const [touched, setTouched] = useState(false);
	const ticks = useRef(0);

	useEffect(() => {
		if (!inView || touched || prefersReducedMotion()) return;
		const timer = window.setInterval(() => {
			ticks.current += 1;
			setIndex((now) => (now + 1) % palette.length);
			if (ticks.current % FLIP_EVERY === 0) setMode((now) => (now === 'light' ? 'dark' : 'light'));
		}, CYCLE_MS);
		return () => window.clearInterval(timer);
	}, [inView, touched, palette.length]);

	const theme = palette[index];
	const bg = mode === 'light' ? theme.lightBg : theme.darkBg;
	const text = mode === 'light' ? theme.lightText : theme.darkText;
	const onAccent = textOnAccent(theme, mode);
	const accentText = readableAccent(theme.accent, bg);
	const body = contrast(text, bg);
	const accent = contrast(accentText, bg);
	const button = contrast(onAccent, theme.accent);
	const torus = TORUS[mode];

	return (
		<div className="cd-themes" ref={box} data-reveal="">
			<div
				className="cd-site"
				data-mode={mode}
				style={
					{
						'--t-bg': bg,
						'--t-text': text,
						'--t-accent': theme.accent,
						'--t-on': onAccent,
						'--t-accent-text': accentText,
						'--torus': torus.color,
						'--torus-glow': torus.glow,
					} as React.CSSProperties
				}
				aria-label={`${theme.name} 테마 ${mode === 'light' ? '라이트' : '다크'} 미리보기`}
				role="img"
			>
				<div className="cd-site-bar">
					<b>HYEONIVERSE</b>
					<span>Works</span>
					<span>Posts</span>
					<span>About</span>
					<i className={`fa-solid ${mode === 'light' ? 'fa-sun' : 'fa-moon'}`} />
				</div>
				<div className="cd-site-hero">
					<div>
						<small>Portfolio</small>
						<p>
							작업물과 글을,
							<br />
							움직이는 화면으로.
						</p>
						<span className="cd-site-button">작업물 보기</span>
					</div>
					<span className="cd-torus" />
				</div>
				<div className="cd-site-cards">
					{['웹', '모바일 앱', '게임'].map((tag) => (
						<div key={tag}>
							<span className="cd-site-thumb" />
							<em>{tag}</em>
							<span className="cd-site-line" />
							<span className="cd-site-line short" />
						</div>
					))}
				</div>
			</div>
			<div className="cd-themes-side">
				<div className="cd-themes-top">
					<p className="cd-themes-name">{theme.name}</p>
					<div className="cd-seg" role="group" aria-label="모드">
						{(['light', 'dark'] as const).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={mode === value}
								onClick={() => {
									setTouched(true);
									setMode(value);
								}}
							>
								<i className={`fa-solid ${value === 'light' ? 'fa-sun' : 'fa-moon'}`} />{' '}
								{value === 'light' ? '라이트' : '다크'}
							</button>
						))}
					</div>
				</div>
				<ul className="cd-swatches" aria-label="테마 프리셋">
					{palette.map((swatch, i) => (
						<li key={swatch.name}>
							<button
								type="button"
								aria-pressed={i === index}
								title={swatch.name}
								aria-label={swatch.name}
								onClick={() => {
									setTouched(true);
									setIndex(i);
								}}
								style={
									{
										'--s-accent': swatch.accent,
										'--s-bg': mode === 'light' ? swatch.lightBg : swatch.darkBg,
									} as React.CSSProperties
								}
							/>
						</li>
					))}
				</ul>
				<dl className="cd-themes-five">
					{(
						[
							['강조', theme.accent],
							['라이트 바탕', theme.lightBg],
							['라이트 글자', theme.lightText],
							['다크 바탕', theme.darkBg],
							['다크 글자', theme.darkText],
						] as const
					).map(([label, color]) => (
						<div key={label}>
							<dt>
								<i style={{ backgroundColor: color }} />
								{label}
							</dt>
							<dd>{color}</dd>
						</div>
					))}
				</dl>
				<ul className="cd-contrast" aria-label="대비 점검">
					<li data-grade={grade(body)}>
						본문 <b>{body.toFixed(1)}:1</b> <span>{grade(body)}</span>
					</li>
					<li data-grade={grade(accent)}>
						강조 글자 <b>{accent.toFixed(1)}:1</b>
						{accentText !== theme.accent && <small>명도 보정 {accentText}</small>}
						<span>{grade(accent)}</span>
					</li>
					<li data-grade={grade(button)}>
						강조 면 위 글자 <b>{button.toFixed(1)}:1</b> <span>{grade(button)}</span>
					</li>
				</ul>
				<p className="cd-hint">토러스는 프리셋을 바꿔도 그대로이고, 라이트·다크에서만 재질이 바뀝니다</p>
			</div>
		</div>
	);
};
