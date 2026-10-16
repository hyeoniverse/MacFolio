// keynote 템플릿: 진짜 발표 슬라이드. 세로로 스크롤하는 페이지가 없고, Safari 페이지에 맞춘 16:9 무대에 한 번에 한 장만 띄운다.
// ←·→·Space·PageUp·PageDown 또는 무대를 눌러 넘기고(Shift를 누른 채 누르면 앞으로), 아래 막대에 얇은 진행 줄과 "3 / 18" 차례,
// 모든 슬라이드를 격자로 보는 슬라이드 목록(G), 긴 설명을 보이는 발표자 노트(N) 단추가 있다. 트러블슈팅은 문제 → 원인 → 해결 → 결과를
// 한 단계씩 쌓는다. 무대 콘셉트라 사이트 테마와 상관없이 검은 바탕이다. 지금 장의 구역만 페이지에 있다 (계약의 '열면 보이는' 변형).
// 계약은 templates/README.md
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { acceptsGameKey } from '@/apps/safari/project/dialogueKeys';
import { scrollParent } from '@/apps/safari/project/scroll';
import { FaIcon, Media, useLanding, useLandingAccent } from '@/apps/safari/project/landing';
import { keynoteAccent } from './accent';
import { KIND_ICONS, slidesOf, type Slide } from './deck';
import { SlideView } from './Slides';
import './Page.css';

/** 스크롤 상자의 높이를 --kn-vh(px)로 둔다: 무대가 Safari 페이지 한 화면에 꼭 맞는다 */
function useStageHeight(ref: React.RefObject<HTMLElement | null>) {
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const scroller = scrollParent(node);
		const measure = () => {
			const height = scroller ? scroller.clientHeight : window.innerHeight;
			if (height > 0) node.style.setProperty('--kn-vh', `${height}px`);
		};
		measure();
		window.addEventListener('resize', measure);
		const observer = typeof ResizeObserver === 'undefined' || !scroller ? null : new ResizeObserver(measure);
		observer?.observe(scroller!);
		return () => {
			window.removeEventListener('resize', measure);
			observer?.disconnect();
		};
	}, [ref]);
}

const kindOf = (slide: Slide) => (slide.type === 'section' ? slide.section.kind : slide.type);

/** 슬라이드 목록의 작은 그림: 장의 그림, 없으면 장 종류의 아이콘 */
const Thumb: React.FC<{ slide: Slide }> = ({ slide }) => (
	<span className="kn-thumb" aria-hidden="true">
		{'thumb' in slide && slide.thumb ? (
			<Media media={slide.thumb} decorative />
		) : (
			<FaIcon icon={(slide.type === 'section' && slide.icon) || KIND_ICONS[kindOf(slide)]} />
		)}
	</span>
);

