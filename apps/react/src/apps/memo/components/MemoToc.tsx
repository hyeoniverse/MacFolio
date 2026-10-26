import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import { useDismiss } from '@/shared/ui/popover/useDismiss';
import { prefersReducedMotion } from '@/shared/lib/media';
import { activeHeading, showsToc, type TocEntry } from '../toc';
import type { useTocHeadings } from '../useTocHeadings';
import { useTocDisclosure } from '../useTocDisclosure';

/** 스크롤 영역 위에서 이만큼 내려온 선을 지난 제목을 읽는 중으로 본다 (제목 한 줄과 위 여백) */
const ACTIVE_OFFSET = 96;

/** 목차 항목들 (제목 아래 목차와 떠 있는 목차 창이 같이 쓴다) */
const TocList = ({
	id,
	entries,
	active,
	onJump,
}: {
	id?: string;
	entries: TocEntry[];
	active: number;
	onJump: (index: number) => void;
}) => (
	<ol id={id} className="memo-toc-list">
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
 * 글의 목차. 본문의 ## · ### 제목으로 만든다. 제목이 TOC_MIN_HEADINGS개 미만이면 그리지 않는다.
 * - 제목 아래의 목차: 접힌 채 시작한다. 마우스를 올리면 목록이 본문 위에 떠서 열리고(본문을 밀지 않는다),
 *   클릭하면 본문 안에 펼친 채 고정한다. 휴대폰은 탭하면 떠서 열리고, 길게 누르면 고정한다 (useTocDisclosure)
 * - 스크롤해 목차가 화면 위로 지나가면 오른쪽 위에 목차 버튼을 띄운다 (넓은 화면). 같은 규칙으로 목차 창을 연다
 * - 지금 읽는 절은 두 곳 모두 표시한다
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
	/** 좁은 화면: 떠 있는 버튼은 쓰지 않는다 (휴대폰의 위쪽 버튼과 겹치지 않게) */
	compact: boolean;
	/** 편집 화면 */
	editor?: boolean;
}) => {
	const { entries, headings } = toc;
	const inline = useTocDisclosure({ remember: true });
	const panel = useTocDisclosure({ remember: false });
	const [active, setActive] = useState(-1);
	const [floating, setFloating] = useState(false);
	const nav = useRef<HTMLElement>(null);
	const floatBox = useRef<HTMLDivElement>(null);
	const listId = useId();
	const panelId = useId();

	const visible = showsToc(entries);

	// 잠깐 연 목록은 바깥을 누르면 닫는다 (휴대폰의 탭). 고정한 목록은 그대로 둔다
	useDismiss(inline.peek && !inline.pinned, inline.close, [nav]);
	useDismiss(panel.peek && !panel.pinned, panel.close, [floatBox]);

	// 지금 읽는 절과, 제목 아래 목차가 화면 위로 지나갔는지 (떠 있는 버튼)
	useEffect(() => {
		const scroller = bodyRef.current?.closest<HTMLElement>('.memo-scroll');
		if (!visible || !scroller) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const top = scroller.getBoundingClientRect().top;
			setActive(
				activeHeading(
					headings.current.map((heading) => heading.getBoundingClientRect().top - top),
					ACTIVE_OFFSET
				)
			);
			const box = nav.current?.getBoundingClientRect();
			setFloating(Boolean(box && box.bottom < top));
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		scroller.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			scroller.removeEventListener('scroll', onScroll);
			cancelAnimationFrame(frame);
		};
	}, [bodyRef, headings, visible, revision, entries]);

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
		// 잠깐 연 목록은 고르면 닫는다
		if (!inline.pinned) inline.close();
		if (!panel.pinned) panel.close();
	};

	if (!visible) return null;
	const showFloat = floating && !compact;
	const pinHint = compact ? '탭하면 열고, 길게 누르면 펼친 채 고정합니다' : '클릭하면 펼친 채 고정합니다';

	return (
		<>
			{showFloat && (
				<div
					ref={floatBox}
					className="memo-toc-float"
					onKeyDown={panel.onKeyDown}
					onPointerEnter={panel.hoverProps.onPointerEnter}
					onPointerLeave={panel.hoverProps.onPointerLeave}
				>
					<IconButton
						className="memo-toc-float-button"
						icon={panel.pinned ? 'fa-solid fa-thumbtack' : 'fa-solid fa-list-ul'}
						label="목차 보기"
						title={`목차 · ${pinHint}`}
						aria-expanded={panel.open}
						aria-controls={panelId}
						aria-pressed={panel.pinned}
						on={panel.pinned}
						{...panel.toggleProps}
					/>
					{panel.open && (
						<div id={panelId} className="memo-toc-panel" role="group" aria-label="목차 바로가기">
							<p className="memo-toc-panel-title">목차</p>
							<TocList entries={entries} active={active} onJump={jump} />
						</div>
					)}
				</div>
			)}
			<nav
				ref={nav}
				className="memo-toc"
				aria-label="목차"
				data-state={inline.pinned ? 'pinned' : inline.peek ? 'peek' : 'closed'}
				data-compact={compact || undefined}
				onKeyDown={inline.onKeyDown}
				{...inline.hoverProps}
			>
				<button
					type="button"
					className="memo-toc-toggle"
					aria-expanded={inline.open}
					aria-controls={listId}
					aria-pressed={inline.pinned}
					title={pinHint}
					{...inline.toggleProps}
				>
					<i className="fa-solid fa-chevron-right memo-toc-chevron" aria-hidden="true" />
					<span className="memo-toc-label">목차</span>
					<span className="memo-toc-count" aria-hidden="true">
						{entries.length}
					</span>
					{inline.pinned && <i className="fa-solid fa-thumbtack memo-toc-pin" aria-hidden="true" />}
				</button>
				<div className="memo-toc-body" hidden={!inline.open}>
					<TocList id={listId} entries={entries} active={active} onJump={jump} />
				</div>
			</nav>
		</>
	);
};

export default MemoToc;
