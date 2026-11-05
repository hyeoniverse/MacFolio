import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { prefersReducedMotion } from '@/shared/lib/media';
import { useDismiss } from '@/shared/ui/popover/useDismiss';
import { activeHeading, showsToc, tocBarItems, tocPosition, type TocEntry } from '../toc';
import type { useTocHeadings } from '../useTocHeadings';
import { useTocDisclosure } from '../useTocDisclosure';

/** 붙은 막대 아래 끝에서 이만큼 내려온 선을 지난 제목을 읽는 중으로 본다 (제목 한 줄과 위 여백) */
const ACTIVE_ROOM = 48;

/** 제목으로 넘길 때 붙은 막대 아래에 남기는 틈 */
const JUMP_GAP = 8;

/** 목차 항목들 (제목 아래 목차 블록과 막대의 펼친 목록이 같이 쓴다) */
const TocList = ({
	id,
	className,
	entries,
	active,
	onJump,
	listRef,
	onKeyDown,
}: {
	id?: string;
	className: string;
	entries: TocEntry[];
	active: number;
	onJump: (index: number) => void;
	listRef?: RefObject<HTMLOListElement | null>;
	onKeyDown?: (event: KeyboardEvent<HTMLOListElement>) => void;
}) => (
	<ol ref={listRef} id={id} className={className} onKeyDown={onKeyDown}>
		{entries.map((entry, index) => (
			<li key={index} data-level={entry.level}>
				<button type="button" aria-current={index === active ? 'location' : undefined} onClick={() => onJump(index)}>
					{entry.text}
				</button>
			</li>
		))}
	</ol>
);

