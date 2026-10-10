import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { cheer } from './demoEvent';

/** 파형 편집기가 다루는 실제 Fish 음성 (그 사이트 갤러리가 트는 파일에서 두 문장만 잘라 냈다) */
const FISH_SAMPLE = '/imgs/projects/hyeoniverse/gallery/voice-sample.mp3';
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
export const Wave: React.FC = () => {
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
							style={{ flexGrow: clip.length, ...cssVars({ dx: drag?.from === n ? `${drag.dx}px` : '0px' }) }}
							data-index={n}
							data-dragging={drag?.from === n || undefined}
							data-pressing={pressing === n || undefined}
						>
							<span className="cd-clip-no">{n + 1}</span>
							{clip.map((sample, i) => (
								<i
									key={i}
									style={cssVars({ h: SAMPLES[sample] })}
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
