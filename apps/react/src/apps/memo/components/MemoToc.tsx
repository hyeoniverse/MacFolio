import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import Menu from '@/shared/ui/menu/Menu';
import { prefersReducedMotion } from '@/shared/lib/media';
import { activeHeading, showsToc } from '../toc';
import type { useTocHeadings } from '../useTocHeadings';

/** 스크롤 영역 위에서 이만큼 내려온 선을 지난 제목을 읽는 중으로 본다 (제목 한 줄과 위 여백) */
const ACTIVE_OFFSET = 96;

/**
 * 글의 목차 (읽기 화면). 본문의 ## · ### 제목으로 만든다. 제목이 TOC_MIN_HEADINGS개 미만이면 그리지 않는다.
 * - 제목 아래의 목차: 넓은 화면은 펼친 채, 좁은 화면(휴대폰)은 접은 채 시작한다
 * - 스크롤해 목차가 화면 위로 지나가면 오른쪽 위에 목차 버튼을 띄운다 (넓은 화면). 누르면 메뉴로 목차를 연다
 * - 지금 읽는 절은 두 곳 모두 표시한다
 * 항목을 누르면 본문의 그 제목으로 스크롤한다. 주소의 #는 바꾸지 않는다 (글 주소가 /memo/<글>이라서, 각주 이동과 같은 원칙)
 */
const MemoToc = ({
	toc,
	bodyRef,
	revision,
	compact,
}: {
	/** useTocHeadings의 결과 */
	toc: ReturnType<typeof useTocHeadings>;
	/** 본문(.memo-markdown) */
	bodyRef: RefObject<HTMLDivElement | null>;
	/** 본문이 바뀌면 바뀌는 값 (글 주소와 본문) */
	revision: string;
	/** 좁은 화면: 접은 채 시작하고, 떠 있는 버튼은 쓰지 않는다 (휴대폰의 위쪽 버튼과 겹치지 않게) */
	compact: boolean;
}) => {
	const { entries, headings } = toc;
	const [open, setOpen] = useState(!compact);
	const [active, setActive] = useState(-1);
	const [floating, setFloating] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const nav = useRef<HTMLElement>(null);
	const floatButton = useRef<HTMLButtonElement>(null);
	const listId = useId();

	const visible = showsToc(entries);

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
	}, [bodyRef, headings, visible, revision]);

	const jump = useCallback(
		(index: number) => {
			const heading = headings.current[index];
			if (!heading) return;
			heading.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
			// 키보드 사용자도 그 절에서 이어 읽게 초점을 옮긴다 (제목은 원래 초점을 받지 않는다)
			heading.setAttribute('tabindex', '-1');
			heading.focus({ preventScroll: true });
		},
		[headings]
	);

	if (!visible) return null;
	const showFloat = floating && !compact;

	return (
		<>
			{showFloat && (
				<div className="memo-toc-float">
					<IconButton
						ref={floatButton}
						className="memo-toc-float-button"
						icon="fa-solid fa-list-ul"
						label="목차 보기"
						aria-haspopup="menu"
						aria-expanded={menu !== null}
						on={menu !== null}
						onClick={(event) => {
							if (menu) return setMenu(null);
							const rect = event.currentTarget.getBoundingClientRect();
							setMenu({ x: rect.right - 240, y: rect.bottom + 6 });
						}}
					/>
				</div>
			)}
			{menu && showFloat && (
				<Menu
					label="목차"
					anchor={menu}
					trigger={floatButton}
					autoFocus
					className="memo-toc-menu"
					onClose={() => setMenu(null)}
					items={entries.map((entry, index) => ({
						// 메뉴 항목은 글자 하나라 ### 제목은 전각 공백으로 들여 쓴다
						label: entry.level === 3 ? '\u3000' + entry.text : entry.text,
						checked: index === active,
						onSelect: () => jump(index),
					}))}
				/>
			)}
			<nav ref={nav} className="memo-toc" aria-label="목차">
				<button
					type="button"
					className="memo-toc-toggle"
					aria-expanded={open}
					aria-controls={listId}
					onClick={() => setOpen((value) => !value)}
				>
					<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					목차
				</button>
				<ol id={listId} hidden={!open}>
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
			</nav>
		</>
	);
};

export default MemoToc;