/**
 * 글의 목차. 본문의 ## · ### · #### 제목으로 만든다. 제목이 TOC_MIN_HEADINGS개 미만이면 그리지 않는다.
 * - 제목 아래의 목차 블록: Apple 개발자 문서의 'On This Page'처럼 왼쪽 세로선에 붙인 목록. 접힌 채 시작하고,
 *   누르면(클릭·탭·Enter·Space) 펼치고 다시 누르면 접는다. 펼쳐 두면 기억한다 (useTocDisclosure)
 * - 목차 막대: 블록이 화면 위로 지나가면 스크롤 칸 맨 위에 붙어 나타나는 한 줄(position: sticky, 붙기 전에는 감춘다).
 *   가운데에 지금 읽는 절 이름과, 그 안에서 읽는 자리까지의 하위 제목 경로(## › ### › ####, toc.ts의 tocPosition)를 보인다.
 *   양옆의 이전·다음 화살표는 마우스를 올리면 그 절 이름까지 펼친다. 절·하위 제목이 바뀌면 글자가 읽는 방향으로 미끄러지며 나타난다.
 *   오른쪽 끝의 목록 버튼으로 모든 제목을 펼친다.
 *   절은 ## 제목이다 (## 제목이 둘 미만이면 모든 제목, toc.ts의 tocBarItems).
 *   펼친 목록은 막대 아래에 떠 있고, 바깥을 누르거나 Esc를 누르거나 제목을 고르면 닫힌다
 *   휴대폰(compact)에서는 한 줄을 차지하지 않게 이전·현재·다음을 감추고 오른쪽 위에 떠 있는 목록 버튼 하나만 남긴다 (styles/toc.css)
 * - 지금 읽는 제목은 블록과 펼친 목록 모두 강조색으로 표시한다 (styles/toc.css)
 * 항목·이전·다음 버튼을 누르면 본문의 그 제목으로 스크롤한다. 주소의 #는 바꾸지 않는다 (글 주소가 /memo/<글>이라서, 각주 이동과 같은 원칙).
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
	/** 좁은 화면: 목차 블록의 줄을 손가락 터치 영역(44px) 이상으로, 막대는 떠 있는 목록 버튼 하나로 */
	compact: boolean;
	/** 편집 화면 */
	editor?: boolean;
}) => {
	const { entries, headings } = toc;
	const [active, setActive] = useState(-1);
	const [stuck, setStuck] = useState(false);
	const [open, setOpen] = useState(false);
	const inline = useTocDisclosure({ remember: true });
	/** 막대가 원래 놓일 자리 (높이 0). 막대가 이 자리보다 아래에 있으면 스크롤 칸 위에 붙은 것이다 */
	const anchor = useRef<HTMLDivElement>(null);
	const nav = useRef<HTMLElement>(null);
	const list = useRef<HTMLOListElement>(null);
	const toggle = useRef<HTMLButtonElement>(null);
	const listId = useId();
	const inlineListId = useId();

	const visible = showsToc(entries);
	const items = useMemo(() => tocBarItems(entries), [entries]);
	const { section, trail, prev, next } = tocPosition(entries, items, active);
	// 읽는 제목이 바뀐 방향 (막대의 글자가 아래에서 올라오거나 위에서 내려오며 바뀐다). 렌더 중에 앞 값과 비교해 고친다
	const [shown, setShown] = useState({ active, forward: true });
	if (shown.active !== active) setShown({ active, forward: active > shown.active });

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
			// 막대가 붙는 선 (스크롤 칸 위에서): 스크롤 칸 위 여백 + 막대의 top (휴대폰은 알약 아래). 좁은 화면의 막대는 붙지 않아 top이 auto다
			const stick =
				parseFloat(getComputedStyle(scroller).paddingTop) + (parseFloat(getComputedStyle(nav.current).top) || 0);
			// 막대가 원래 놓일 자리가 그 선 위로 지나가면 붙은 것이다 (좁은 화면에서는 같은 선을 지나면 떠 있는 버튼을 보인다)
			const nowStuck = Boolean(home && home.top < top + stick - 0.5);
			setStuck(nowStuck);
			// 맨 위로 돌아가 막대가 감춰지면 펼친 목록도 닫는다
			if (!nowStuck) setOpen(false);
			// 붙은 막대의 아래 끝 (스크롤 칸 위에서). 좁은 화면의 막대는 높이가 0이라 위 여백까지다
			const covered = Math.max(0, stick) + bar.height;
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
		// scrollIntoView는 본문 스크롤 칸까지 움직이므로 목록만 넘긴다 (항목의 offsetParent는 position: relative인 목록)
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
			<nav className="memo-toc" aria-label="목차" data-compact={compact || undefined} onKeyDown={inline.onKeyDown}>
				<button
					type="button"
					className="memo-toc-toggle memo-toc-heading"
					aria-expanded={inline.open}
					aria-controls={inlineListId}
					onClick={inline.toggle}
				>
					<i className="fa-solid fa-list-ul memo-toc-icon" aria-hidden="true" />
					목차
					<i className="fa-solid fa-chevron-down memo-toc-chevron" aria-hidden="true" />
				</button>
				{/* 접고 펼칠 때 높이가 grid-template-rows 0fr ↔ 1fr로 늘고 줄며 목록이 서서히 나타난다 (styles/toc.css) */}
				<div className="memo-toc-collapse" data-open={inline.open}>
					<div className="memo-toc-collapse-inner">
						<TocList id={inlineListId} className="memo-toc-list" entries={entries} active={active} onJump={jump} />
					</div>
				</div>
			</nav>
			<div ref={anchor} className="memo-toc-bar-anchor" aria-hidden="true" />
			<nav
				ref={nav}
				className="memo-toc-bar"
				aria-label="목차 막대"
				data-stuck={stuck || undefined}
				data-compact={compact || undefined}
				// 붙기 전(목차 블록이 보이는 동안)에는 감춘 막대에 Tab·화면 읽기 프로그램이 들어가지 않게 한다
				inert={!stuck}
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
						{prev >= 0 && (
							<span key={prev} className="memo-toc-bar-step-text">
								{entries[prev].text}
							</span>
						)}
					</button>
					{/* 절·하위 제목이 바뀌면 그 글자만 새로 그려(key) 바뀐 방향으로 미끄러지며 나타난다 (styles/toc.css의 memo-toc-swap) */}
					<p className="memo-toc-bar-current" data-direction={shown.forward ? 'forward' : 'back'}>
						{section >= 0 ? (
							<>
								<span key={`section-${section}`} className="memo-toc-bar-section">
									{entries[section].text}
								</span>
								{trail.map((index) => (
									<span key={`sub-${index}`} className="memo-toc-bar-sub" data-level={entries[index].level}>
										{entries[index].text}
									</span>
								))}
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
						{next >= 0 && (
							<span key={next} className="memo-toc-bar-step-text">
								{entries[next].text}
							</span>
						)}
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
					<button
						ref={toggle}
						type="button"
						className="memo-toc-bar-toggle"
						aria-label="모든 제목 보기"
						aria-expanded={open}
						aria-controls={listId}
						onClick={() => setOpen((value) => !value)}
					>
						<i className="fa-solid fa-list-ul" aria-hidden="true" />
					</button>
				</div>
				{open && (
					// 바탕·모서리·그림자는 넘기지 않는 바깥 상자에 두고 목록만 그 안에서 넘긴다.
					// Safari는 넘기는 상자 끝에서 튕길 때 그 상자의 바탕까지 함께 밀어, 목록 자체에 바탕을 두면 튕기는 틈으로 뒤의 본문이 비친다
					<div className="memo-toc-bar-panel">
						<TocList
							listRef={list}
							id={listId}
							className="memo-toc-bar-list"
							entries={entries}
							active={active}
							onJump={jump}
							onKeyDown={onListKey}
						/>
					</div>
				)}
			</nav>
		</>
	);
};

export default MemoToc;