const KeynotePage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useRef<HTMLDivElement>(null);
	useStageHeight(root);
	const accent = keynoteAccent(useLandingAccent(project.icon));
	const slides = useMemo(() => slidesOf(landing), [landing]);
	const [position, setPosition] = useState({ index: 0, build: 1 });
	const [sorter, setSorter] = useState(false);
	const [notes, setNotes] = useState(false);
	const sorterRef = useRef<HTMLDivElement>(null);

	const index = Math.min(position.index, slides.length - 1);
	const slide = slides[index];
	const build = Math.min(position.build, slide.builds);

	const next = useCallback(() => {
		setPosition(({ index: at, build: built }) => {
			const current = slides[Math.min(at, slides.length - 1)];
			if (built < current.builds) return { index: at, build: built + 1 };
			if (at >= slides.length - 1) return { index: at, build: built };
			return { index: at + 1, build: 1 };
		});
	}, [slides]);

	const prev = useCallback(() => {
		setPosition(({ index: at, build: built }) => {
			if (built > 1) return { index: at, build: built - 1 };
			if (at <= 0) return { index: 0, build: 1 };
			// 앞 장으로 돌아가면 빌드가 다 쌓인 모습
			return { index: at - 1, build: slides[at - 1].builds };
		});
	}, [slides]);

	const go = useCallback(
		(to: number) => {
			const target = Math.max(0, Math.min(to, slides.length - 1));
			setPosition({ index: target, build: slides[target].builds });
			setSorter(false);
		},
		[slides]
	);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!acceptsGameKey(event, root.current)) return;
			const target = event.target instanceof HTMLElement ? event.target : null;
			const onControl = Boolean(target?.closest('a, button'));
			const key = event.key;
			if (event.code === 'KeyG') {
				event.preventDefault();
				setSorter((open) => !open);
			} else if (event.code === 'KeyN') {
				event.preventDefault();
				setNotes((on) => !on);
			} else if (key === 'Escape' && sorter) {
				event.preventDefault();
				setSorter(false);
			} else if (sorter) {
				// 목록이 열려 있으면 Tab·Enter로 고른다
			} else if (key === 'ArrowRight' || key === 'PageDown' || (key === ' ' && !onControl)) {
				event.preventDefault();
				next();
			} else if (key === 'ArrowLeft' || key === 'PageUp') {
				event.preventDefault();
				prev();
			} else if (key === 'Home') {
				event.preventDefault();
				setPosition({ index: 0, build: 1 });
			} else if (key === 'End') {
				event.preventDefault();
				setPosition({ index: slides.length - 1, build: 1 });
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [next, prev, sorter, slides.length]);

	// 목록을 열면 지금 장의 단추에 초점을 둔다
	useEffect(() => {
		if (!sorter) return;
		sorterRef.current?.querySelector<HTMLElement>('[aria-current]')?.focus();
	}, [sorter]);

	/** 무대를 누르면 다음 장 (Shift를 누르고 있으면 앞 장). 링크·단추·영상·글 고르기는 그대로 둔다 */
	const onStageClick = (event: React.MouseEvent) => {
		const target = event.target as HTMLElement;
		if (target.closest('a, button, video, pre, .kn-notes')) return;
		if (window.getSelection()?.toString()) return;
		if (event.shiftKey) prev();
		else next();
	};

	const progress = slides.length > 1 ? (index + build / slide.builds) / slides.length : 1;

	return (
		<div
			ref={root}
			className="tpl tpl-keynote"
			style={accent}
			data-notes={notes ? '' : undefined}
			data-sorter={sorter ? '' : undefined}
		>
			{slide.type !== 'title' && <h1 className="visually-hidden">{landing.hero.headline}</h1>}
			<div className="kn-room">
				{/* 무대를 누르는 것은 마우스 지름길이고, 같은 일을 →·Space와 아래 단추가 한다 */}
				<div className="kn-stage" onClick={onStageClick}>
					<div key={slide.key} className="kn-slide" data-build={build} data-kind={kindOf(slide)}>
						<SlideView slide={slide} landing={landing} build={build} />
					</div>
				</div>
			</div>

			{sorter && (
				<div ref={sorterRef} className="kn-sorter" role="dialog" aria-label="슬라이드 목록">
					<ol>
						{slides.map((item, at) => (
							<li key={item.key}>
								<button type="button" aria-current={at === index ? 'true' : undefined} onClick={() => go(at)}>
									<Thumb slide={item} />
									<span className="kn-thumb-name">
										<span className="kn-thumb-num">{at + 1}</span>
										{item.name}
									</span>
								</button>
							</li>
						))}
					</ol>
				</div>
			)}

			<div className="kn-bar">
				<div className="kn-progress" aria-hidden="true">
					<span style={{ transform: `scaleX(${progress})` }} />
				</div>
				<div className="kn-bar-row">
					<p className="kn-bar-name">{slide.name}</p>
					<div className="kn-bar-nav">
						<button type="button" aria-label="이전 슬라이드" onClick={prev} disabled={index === 0 && build === 1}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" />
						</button>
						<p className="kn-counter" aria-live="polite">
							<span className="visually-hidden">슬라이드 </span>
							{index + 1} / {slides.length}
						</p>
						<button
							type="button"
							aria-label="다음 슬라이드"
							onClick={next}
							disabled={index === slides.length - 1 && build === slide.builds}
						>
							<i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</button>
					</div>
					<div className="kn-bar-tools">
						<button type="button" aria-pressed={notes} onClick={() => setNotes((on) => !on)} title="N">
							<i className="fa-solid fa-note-sticky" aria-hidden="true" />
							발표자 노트
						</button>
						<button type="button" aria-pressed={sorter} onClick={() => setSorter((open) => !open)} title="G">
							<i className="fa-solid fa-table-cells" aria-hidden="true" />
							슬라이드 목록
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default KeynotePage;
