// HYEONIVERSE 페이지에서 직접 만져 보는 데모: 그 사이트의 관리자 기능(슬라이드 갤러리와 음성, TTS, 파형 편집,
// PDF·PPTX 변환, 자동 번역, AI 요약, AI 커버)과 테마 프리셋을 같은 규칙으로 흉내 낸다.
// 음성 만들기·번역·요약·커버는 MacFolio API를 거쳐 실제 AI 서비스를 부른다 (하루 상한이 있다)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectPoint, ThemeSwatch } from '@/shared/profile';
import { scrollParent } from '@/apps/safari/project/scroll';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { env } from '@/shared/config/env';
import '@/apps/safari/project/CreativeDemos.css';

/** 데모가 지금 무엇을 하는지 페이지(몽이)에 알리는 이벤트: busy 만드는 중, done 끝, error 실패, play 재생 */
export const DEMO_EVENT = 'cr-demo';
export type DemoKind = NonNullable<ProjectPoint['demo']>;
export type DemoState = 'busy' | 'done' | 'error' | 'play';
const cheer = (kind: DemoKind, state: DemoState) =>
	window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: { kind, state } }));

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
 * 음성이 있는 장은 그 음성을 만든 발표 대본을 그대로 자막으로 쓴다(읽기 사전 표기 [:has()|has 선택자]는 화면 표기로). 맺음말 장은 대본이 없다
 */
