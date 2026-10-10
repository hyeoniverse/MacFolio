import React, { useState, useEffect, useRef } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { SLIDES } from './slides';
import { useInView } from './useInView';

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
export const Slides: React.FC = () => {
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
		<div className="cd-slides" style={cssVars({ ms: `${ms}ms` })}>
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
							style={cssVars({
								d: Math.max(-2, Math.min(2, d)),
								a: Math.min(2, Math.abs(d)),
								r: Math.max(-1, Math.min(1, d)),
							})}
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
