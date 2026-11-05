import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '@/shared/lib/media';
import { activeBarItem, activeHeading, showsToc, tocBarItems } from '../toc';
import type { useTocHeadings } from '../useTocHeadings';

/** 붙은 막대 아래 끝에서 이만큼 내려온 선을 지난 제목을 읽는 중으로 본다 (제목 한 줄과 위 여백) */
const ACTIVE_ROOM = 48;

/** 제목으로 넘길 때 붙은 막대 아래에 남기는 틈 */
const JUMP_GAP = 8;

/** 지금 읽는 항목을 막대 안으로 당겨 올 때 막대 양 끝에 남기는 여백 (옆 항목이 조금 보이게) */
const EDGE_ROOM = 24;

/**
 * 글의 목차: 글 제목 바로 아래의 한 줄 막대. Apple 문서의 탭 막대처럼 ## 제목을 가로로 늘어놓는다
 * (## 제목이 둘 미만이면 모든 제목, toc.ts의 tocBarItems). 본문 제목이 TOC_MIN_HEADINGS개 미만이면 그리지 않는다.
 * - 본문을 넘기면 스크롤 칸 맨 위에 붙어 있고(position: sticky), 붙은 동안만 아래에 얇은 구분선을 긋는다 (styles/toc.css)
 * - 항목이 막대보다 길면 막대 안에서 가로로 넘긴다 (스크롤 막대는 감춘다)
 * - 지금 읽는 절은 강조색 글자와 아래 2px 막대로 표시하고, 막대 밖에 있으면 막대만 가로로 넘겨 보이게 한다 (본문은 움직이지 않는다)
 * 항목을 누르면 본문의 그 제목으로 스크롤한다. 주소의 #는 바꾸지 않는다 (글 주소가 /memo/<글>이라서, 각주 이동과 같은 원칙).
 * 편집 화면(editor)에서는 제목 앞에 커서를 둔다 (제목에 tabindex를 붙이면 편집기 문서가 바뀌므로 초점 대신 커서)
 */
const MemoToc = ({
	toc,
	bodyRef,
	revision,
	compact,
	editor = false,
}: {
	/** useTocHeadings의 결과 */
	toc: ReturnType<typeof useTocHeadings>;
	/** 본문(.memo-markdown, 편집 화면은 편집기를 감싼 칸) */
	bodyRef: RefObject<HTMLDivElement | null>;
	/** 본문이 바뀌면 바뀌는 값 (글 주소와 본문) */
	revision: string;
	/** 좁은 화면: 항목 높이를 손가락 터치 영역(44px) 이상으로 */
	compact: boolean;
	/** 편집 화면 */
	editor?: boolean;
}) => {
	const { entries, headings } = toc;
	const [active, setActive] = useState(-1);
	const [stuck, setStuck] = useState(false);
	/** 막대가 원래 놓일 자리 (높이 0). 막대가 이 자리보다 아래에 있으면 스크롤 칸 위에 붙은 것이다 */
	const anchor = useRef<HTMLDivElement>(null);
	const list = useRef<HTMLOListElement>(null);

	const visible = showsToc(entries);
	const items = useMemo(() => tocBarItems(entries), [entries]);
	const current = activeBarItem(items, active);

	// 지금 읽는 절과, 막대가 스크롤 칸 위에 붙었는지
	useEffect(() => {
		const scroller = bodyRef.current?.closest<HTMLElement>('.memo-scroll');
		if (!visible || !scroller) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const nav = list.current?.parentElement;
			if (!nav) return;
			const top = scroller.getBoundingClientRect().top;
			const bar = nav.getBoundingClientRect();
			const home = anchor.current?.getBoundingClientRect();
			setStuck(Boolean(home && bar.top > home.top + 0.5));
			// 붙은 막대의 아래 끝 (스크롤 칸 위에서): 막대는 스크롤 칸의 위 여백 + 자기 top에 붙는다 (휴대폰은 알약 아래)
			const covered =
				Math.max(0, parseFloat(getComputedStyle(scroller).paddingTop) + parseFloat(getComputedStyle(nav).top)) +
				bar.height;
			// 제목으로 넘기는 scrollIntoView·찾기·초점 이동이 제목을 막대 밑에 숨기지 않게 스크롤 칸의 scroll-padding으로 막대 높이를 비운다
			scroller.style.scrollPaddingTop = `${Math.round(covered + JUMP_GAP)}px`;
			setActive(
				activeHeading(
					headings.current.map((heading) => heading.getBoundingClientRect().top - top),
					covered + ACTIVE_ROOM
				)
			);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		scroller.addEventListener('scroll', onScroll, { passive: true });
		// 창 크기·본문 높이가 바뀌면(창 최대화, 늦게 그려지는 그림·수식) 스크롤 없이도 제목 자리가 바뀌므로 다시 잰다
		const resize = new ResizeObserver(onScroll);
		resize.observe(scroller);
		if (bodyRef.current) resize.observe(bodyRef.current);
		return () => {
			scroller.removeEventListener('scroll', onScroll);
			resize.disconnect();
			cancelAnimationFrame(frame);
			scroller.style.scrollPaddingTop = '';
		};
	}, [bodyRef, headings, visible, revision, entries]);

	// 지금 읽는 항목이 막대 밖이면 막대만 가로로 넘긴다. scrollIntoView는 본문 스크롤 칸까지 세로로 움직이므로 쓰지 않는다.
	// offsetLeft·scrollLeft는 같은 CSS 좌표라 글자 크기 배율(zoom)과 상관없다
	useEffect(() => {
		const row = list.current;
		const item = current >= 0 ? row?.children[current] : undefined;
		if (!row || !(item instanceof HTMLElement)) return;
		const left = item.offsetLeft;
		const right = left + item.offsetWidth;
		let next = row.scrollLeft;
		if (left - EDGE_ROOM < row.scrollLeft) next = left - EDGE_ROOM;
		else if (right + EDGE_ROOM > row.scrollLeft + row.clientWidth) next = right + EDGE_ROOM - row.clientWidth;
		next = Math.max(0, Math.min(next, row.scrollWidth - row.clientWidth));
		if (Math.abs(next - row.scrollLeft) < 1) return;
		row.scrollTo({ left: next, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
	}, [current, items]);

	const jump = (index: number) => {
		const heading = headings.current[index];
		if (!heading) return;
		heading.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
		if (editor) {
			// 편집기: 제목 맨 앞에 커서를 둔다. 편집기는 초점을 받을 때 화면의 커서를 읽는다
			const body = heading.closest<HTMLElement>('.ProseMirror');
			body?.focus({ preventScroll: true });
			document.getSelection()?.collapse(heading, 0);
		} else {
			// 키보드 사용자도 그 절에서 이어 읽게 초점을 옮긴다 (제목은 원래 초점을 받지 않는다)
			heading.setAttribute('tabindex', '-1');
			heading.focus({ preventScroll: true });
		}
	};

	if (!visible) return null;

	return (
		<>
			<div ref={anchor} className="memo-toc-bar-anchor" aria-hidden="true" />
			<nav
				className="memo-toc-bar"
				aria-label="목차"
				data-stuck={stuck || undefined}
				data-compact={compact || undefined}
			>
				<ol ref={list} className="memo-toc-bar-list">
					{items.map((index, position) => (
						<li key={index}>
							<button
								type="button"
								aria-current={position === current ? 'location' : undefined}
								onClick={() => jump(index)}
							>
								{entries[index].text}
							</button>
						</li>
					))}
				</ol>
			</nav>
		</>
	);
};

export default MemoToc;