/** page는 그 사이트 갤러리의 쪽 번호(음성 파일 이름), sheet는 그림으로 쓰는 발표 PDF의 쪽 (5쪽부터 PDF가 한 쪽씩 뒤다) */
const SLIDE_DATA: { page: number; sheet?: number; script: string; audio?: boolean; ms?: number }[] = [
	{
		page: 1,
		script:
			"지금 보시는 프로젝트는 제가 직접 기획하고 설계해서 운영하고 있는 'Hyeoniverse'입니다. 단순히 포트폴리오를 보여주는 웹사이트를 만드는 것을 목표로 하지 않았습니다. 실제 서비스라고 생각하고, 공개된 사이트뿐만 아니라 콘텐츠를 관리할 수 있는 CMS와 데이터베이스, 권한, 보안, 테스트, 배포까지 직접 구성했습니다. 기술 스택은 Next.js, React, TypeScript를 중심으로 Supabase와 Vercel을 사용했습니다.",
		audio: true,
		ms: 26267,
	},
	{
		page: 2,
		script:
			'먼저 이 프로젝트에서 제가 가장 보여드리고 싶은 부분을 세 가지로 정리했습니다. 첫 번째는 성능 최적화입니다. 느린 화면을 단순히 코드 일부를 수정하는 방식으로 해결하지 않고, 렌더링과 스타일 계산, 네트워크를 나눠 측정하면서 원인을 찾았습니다. 두 번째는 보안 설계입니다. 개발자가 모든 상황에서 실수하지 않을 것이라고 가정하기보다, 코드에서 실수가 발생해도 데이터가 보호될 수 있도록 권한을 DB의 RLS로 옮겼습니다. 세 번째는 접근성입니다. 공개 사이트뿐만 아니라 제가 실제로 사용하는 관리자 편집기도 같은 기준으로 접근성을 점검했습니다. 이 세 가지를 중심으로 제가 어떤 방식으로 문제를 발견하고 해결했는지 보여드리겠습니다.',
		audio: true,
		ms: 41220,
	},
	{
		page: 3,
		script:
			'전체적인 규모를 먼저 보여드리겠습니다. 현재 사이트는 한글과 영어 두 가지 언어를 지원하고, 소유자·관리자·저자·방문자로 나뉘는 4단계 권한을 사용하고 있습니다. 예약 발행과 휴지통 정리 같은 작업은 DB의 예약 작업으로 자동화했고, 번역도 하나의 서비스에 의존하지 않고 여러 제공자를 순서대로 사용하도록 구성했습니다. 성능 측면에서는 운영 환경에서 여러 번 측정한 중앙값 기준으로 성능 97점, 접근성과 SEO는 100점을 기록했습니다. 이 숫자들은 단순히 기능을 많이 넣었다는 것을 보여주기보다는, 혼자 운영하는 서비스에서 사람이 계속 확인하지 않아도 되도록 어떤 부분을 자동화하고 구조화했는지를 보여주는 지표입니다.',
		audio: true,
		ms: 40100,
	},
	{
		page: 4,
		script:
			'사이트는 크게 방문자가 사용하는 공개 영역과 제가 콘텐츠를 관리하는 관리자 CMS로 나뉩니다. 공개 영역에서는 포트폴리오 작업물, 블로그, 댓글, 다국어와 다크 모드 등을 제공합니다. 특히 작업물은 하나의 고정된 레이아웃이 아니라 여러 가지 갤러리 형태를 선택할 수 있도록 구성했습니다. 관리자에서는 리치 텍스트 편집기를 직접 구축했고, 예약 발행과 휴지통, 자동 번역, 트래픽 분석, 저자 초대와 권한 관리까지 할 수 있습니다. 즉, 단순히 화면을 만드는 프로젝트라기보다 콘텐츠를 계속 만들고 관리할 수 있는 하나의 서비스로 구성했습니다.',
		audio: true,
		ms: 35660,
	},
	{
		page: 5,
		sheet: 6,
		script:
			'비슷하게 성능을 측정하면서 발견한 문제가 하나 더 있었습니다. 이번에는 방문자가 보는 페이지가 아니라, 제가 실제로 콘텐츠를 작성하는 관리자 편집기에서 입력 지연이 발생했습니다. 같은 편집기를 사용하는 새 글 화면과 비교했을 때 작업물 편집기에서 한 글자를 입력하는 데 걸리는 시간이 약 2.5배 더 길었습니다. 이번에는 CPU를 4배 느리게 설정하고 같은 입력을 여러 번 측정하면서 프로파일링했습니다. 처음에는 React 렌더링이 문제라고 생각할 수 있어서 렌더링 횟수부터 확인했습니다. 그런데 렌더링을 줄인 뒤에도 지연이 남아 있었고, 스타일 계산 시간을 확인해보니 CSS 쪽에 문제가 있었습니다. 특히 hover 상태에서 사용하고 있던 :has() 선택자와 하위 선택자가 포인터가 움직일 때마다 넓은 범위의 스타일을 다시 계산하게 만들고 있었습니다. 그래서 섹션별 메모이제이션으로 변경된 영역만 다시 렌더링하도록 했고, CSS 선택자도 포인터 이벤트에서 상태를 직접 전달하는 방식으로 변경했습니다. 그 결과 느린 입력까지 포함해 90%의 입력이 120ms에서 72ms 안에 반영되도록 줄였고, React 렌더링도 10회에서 0회로 줄였습니다. 앞의 사례와 마찬가지로, 특정 기술을 먼저 적용하기보다는 측정하면서 실제 병목이 어디에 있는지를 확인한 뒤 해결 방법을 선택했습니다.',
		audio: true,
		ms: 76640,
	},
	{
		page: 8,
		sheet: 9,
		script:
			'지금까지 말씀드린 문제들을 수정한 결과입니다. 편집기 입력 지연은 120ms에서 72ms로 40% 줄였고, 글 목록 LCP는 7.8초에서 2.9초, 프로필 LCP는 9.7초에서 2.7초로 줄였습니다. 홈페이지의 다운로드 용량도 4.8MB에서 1MB로 줄였습니다. 접근성 측면에서는 편집기의 점수를 80점에서 96점까지 개선했습니다. 여기서 모든 수치는 같은 조건에서 여러 번 측정한 중앙값을 기준으로 비교했습니다. 그리고 여기서 한 가지 중요한 점이 있습니다. 이 프로젝트에서는 모든 최적화 시도가 항상 좋은 결과로 이어졌던 것은 아닙니다.',
		audio: true,
		ms: 38060,
	},
	{
		page: 11,
		sheet: 12,
		script:
			'이런 설계를 실제로 사용하는 공간이 관리자 CMS입니다. 콘텐츠 작성부터 사이트 설정, 트래픽 확인, 권한 관리까지 한 곳에서 할 수 있도록 구성했습니다. 특히 글을 작성하다가 브라우저가 종료되거나 새로고침되는 상황을 고려해서 입력 내용을 로컬에도 저장하고, 일정 시간 입력이 멈추면 서버에 저장하도록 했습니다. 다른 화면에서 먼저 저장한 경우에는 버전 충돌을 감지해서 알려줍니다. 또 예약 발행이나 휴지통 삭제처럼 사람이 계속 확인해야 하는 작업은 자동으로 처리하도록 했습니다. 결과적으로 혼자 운영하더라도 반복적인 관리 작업에 드는 부담을 줄이는 방향으로 CMS를 구성했습니다.',
		audio: true,
		ms: 39110,
	},
	{ page: 19, script: '' },
];
const SLIDES = SLIDE_DATA.map(({ page, sheet = page, audio, ...slide }) => ({
	...slide,
	page,
	src: `${GALLERY}/slide-${String(sheet).padStart(2, '0')}.jpg`,
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
	// 일시정지: 음성·진행 막대·자막이 그 자리에서 멈추고, 다시 누르면 이어서
	const [paused, setPaused] = useState(false);
	// 지금 장을 얼마나 읽었는지 (0~1): 음성이 나오면 음성의 재생 위치, 아니면 흐른 시간으로 잰다. 자막은 이 값을 따른다
	const [progress, setProgress] = useState(0);
	const elapsed = useRef(0);
	// 같은 장을 다시 읽을 때도 진행 막대와 음성이 처음부터 돌게 바꾸는 번호
	const [run, setRun] = useState(0);
	const drag = useRef<number | null>(null);
	const audio = useRef<HTMLAudioElement | null>(null);
	const lastRun = useRef(-1);
	const slide = SLIDES[current];
	const playing = inView && !paused && (mode === 'sound' || mode === 'silent');
	// 소리와 함께일 때 음성 파일·브라우저 음성이 있는 장은 음성이 끝나야 넘어간다 (막대는 어림 시간)
	const voiced = mode === 'sound' && (!!slide.audio || (!!slide.script && canSpeak()));
	const go = (index: number) => {
		setCurrent(Math.max(0, Math.min(SLIDES.length - 1, index)));
		setRun((n) => n + 1);
		setPaused(false);
		setProgress(0);
		elapsed.current = 0;
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
			if (inView && !paused) void el.play().catch(() => setMode('silent'));
			else el.pause();
			return () => el.pause();
		}
		if (slide.script && canSpeak() && inView && !paused) {
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
	}, [mode, slide, run, inView, paused]);
	useEffect(
		() => () => {
			audio.current?.pause();
			if (canSpeak()) window.speechSynthesis.cancel();
		},
		[]
	);

	const ms = slideMs(slide);
	// 읽는 동안 매 프레임 진행을 잰다: 음성 파일이 나오면 그 재생 위치(일시정지·되감기에도 정확히 맞는다), 아니면 흐른 시간
	useEffect(() => {
		if (!playing) return;
		let frame = 0;
		let last = performance.now();
		const tick = (now: number) => {
			elapsed.current += now - last;
			last = now;
			const el = audio.current;
			const fromAudio = mode === 'sound' && slide.audio && el && el.duration > 0 && el.src.endsWith(slide.audio);
			const next = Math.min(1, fromAudio ? el.currentTime / el.duration : elapsed.current / ms);
			setProgress((now) => (Math.abs(now - next) > 0.002 ? next : now));
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing, mode, slide, ms]);

	// 자막은 문장 하나씩: 문장마다 글자 수 비율로 시작(start)과 길이(length)를 정하고, 진행이 그 문장에 있는 동안 그 문장만 보이며 읽은 낱말이 진해진다
	const sentences = slide.script.split(/(?<=[.?!])\s+/).filter(Boolean);
	const total = Math.max(1, sentences.join('').length);
	const lengths = sentences.map((sentence) => sentence.length / total);
	const cues = sentences.map((sentence, i) => ({
		start: lengths.slice(0, i).reduce((sum, length) => sum + length, 0),
		length: lengths[i],
		words: sentence.split(' '),
	}));
	const cue = cues.filter((item) => item.start <= progress).at(-1) ?? cues[0];
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
					if (event.key === ' ' && mode !== 'ask') {
						event.preventDefault();
						setPaused(!paused);
					}
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
			{/* 자막을 꺼도 자리는 그대로 둔다 (켜고 끌 때 아래가 움직이지 않게) */}
			<p
				className="cd-caption"
				key={`c${run}-${current}`}
				data-playing={playing || undefined}
				data-off={!captions || undefined}
				aria-hidden={!captions || undefined}
			>
				{cue ? (
					<span className="cd-cue" key={cue.start}>
						{cue.words.map((word, i) => (
							<span key={i} data-read={cue.start + (i / cue.words.length) * cue.length <= progress || undefined}>
								{word}{' '}
							</span>
						))}
					</span>
				) : slide.audio ? null : (
					<em>대본이 없는 장은 4초 보여 주고 넘어갑니다</em>
				)}
			</p>
			<div className="cd-slides-bar">
				<button
					type="button"
					aria-label={paused ? '재생' : '일시정지'}
					title={paused ? '재생 (Space)' : '일시정지 (Space)'}
					disabled={mode === 'ask'}
					onClick={() => {
						if (mode === 'stopped') {
							setMode('silent');
							go(0);
						} else setPaused(!paused);
					}}
				>
					<i className={`fa-solid fa-fw ${paused || mode === 'stopped' ? 'fa-play' : 'fa-pause'}`} />
				</button>
				<button
					type="button"
					aria-pressed={mode === 'sound'}
					onClick={() => {
						if (mode === 'stopped') go(0);
						setMode(mode === 'sound' ? 'silent' : 'sound');
					}}
				>
					<i className={`fa-solid fa-fw ${mode === 'sound' ? 'fa-volume-high' : 'fa-volume-xmark'}`} /> 음성
				</button>
				<button type="button" aria-pressed={captions} onClick={() => setCaptions(!captions)}>
					<i className="fa-solid fa-fw fa-closed-captioning" /> 자막
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

type Provider = 'fish' | 'google' | 'edge';
type ProviderState = 'idle' | 'trying' | 'fail' | 'ok' | 'skip';
const PROVIDERS: Provider[] = ['fish', 'google', 'edge'];
const PROVIDER_NAME: Record<Provider, string> = { fish: 'Fish', google: 'Google', edge: 'Edge' };

/** 파형 편집기가 다루는 실제 Fish 음성 (그 사이트 갤러리가 트는 파일에서 두 문장만 잘라 냈다) */
const FISH_SAMPLE = '/imgs/projects/hyeoniverse/gallery/voice-sample.mp3';
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
const Voice: React.FC = () => {
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
					style={{ '--fill': `${length ? (time / length) * 100 : 0}%` } as React.CSSProperties}
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
/** 클립을 끌기 시작하려고 길게 누르는 시간 (ms) */
const LONG_PRESS_MS = 400;
/** 클립 위쪽 번호 띠의 높이 (px): 여기를 길게 눌러야 클립을 끈다 */
const CLIP_BAND = 18;
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
 * 되돌리기 50단계. 클립 위 번호 띠를 길게 눌러 끌면 순서가 바뀌고, 재생하면 편집한 순서 그대로 소리가 난다.
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
	// 길게 누르는 중인 클립 (손을 떼거나 움직이면 풀린다)
	const [pressing, setPressing] = useState<number | null>(null);
	const press = useRef<{ x: number; timer: number } | null>(null);
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
	const cancelPress = () => {
		if (press.current) window.clearTimeout(press.current.timer);
		press.current = null;
		setPressing(null);
	};
	/** 클립 끌기: 창 전체에서 움직임을 받아, 클립이 손을 따라오고 놓은 자리로 옮긴다 */
	const startDrag = (n: number, startX: number) => {
		let latest = { from: n, dx: 0, ...dropAt(startX, n) };
		setDrag(latest);
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
			cheer('wave', 'play');
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
					// 클립 위쪽 번호 띠를 길게 누르고 있으면(움직이지 않고) 그 클립을 끌어 순서를 바꾼다.
					// 파형 쪽은 늘 구간 고르기다 (누른 채 잠깐 멈췄다 끌어도 구간이 골라지게)
					const clip = (event.target as HTMLElement).closest<HTMLElement>('.cd-clip');
					const onBand = clip && event.clientY - clip.getBoundingClientRect().top < CLIP_BAND;
					if (clip && onBand && clips.length > 1) {
						const n = Number(clip.dataset.index);
						const x = event.clientX;
						setPressing(n);
						press.current = {
							x,
							timer: window.setTimeout(() => {
								press.current = null;
								setPressing(null);
								anchor.current = null;
								setSpan(null);
								startDrag(n, x);
							}, LONG_PRESS_MS),
						};
					}
				}}
				onPointerMove={(event) => {
					if (press.current && Math.abs(event.clientX - press.current.x) > 5) cancelPress();
					if (anchor.current === null) return;
					const at = indexAt(event.clientX);
					const a = Math.min(anchor.current, at);
					const b = Math.max(anchor.current, at);
					setSpan(b - a > 0 ? [a, b] : null);
				}}
				onPointerUp={() => {
					cancelPress();
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
							data-index={n}
							data-dragging={drag?.from === n || undefined}
							data-pressing={pressing === n || undefined}
						>
							<span className="cd-clip-no">{n + 1}</span>
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
				실제 Fish 음성입니다. 파형을 끌어 구간을 고르고 자르거나 나눈 뒤, 클립 위 번호 띠를 길게 눌러 끌면 순서가
				바뀝니다. 재생하면 편집한 순서대로 들립니다
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

/** 실제 AI를 부르는 데모(번역, 요약, 커버)의 하루 남은 횟수 */
type Quota = { remaining: number; perIp: number; total: number };

/**
 * 실제 AI를 부르는 데모가 함께 쓰는 서버 호출. 처음에 남은 횟수를 받아 두고, 보낼 때마다 고친다.
 * 실패하면 화면에 그대로 보일 문장을 돌려준다 (서버가 쓴 이유가 있으면 그것을)
 */
const useLiveDemo = <T,>(path: 'translate' | 'summary' | 'cover', what: string) => {
	const api = env.apiUrl;
	const [quota, setQuota] = useState<Quota | null>(null);
	useEffect(() => {
		if (!api) return;
		const controller = new AbortController();
		fetch(`${api}/${path}`, { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => data && setQuota(data))
			.catch(() => undefined);
		return () => controller.abort();
	}, [api, path]);

	const send = useCallback(
		async (body: object): Promise<{ data: T; error?: undefined } | { data?: undefined; error: string }> => {
			if (!api) {
				cheer(path, 'error');
				return { error: `이 화면에는 ${what} 서버가 연결되어 있지 않습니다.` };
			}
			cheer(path, 'busy');
			try {
				const response = await fetch(`${api}/${path}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});
				const data = (await response.json().catch(() => ({}))) as T & {
					remaining?: number;
					message?: string | string[];
				};
				// 다 썼으면(429) 남은 횟수가 실려 오지 않을 수 있다
				const remaining = typeof data.remaining === 'number' ? data.remaining : response.status === 429 ? 0 : null;
				if (remaining !== null) setQuota((now) => (now ? { ...now, remaining } : now));
				if (!response.ok) {
					const reason = Array.isArray(data.message) ? data.message[0] : data.message;
					cheer(path, 'error');
					return { error: reason ?? `${what}지 못했습니다.` };
				}
				cheer(path, 'done');
				return { data };
			} catch {
				cheer(path, 'error');
				return { error: '서버에 닿지 못했습니다. 잠시 뒤 다시 해 보세요.' };
			}
		},
		[api, path, what]
	);
	return { quota, send };
};

/** 남은 횟수 칩: 받기 전에는 하루 상한을 */
const QuotaChip: React.FC<{ quota: Quota | null; fallback: number }> = ({ quota, fallback }) => (
	<span className="cd-chip">{quota ? `오늘 ${quota.remaining}번 남음` : `하루 ${fallback}번`}</span>
);

/** 번역 데모의 칸: HYEONIVERSE 작업물의 실제 한국어 부제와 설명. 고칠 수 있다 */
const FIELDS = [
	{ label: '부제', ko: '디자인 시스템부터 관리자 CMS 까지 혼자 설계하고 운영하는 포트폴리오 사이트' },
	{
		label: '설명',
		ko: '흩어져 있던 프로젝트와 글을 한 곳에서 보여 주고 계속 갱신하기 위해 만든 개인 포트폴리오입니다.',
	},
	{ label: '갤러리 대본 4', ko: '방문자가 보는 사이트와, 그 사이트를 운영하는 관리자 CMS를 함께 만들었습니다.' },
];
/** 세 칸을 합친 글자 수 상한 (서버도 같은 값으로 막는다) */
const MAX_TRANSLATE_CHARS = 200;
type TranslateProvider = 'deepl' | 'google';
const TRANSLATE_NAME: Record<TranslateProvider, string> = { deepl: 'DeepL', google: 'Google' };

/**
 * 번역: 한국어 칸을 고치고 EN을 누르면, MacFolio API가 DeepL(실패하면 Google)로 세 칸을 한 번에 실제로 번역한다.
 * 비용 때문에 세 칸 합쳐 200자까지, IP마다 하루 3번(사이트 전체 50번). 상태가 바뀌어도 칸 크기는 그대로다
 */
const Translate: React.FC = () => {
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [ko, setKo] = useState(() => FIELDS.map((field) => field.ko));
	const [made, setMade] = useState<{ texts: string[]; provider: TranslateProvider; note?: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [run, setRun] = useState(0);
	const { quota, send } = useLiveDemo<{
		provider: TranslateProvider;
		attempts?: { provider: TranslateProvider; state: string; reason?: string }[];
		texts: string[];
	}>('translate', '번역하');
	const used = [...ko.join('')].length;
	const left = quota?.remaining;

	const translate = async () => {
		setLang('en');
		if (ko.some((text) => !text.trim())) {
			setMessage('비어 있는 한국어 칸이 있습니다.');
			return;
		}
		setBusy(true);
		setMessage(null);
		const { data, error } = await send({ texts: ko, from: 'ko', to: 'en' });
		setBusy(false);
		if (!data || !Array.isArray(data.texts)) {
			setMessage(error ?? '번역하지 못했습니다.');
			return;
		}
		// 앞 공급자가 실패해 넘어왔으면 그 이유를 함께 보여 준다
		const failed = data.attempts?.find((attempt) => attempt.state === 'fail');
		setMade({
			texts: data.texts,
			provider: data.provider,
			note: failed ? `${TRANSLATE_NAME[failed.provider]} 실패(${failed.reason ?? ''}) → ` : undefined,
		});
		setRun((n) => n + 1);
	};
	const switchTo = (value: 'ko' | 'en') => {
		setLang(value);
		if (value === 'en' && !made && !busy && !message) void translate();
	};

	const status = message
		? message
		: lang === 'ko'
			? '한국어 칸을 고치고 EN을 눌러 보세요. 비어 있는 영어 칸을 번역해 채웁니다'
			: busy
				? 'DeepL로 번역하는 중'
				: made
					? `${made.note ?? ''}${TRANSLATE_NAME[made.provider]}로 번역했습니다`
					: '다시 번역을 눌러 보세요';

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
				<button
					type="button"
					className="cd-ghost"
					onClick={() => void translate()}
					disabled={busy || !used || used > MAX_TRANSLATE_CHARS || left === 0}
				>
					다시 번역
				</button>
				<span className="cd-chip">
					<i className="fa-solid fa-language" /> {made ? TRANSLATE_NAME[made.provider] : 'DeepL → Google'}
				</span>
				<QuotaChip quota={quota} fallback={3} />
			</div>
			<p className="cd-live-info">
				<i className="fa-solid fa-circle-info" />
				실제로 번역합니다. 세 칸 합쳐 {MAX_TRANSLATE_CHARS}자까지, 하루 {quota?.perIp ?? 3}번(사이트 전체{' '}
				{quota?.total ?? 50}번) 번역할 수 있습니다.
			</p>
			<dl className="cd-fields">
				{FIELDS.map((field, i) => (
					<div key={field.label}>
						<dt>{field.label}</dt>
						{/* 두 줄 자리를 늘 잡아 두고 내용만 바꾼다 (상태에 따라 아래가 밀리지 않게) */}
						<dd data-busy={(lang === 'en' && busy) || undefined}>
							{lang === 'ko' ? (
								<textarea
									aria-label={`${field.label} (한국어)`}
									value={ko[i]}
									rows={2}
									disabled={busy}
									onChange={(event) => {
										const next = [...ko];
										next[i] = event.target.value;
										setKo(next);
										// 원문이 바뀌면 옛 번역은 맞지 않으므로 비운다
										setMade(null);
										setMessage(null);
									}}
								/>
							) : busy ? (
								<span className="cd-shimmer" />
							) : made ? (
								<span className="cd-typed" key={run} style={{ '--i': i } as React.CSSProperties}>
									{made.texts[i]}
								</span>
							) : (
								<em>비어 있음</em>
							)}
						</dd>
					</div>
				))}
			</dl>
			<div className="cd-live-foot">
				<p className="cd-hint" role="status" data-error={(message && !busy) || undefined}>
					{status}
				</p>
				<small data-over={used > MAX_TRANSLATE_CHARS || undefined}>
					{used}/{MAX_TRANSLATE_CHARS}
				</small>
			</div>
		</div>
	);
};

/** 요약할 글: HYEONIVERSE 작업물의 실제 설명 (고치거나 붙여 넣을 수 있다) */
const SUMMARY_SOURCE =
	'작업물과 글을 보여 주는 공개 화면부터, 그 글을 직접 쓰고 고치는 관리자 화면까지 한 저장소에 담은 개인 포트폴리오입니다. 흩어져 있던 프로젝트와 글을 한 곳에서 보여 주고 계속 갱신하기 위해 만들었습니다. 공개 페이지와 디자인 시스템, 글 편집기와 관리자 CMS까지 한 사람이 설계하고 운영합니다. 글과 작업물은 한국어와 영어 칸을 따로 두고, 한쪽만 써도 나머지는 번역이 채웁니다.';
/** 한 번에 요약하는 글자 수 (서버도 같은 값으로 막는다) */
const MAX_SUMMARY_CHARS = 800;

/**
 * AI 요약: 글을 고치거나 붙여 넣고 발행하면, MacFolio API가 Gemini로 한국어·영어 요약을 실제로 만든다.
 * 머리를 누르면 접고 펼친다. 비용 때문에 800자까지, IP마다 하루 3번(사이트 전체 50번)
 */
const Summary: React.FC = () => {
	const [text, setText] = useState(SUMMARY_SOURCE);
	const [lang, setLang] = useState<'ko' | 'en'>('ko');
	const [open, setOpen] = useState(true);
	const [busy, setBusy] = useState(false);
	const [made, setMade] = useState<{ ko: string; en: string } | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const { quota, send } = useLiveDemo<{ ko: string; en: string }>('summary', '요약하');
	const left = quota?.remaining;

	const publish = async () => {
		setBusy(true);
		setOpen(true);
		setMessage(null);
		const { data, error } = await send({ text });
		setBusy(false);
		if (!data?.ko || !data.en) {
			setMessage(error ?? '요약을 만들지 못했습니다.');
			return;
		}
		setMade({ ko: data.ko, en: data.en });
	};

	return (
		<div className="cd-summary">
			<div className="cd-translate-head">
				<button
					type="button"
					className="cd-primary"
					disabled={busy || !text.trim() || left === 0}
					onClick={() => void publish()}
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
				<QuotaChip quota={quota} fallback={3} />
			</div>
			<p className="cd-live-info">
				<i className="fa-solid fa-circle-info" />
				실제로 요약합니다. 글을 고치거나 붙여 넣고 발행해 보세요. {MAX_SUMMARY_CHARS}자까지, 하루 {quota?.perIp ?? 3}
				번(사이트 전체 {quota?.total ?? 50}번) 만들 수 있습니다.
			</p>
			<label className="cd-voice-input">
				<span>본문</span>
				<textarea
					value={text}
					maxLength={MAX_SUMMARY_CHARS}
					rows={4}
					disabled={busy}
					onChange={(event) => setText(event.target.value)}
				/>
				<small>
					{[...text].length}/{MAX_SUMMARY_CHARS}
				</small>
			</label>
			<div className="cd-summary-box" data-open={open || undefined}>
				<button type="button" className="cd-summary-head" aria-expanded={open} onClick={() => setOpen(!open)}>
					<span>
						<i className="fa-solid fa-wand-magic-sparkles" /> AI 요약
					</span>
					<i className="fa-solid fa-chevron-down" />
				</button>
				<div className="cd-summary-body">
					<div>
						{/* 세 줄 자리를 늘 잡아 두고 내용만 바꾼다 */}
						<div className="cd-summary-text" data-empty={(!made && !busy) || undefined}>
							{busy ? (
								<p className="cd-dots">
									<i />
									<i />
									<i /> 요약을 만드는 중
								</p>
							) : made ? (
								<p key={`${lang}-${made.ko}`} className="cd-typed">
									{made[lang]}
								</p>
							) : (
								<p>발행하면 여기에 한국어·영어 요약이 붙습니다</p>
							)}
						</div>
					</div>
				</div>
			</div>
			<div className="cd-live-foot">
				<p className="cd-hint" role="status" data-error={(message && !busy) || undefined}>
					{message ?? (made ? 'Gemini로 만든 요약입니다. KO·EN으로 바꿔 보세요' : '예시: HYEONIVERSE 작업물의 설명')}
				</p>
			</div>
		</div>
	);
};

/** 커버 데모의 스타일: HYEONIVERSE 커버 선택창의 열 가지 가운데 넷 */
const COVER_STYLES = [
	{ key: 'abstract', label: 'Abstract' },
	{ key: 'minimal', label: 'Minimal' },
	{ key: 'watercolor', label: 'Watercolor' },
	{ key: '3d-render', label: '3D' },
] as const;
type CoverProvider = 'nanobanana' | 'huggingface';
const COVER_PROVIDERS: CoverProvider[] = ['nanobanana', 'huggingface'];
const COVER_NAME: Record<CoverProvider, string> = { nanobanana: 'NanoBanana', huggingface: 'Hugging Face' };
/** 제목 글자 수 (서버도 같은 값으로 막는다) */
const MAX_COVER_CHARS = 60;

/** 커버가 없을 때의 바탕 (HYEONIVERSE처럼 제목으로 고른 그라데이션: 같은 제목은 늘 같은 색) */
const seededGradient = (seed: string) => {
	let hash = 0;
	for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
	const hue = Math.abs(hash) % 360;
	return `linear-gradient(135deg, oklch(62% 0.14 ${hue}), oklch(38% 0.1 ${(hue + 70) % 360}))`;
};

/**
 * AI 커버: 제목을 쓰고 그리면, MacFolio API가 NanoBanana(실패하면 Hugging Face FLUX)로 16:9 커버를 실제로 그린다.
 * 공급자를 눌러 막아 두면 대체 순서를 볼 수 있다. 그림은 비싸서 IP마다 하루 3번, 사이트 전체 10번
 */
const Cover: React.FC = () => {
	const [title, setTitle] = useState('혼자 설계하고 운영하는 포트폴리오');
	const [style, setStyle] = useState<(typeof COVER_STYLES)[number]['key']>('abstract');
	const [blocked, setBlocked] = useState<CoverProvider[]>([]);
	const [states, setStates] = useState<Record<CoverProvider, ProviderState>>({
		nanobanana: 'idle',
		huggingface: 'idle',
	});
	const [reasons, setReasons] = useState<Partial<Record<CoverProvider, string>>>({});
	const [busy, setBusy] = useState(false);
	const [made, setMade] = useState<{ src: string; provider: CoverProvider; title: string } | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const { quota, send } = useLiveDemo<{
		provider: CoverProvider;
		attempts?: { provider: CoverProvider; state: 'ok' | 'fail' | 'skip'; reason?: string }[];
		image: string;
		mime: string;
	}>('cover', '그리');
	const left = quota?.remaining;

	const draw = async () => {
		setBusy(true);
		setMessage(null);
		setReasons({});
		const first = COVER_PROVIDERS.find((provider) => !blocked.includes(provider));
		setStates({
			nanobanana: blocked.includes('nanobanana') ? 'skip' : first === 'nanobanana' ? 'trying' : 'idle',
			huggingface: blocked.includes('huggingface') ? 'skip' : first === 'huggingface' ? 'trying' : 'idle',
		});
		const { data, error } = await send({ title, style, skip: blocked });
		setBusy(false);
		const next: Record<CoverProvider, ProviderState> = { nanobanana: 'idle', huggingface: 'idle' };
		const why: Partial<Record<CoverProvider, string>> = {};
		for (const attempt of data?.attempts ?? []) {
			next[attempt.provider] = attempt.state;
			if (attempt.reason) why[attempt.provider] = attempt.reason;
		}
		setStates(next);
		setReasons(why);
		if (!data?.image) {
			setMessage(error ?? '커버를 그리지 못했습니다.');
			return;
		}
		setMade({ src: `data:${data.mime || 'image/jpeg'};base64,${data.image}`, provider: data.provider, title });
	};

	const status = message
		? message
		: busy
			? '그리는 중 (1분 가까이 걸릴 수 있습니다)'
			: made
				? `${COVER_NAME[made.provider]}로 그렸습니다${made.provider !== 'nanobanana' && !blocked.includes('nanobanana') ? ' (앞 공급자가 실패해 넘어감)' : ''}`
				: '제목을 고치고 그려 보세요';

	return (
		<div className="cd-cover">
			<p className="cd-live-info">
				<i className="fa-solid fa-circle-info" />
				실제로 그립니다. 그림은 비싸서 하루 {quota?.perIp ?? 3}번(사이트 전체 {quota?.total ?? 10}번)만 그릴 수
				있습니다. 공급자를 눌러 막아 두면, 실패했을 때 다음 공급자로 넘어가는 대체 순서를 볼 수 있습니다.
			</p>
			<label className="cd-voice-input">
				<span>제목</span>
				<input
					value={title}
					maxLength={MAX_COVER_CHARS}
					disabled={busy}
					onChange={(event) => setTitle(event.target.value)}
				/>
				<small>
					{[...title].length}/{MAX_COVER_CHARS}
				</small>
			</label>
			<div className="cd-translate-head">
				<div className="cd-seg" role="group" aria-label="스타일">
					{COVER_STYLES.map((option) => (
						<button
							key={option.key}
							type="button"
							aria-pressed={style === option.key}
							disabled={busy}
							onClick={() => setStyle(option.key)}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>
			{/* 16:9 자리를 늘 잡아 두고 그림만 바꾼다. 그리기 전에는 제목으로 고른 그라데이션 (HYEONIVERSE의 빈 커버) */}
			<figure
				className="cd-cover-frame"
				data-busy={busy || undefined}
				style={{ backgroundImage: seededGradient(made?.title ?? title) }}
			>
				{made ? (
					<img src={made.src} alt={`"${made.title}" 제목으로 그린 커버`} />
				) : (
					<figcaption>{title.trim() || '제목'}</figcaption>
				)}
				{busy && <span className="cd-shimmer" aria-hidden />}
			</figure>
			<ol className="cd-voice-chain" data-count={2} aria-label="공급자 차례 (눌러서 막아 보기)">
				{COVER_PROVIDERS.map((provider) => (
					<li key={provider}>
						<button
							type="button"
							data-state={states[provider]}
							data-blocked={blocked.includes(provider) || undefined}
							disabled={busy}
							aria-pressed={blocked.includes(provider)}
							title={reasons[provider]}
							onClick={() =>
								setBlocked((now) =>
									now.includes(provider) ? now.filter((name) => name !== provider) : [...now, provider]
								)
							}
						>
							<strong>{COVER_NAME[provider]}</strong>
							<small>
								{states[provider] === 'trying'
									? '그리는 중'
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
			<div className="cd-voice-foot">
				<button
					type="button"
					className="cd-primary"
					onClick={() => void draw()}
					disabled={busy || !title.trim() || left === 0 || blocked.length === COVER_PROVIDERS.length}
				>
					<i className="fa-solid fa-wand-magic-sparkles" /> 커버 그리기
				</button>
				<p role="status" title={status}>
					{status}
				</p>
				<QuotaChip quota={quota} fallback={3} />
			</div>
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
	if (kind === 'cover') return <Cover />;
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
