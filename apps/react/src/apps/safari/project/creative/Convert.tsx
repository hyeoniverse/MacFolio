import React, { useState, useEffect, useRef, useCallback } from 'react';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { SLIDES } from './slides';
import { useInView } from './useInView';

/** 변환 데모의 단계: 읽기 → 장마다 그리기 → 올리기 → 끝 */
type Phase = 'idle' | 'read' | 'draw' | 'upload' | 'done';

/** PDF·PPTX를 장마다 그림으로: 화면에 들어오면 한 번 돌고, 파일 종류를 바꾸거나 다시 누르면 처음부터 */
export const Convert: React.FC = () => {
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
