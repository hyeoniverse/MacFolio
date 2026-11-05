import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { prefersReducedMotion } from '@/shared/lib/media';
import { useDismiss } from '@/shared/ui/popover/useDismiss';
import { activeHeading, showsToc, tocBarItems, tocPosition } from '../toc';
import type { useTocHeadings } from '../useTocHeadings';

/** 붙은 막대 아래 끝에서 이만큼 내려온 선을 지난 제목을 읽는 중으로 본다 (제목 한 줄과 위 여백) */
const ACTIVE_ROOM = 48;

/** 제목으로 넘길 때 붙은 막대 아래에 남기는 틈 */
const JUMP_GAP = 8;

/**
 * 글의 목차: 글 제목 바로 아래의 한 줄 막대. 평소에는 지금 읽는 절(+그 안의 ### 소제목)과 이전·다음 절만 보이고,
 * 오른쪽 끝의 목록 버튼으로 모든 제목을 펼친다. 절은 ## 제목이다 (## 제목이 둘 미만이면 모든 제목, toc.ts의 tocBarItems).
 * 본문 제목이 TOC_MIN_HEADINGS개 미만이면 그리지 않는다.
 * - 본문을 넘기면 스크롤 칸 맨 위에 붙어 있고(position: sticky), 붙은 동안만 아래에 얇은 구분선을 긋는다 (styles/toc.css)
 * - 펼친 목록은 막대 아래에 떠 있고, 바깥을 누르거나 Esc를 누르거나 제목을 고르면 닫힌다
 * 이전·다음 버튼과 목록의 제목을 누르면 본문의 그 제목으로 스크롤한다. 주소의 #는 바꾸지 않는다 (글 주소가 /memo/<글>이라서, 각주 이동과 같은 원칙).
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
	const [open, setOpen] = useState(false);
	/** 막대가 원래 놓일 자리 (높이 0). 막대가 이 자리보다 아래에 있으면 스크롤 칸 위에 붙은 것이다 */
	const anchor = useRef<HTMLDivElement>(null);
	const nav = useRef<HTMLElement>(null);
	const list = useRef<HTMLOListElement>(null);
	const toggle = useRef<HTMLButtonElement>(null);
	const listId = useId();

	const visible = showsToc(entries);
	const items = useMemo(() => tocBarItems(entries), [entries]);
	const { section, sub, prev, next } = tocPosition(entries, items, active);

	useDismiss(open, () => setOpen(false), [nav]);

	// 지금 읽는 절과, 막대가 스크롤 칸 위에 붙었는지
	useEffect(() => {
		const scroller = bodyRef.current?.closest<HTMLElement>('.memo-scroll');
		if (!visible || !scroller) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const bar = nav.current?.getBoundingClientRect();
			if (!nav.current || !bar) return;
			const top = scroller.getBoundingClientRect().top;
			const home = anchor.current?.getBoundingClientRect();
			setStuck(Boolean(home && bar.top > home.top + 0.5));
			// 붙은 막대의 아래 끝 (스크롤 칸 위에서): 막대는 스크롤 칸의 위 여백 + 자기 top에 붙는다 (휴대폰은 알약 아래)
			const covered =
				Math.max(0, parseFloat(getComputedStyle(scroller).paddingTop) + parseFloat(getComputedStyle(nav.current).top)) +
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

	// 펼치면 지금 읽는 제목(없으면 첫 제목)에 초점을 둔다 (키보드로 바로 위아래 제목을 고를 수 있게). 목록이 길면 그 제목이 가운데 오게 넘긴다
	useEffect(() => {
		if (!open) return;
		const panel = list.current;
		const target = panel?.querySelectorAll('button')[Math.max(0, active)];
		if (!panel || !target) return;
		target.focus({ preventScroll: true });
		// scrollIntoView는 본문 스크롤 칸까지 움직이므로 목록만 넘긴다 (항목의 offsetParent는 position: absolute인 목록)
		const item = target.parentElement!;
		panel.scrollTop = item.offsetTop - (panel.clientHeight - item.offsetHeight) / 2;
		// 펼칠 때 한 번만 (읽는 제목이 바뀔 때마다 초점을 옮기지 않는다)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const jump = (index: number) => {
		const heading = headings.current[index];
		setOpen(false);
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

	/** 목록 안에서 ↑·↓로 위아래 제목에 초점을 옮긴다. Esc로 닫으면 초점을 목록 버튼으로 돌린다 (닫는 일은 useDismiss) */
	const onListKey = (event: KeyboardEvent<HTMLOListElement>) => {
		if (event.key === 'Escape') toggle.current?.focus({ preventScroll: true });
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const buttons = [...(list.current?.querySelectorAll('button') ?? [])];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const to = buttons[Math.min(buttons.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))];
		event.preventDefault();
		to?.focus();
	};

	if (!visible) return null;

	return (
		<>
			<div ref={anchor} className="memo-toc-bar-anchor" aria-hidden="true" />
			<nav
				ref={nav}
				className="memo-toc-bar"
				aria-label="목차"
				data-stuck={stuck || undefined}
				data-compact={compact || undefined}
				// 마우스로 누른 버튼이 초점을 받으면 브라우저가 붙은 막대를 scroll-padding 아래로 보이려고 본문을 위로 넘긴다.
				// 누르기만으로는 초점을 옮기지 않는다 (키보드 초점과 펼친 목록의 초점은 그대로)
				onMouseDown={(event) => event.preventDefault()}
			>
				<div className="memo-toc-bar-row">
					<button
						type="button"
						className="memo-toc-bar-step"
						data-side="prev"
						aria-label={prev >= 0 ? `이전 절: ${entries[prev].text}` : '이전 절'}
						disabled={prev < 0}
						onClick={() => jump(prev)}
					>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
						{prev >= 0 && <span className="memo-toc-bar-step-text">{entries[prev].text}</span>}
					</button>
					<p className="memo-toc-bar-current">
						{section >= 0 ? (
							<>
								<span className="memo-toc-bar-section">{entries[section].text}</span>
								{sub >= 0 && <span className="memo-toc-bar-sub">{entries[sub].text}</span>}
							</>
						) : (
							<span className="memo-toc-bar-placeholder">목차 · 절 {items.length}개</span>
						)}
					</p>
					<button
						type="button"
						className="memo-toc-bar-step"
						data-side="next"
						aria-label={next >= 0 ? `다음 절: ${entries[next].text}` : '다음 절'}
						disabled={next < 0}
						onClick={() => jump(next)}
					>
						{next >= 0 && <span className="memo-toc-bar-step-text">{entries[next].text}</span>}
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
					<button
						ref={toggle}
						type="button"
						className="memo-toc-bar-toggle"
						aria-label="목차 펼치기"
						aria-expanded={open}
						aria-controls={listId}
						onClick={() => setOpen((value) => !value)}
					>
						<i className="fa-solid fa-list-ul" aria-hidden="true" />
					</button>
				</div>
				{open && (
					<ol ref={list} id={listId} className="memo-toc-bar-list" onKeyDown={onListKey}>
						{entries.map((entry, index) => (
							<li key={index} data-level={entry.level}>
								<button
									type="button"
									aria-current={index === active ? 'location' : undefined}
									onClick={() => jump(index)}
								>
									{entry.text}
								</button>
							</li>
						))}
					</ol>
				)}
			</nav>
		</>
	);
};

export default MemoToc;
