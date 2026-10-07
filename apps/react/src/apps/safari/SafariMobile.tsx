import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon } from '@/apps/safari/ProjectPage';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu from '@/shared/ui/menu/Menu';
import '@/apps/safari/SafariMobile.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 미리보기 카드 안의 페이지는 휴대폰 폭(390px)으로 그린 뒤 카드 폭에 맞춰 줄인다 */
const PREVIEW_WIDTH = 390;
/** 주소 알약을 옆으로 이만큼 밀면 옆 탭으로 넘어간다 */
const SWIPE_TAB_PX = 40;

interface Props {
	tabs: string[];
	activeId: string;
	projectOf: (id: string) => Project | undefined;
	titleOf: (id: string) => string;
	/** 탭의 페이지 (미리보기면 눌리지 않는 그림으로 쓴다) */
	renderPage: (id: string) => React.ReactNode;
	/** 지금 탭의 페이지: 스크롤하는 칸 (Safari의 .safari-page) */
	page: React.ReactNode;
	address: { href: string; text: string } | null;
	onChoose: (id: string) => void;
	onCloseTab: (id: string) => void;
	onNewTab: () => void;
	onShare: (() => void) | null;
}

/**
 * Safari (휴대폰): iOS Safari처럼 페이지가 화면을 다 쓰고, 아래에 떠 있는 막대 하나로 다룬다.
 * 막대는 왼쪽에 뒤로 가기(홈), 가운데 주소 알약(탭 모음 단추와 주소), 오른쪽 •••. 알약을 옆으로 밀면 옆 탭으로 간다.
 * 탭 모음은 탭을 두 줄 카드로 늘어놓는다 (실제 페이지를 줄인 미리보기, 닫기, 아래에 아이콘과 제목)
 */
const SafariMobile: React.FC<Props> = ({
	tabs,
	activeId,
	projectOf,
	titleOf,
	renderPage,
	page,
	address,
	onChoose,
	onCloseTab,
	onNewTab,
	onShare,
}) => {
	const [overview, setOverview] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);
	const index = tabs.indexOf(activeId);

	// 주소 알약 밀기: 처음 움직인 쪽이 가로면 옆 탭으로, 밀고 난 뒤의 click(주소 링크 열기)은 버린다
	const swipe = useRef<{ x: number; y: number } | null>(null);
	const swallowClick = useRef(false);
	const onPillUp = (event: React.PointerEvent) => {
		const start = swipe.current;
		swipe.current = null;
		if (!start) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (Math.abs(dx) < SWIPE_TAB_PX || Math.abs(dx) < Math.abs(dy)) return;
		swallowClick.current = true;
		const next = tabs[index + (dx < 0 ? 1 : -1)];
		if (next) onChoose(next);
	};

	// 미리보기 비율: 카드 폭 / 휴대폰 폭
	const grid = useRef<HTMLUListElement>(null);
	useLayoutEffect(() => {
		const list = grid.current;
		if (!overview || !list) return;
		const measure = () => {
			const card = list.querySelector<HTMLElement>('.safari-phone-thumb');
			if (card) list.style.setProperty('--thumb-scale', String(card.clientWidth / PREVIEW_WIDTH));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		return () => observer.disconnect();
	}, [overview]);

	if (overview)
		return (
			<div className="safari-phone overview">
				<MobileNavigation placement="bottom" backLabel="완료" onBack={() => setOverview(false)} />
				<ul ref={grid} className="safari-phone-tabs" aria-label="열린 탭">
					{tabs.map((id) => {
						const title = titleOf(id);
						return (
							<li key={id} className={id === activeId ? 'active' : undefined}>
								<button
									type="button"
									className="safari-phone-card"
									aria-label={`${title} 탭 보기`}
									aria-current={id === activeId || undefined}
									onClick={() => {
										onChoose(id);
										setOverview(false);
									}}
								>
									<span className="safari-phone-thumb" aria-hidden="true">
										<span className="safari-phone-thumb-page" inert>
											{renderPage(id)}
										</span>
									</span>
								</button>
								<button
									type="button"
									className="safari-phone-card-close"
									aria-label={`${title} 탭 닫기`}
									onClick={() => onCloseTab(id)}
								>
									<i className="fa-solid fa-xmark" aria-hidden="true" />
								</button>
								<p className="safari-phone-card-title">
									<Favicon project={projectOf(id)} />
									<span>{title}</span>
								</p>
							</li>
						);
					})}
				</ul>
				<div className="safari-phone-bar">
					<span className="safari-phone-count">{tabs.length}개의 탭</span>
					<button
						type="button"
						className="safari-phone-circle"
						aria-label="새로운 탭"
						onClick={() => {
							onNewTab();
							setOverview(false);
						}}
					>
						<i className="fa-solid fa-plus" aria-hidden="true" />
					</button>
				</div>
			</div>
		);

	return (
		<div className="safari-phone">
			<MobileNavigation placement="bottom" />
			{page}
			<div className="safari-phone-bar">
				<div
					className="safari-phone-pill"
					onPointerDown={(event) => {
						swipe.current = { x: event.clientX, y: event.clientY };
						swallowClick.current = false;
					}}
					onPointerUp={onPillUp}
					onPointerCancel={() => (swipe.current = null)}
					onClickCapture={(event) => {
						if (!swallowClick.current) return;
						swallowClick.current = false;
						event.preventDefault();
						event.stopPropagation();
					}}
				>
					<button
						type="button"
						className="safari-phone-tabs-button"
						aria-label={`탭 모두 보기 (${tabs.length}개)`}
						onClick={() => setOverview(true)}
					>
						<i className="fa-regular fa-clone" aria-hidden="true" />
					</button>
					{/* 링크 끌어 옮기기는 끈다: 마우스로 끌면 링크를 끌어 가느라 알약 밀기(pointer)가 취소된다 */}
					{address ? (
						<a
							className="safari-phone-address"
							href={address.href}
							{...external}
							title="새 탭에서 열기"
							draggable={false}
						>
							<i className="fa-solid fa-lock" aria-hidden="true" />
							<span>{address.text}</span>
						</a>
					) : (
						<span className="safari-phone-address placeholder">검색 또는 웹 사이트 이름 입력</span>
					)}
				</div>
				<button
					ref={moreButton}
					type="button"
					className="safari-phone-circle"
					aria-label="Safari 동작"
					aria-haspopup="menu"
					aria-expanded={menu !== null}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						setMenu(menu ? null : { x: rect.right - 250, y: rect.top - 8 });
					}}
				>
					<i className="fa-solid fa-ellipsis" aria-hidden="true" />
				</button>
			</div>
			{menu && (
				<Menu
					label="Safari 동작"
					className="touch"
					anchor={menu}
					trigger={moreButton}
					onClose={() => setMenu(null)}
					items={[
						...(onShare ? [{ label: '링크 공유', icon: 'fa-solid fa-arrow-up-from-bracket', onSelect: onShare }] : []),
						{ label: '새로운 탭', icon: 'fa-solid fa-plus', onSelect: onNewTab },
						{ label: '탭 모두 보기', icon: 'fa-regular fa-clone', onSelect: () => setOverview(true) },
						'separator',
						{ label: '탭 닫기', icon: 'fa-solid fa-xmark', onSelect: () => onCloseTab(activeId) },
					]}
				/>
			)}
		</div>
	);
};

export default SafariMobile;
