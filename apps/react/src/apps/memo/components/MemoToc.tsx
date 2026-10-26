import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
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
	hidden,
	entries,
	active,
	onJump,
}: {
	id?: string;
	hidden?: boolean;
	entries: TocEntry[];
	active: number;
	onJump: (index: number) => void;
}) => (
	<ol id={id} hidden={hidden} className="memo-toc-list">
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
 * Apple 개발자 문서의 'On This Page'처럼 상자 없이 작은 글자 목록과 왼쪽 세로선으로 그린다 (styles/toc.css).
 * - 제목 아래의 목차: 접힌 채 시작한다. 누르면(클릭·탭·Enter·Space) 펼치고 다시 누르면 접는다. 펼쳐 두면 기억한다 (useTocDisclosure)
 * - 스크롤해 목차가 화면 위로 지나가면 오른쪽 위에 목차 버튼을 띄운다 (넓은 화면). 누르면 같은 목록을 메뉴 재질의 창으로 연다
 * - 지금 읽는 절은 두 곳 모두 강조색 글자와 세로선 위의 굵은 막대로 표시한다
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
	// 목차 창을 연 동안 본문 스크롤 칸의 높이 (창이 칸 아래로 넘치거나 글자 크기 버튼에 가리지 않게 높이를 제한한다)
	const [room, setRoom] = useState<number | null>(null);
	const nav = useRef<HTMLElement>(null);
	const floatBox = useRef<HTMLDivElement>(null);
	const listId = useId();
	const panelId = useId();

	const visible = showsToc(entries);

	// 목차 창은 바깥을 누르면 닫는다
	useDismiss(panel.open, panel.close, [floatBox]);

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

	useEffect(() => {
		const scroller = bodyRef.current?.closest<HTMLElement>('.memo-scroll');
		if (!panel.open || !scroller) return;
		const observer = new ResizeObserver(() => setRoom(scroller.clientHeight));
		observer.observe(scroller);
		// 지금 읽는 절이 창 안에 보이게
		floatBox.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: 'nearest' });
		return () => observer.disconnect();
	}, [panel.open, bodyRef]);

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
		// 목차 창은 고르면 닫는다 (제목 아래 목차는 펼친 그대로)
		panel.close();
	};

	if (!visible) return null;
	const showFloat = floating && !compact;

	return (
		<>
			{showFloat && (
				<div ref={floatBox} className="memo-toc-float" onKeyDown={panel.onKeyDown}>
					<IconButton
						className="memo-toc-float-button"
						icon="fa-solid fa-list-ul"
						label="목차 보기"
						aria-expanded={panel.open}
						aria-controls={panelId}
						on={panel.open}
						onClick={panel.toggle}
					/>
					{panel.open && (
						<div
							id={panelId}
							className="memo-toc-panel"
							role="group"
							aria-label="목차 바로가기"
							style={room ? ({ '--memo-toc-room': `${room}px` } as CSSProperties) : undefined}
						>
							<p className="memo-toc-heading">목차</p>
							<TocList entries={entries} active={active} onJump={jump} />
						</div>
					)}
				</div>
			)}
			<nav
				ref={nav}
				className="memo-toc"
				aria-label="목차"
				data-compact={compact || undefined}
				onKeyDown={inline.onKeyDown}
			>
				<button
					type="button"
					className="memo-toc-toggle memo-toc-heading"
					aria-expanded={inline.open}
					aria-controls={listId}
					onClick={inline.toggle}
				>
					목차
					<i className="fa-solid fa-chevron-down memo-toc-chevron" aria-hidden="true" />
				</button>
				{/* 접고 펼칠 때 높이가 grid-template-rows 0fr ↔ 1fr로 늘고 줄며 목록이 서서히 나타난다 (styles/toc.css) */}
				<div className="memo-toc-collapse" data-open={inline.open}>
					<div className="memo-toc-collapse-inner">
						<TocList id={listId} entries={entries} active={active} onJump={jump} />
					</div>
				</div>
			</nav>
		</>
	);
};

export default MemoToc;
