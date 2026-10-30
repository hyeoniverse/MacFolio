import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { linkActionLabel, linkTargetOf, type LinkTarget } from '../linkTarget';
import { useOpenAttachment } from '../useOpenAttachment';
import { ATTACHMENT_TITLE } from './attachments';
import { fileAppOf } from '@/shared/lib/fileApps';
import { useOpenLink } from '../useOpenLink';
import { downloadFile } from '../download';

/** 링크에서 버튼으로 마우스를 옮기는 동안 버튼을 남겨 두는 시간 */
const HIDE_DELAY_MS = 300;
/** 링크가 보이는 영역(스크롤 영역)의 위쪽에 이만큼 가까우면 버튼을 링크 아래에 띄운다 (위가 잘리지 않게) */
const ROOM_ABOVE = 56;
/** 편집기 가장자리와 상자 사이에 남길 틈 */
const EDGE = 8;

/** 첨부 파일을 여는 앱의 이름 (버튼 글자) */
const APP_NAMES = { preview: '미리보기', textedit: '텍스트 편집기', safari: 'Safari' } as const;

interface Shown {
	/** 마우스를 올린 링크 (첨부 파일이면 이름·제목으로 여는 앱을 정한다) */
	link: HTMLAnchorElement;
	target: LinkTarget;
	href: string;
	/** 편집기 기준 위치 (링크의 첫 줄). 상자의 왼쪽을 링크 시작에 맞추되, 편집기 밖으로 나가면 안쪽으로 민다 */
	left: number;
	top: number;
	below: boolean;
}

/** 가장 가까운 세로 스크롤 영역 (없으면 화면) */
function scrollTopOf(element: HTMLElement) {
	for (let node = element.parentElement; node; node = node.parentElement) {
		if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node.getBoundingClientRect().top;
	}
	return 0;
}

/** 버튼 옆에 보일 짧은 주소: 사이트 안이면 경로, 바깥이면 호스트와 경로 */
function shortHref(href: string) {
	try {
		const url = new URL(href, window.location.origin);
		const path = decodeURIComponent(url.pathname);
		return url.origin === window.location.origin ? path : `${url.host}${path === '/' ? '' : path}`;
	} catch {
		return href;
	}
}

/**
 * 편집 중인 본문의 링크에 마우스를 올리면 링크 위에 이동 버튼을 띄운다.
 * 편집기에서는 링크를 눌러도 이동하지 않고 그 자리에 커서가 놓인다 (링크 글자를 고칠 수 있게).
 * 버튼은 읽기 화면과 같은 규칙으로 연다: 사이트 안의 글·프로젝트는 그 앱에서, 저장소 문서는 Finder에서, 바깥 주소는 새 탭에서.
 * ⌘·Ctrl을 누르고 링크를 누르면 버튼 없이 바로 연다. 같은 글 안의 자리(#각주)는 누르면 이동한다 (anchors.ts)
 */
const LinkHover = () => {
	const marker = useRef<HTMLSpanElement>(null);
	const hideTimer = useRef(0);
	const [shown, setShown] = useState<Shown | null>(null);
	const box = useRef<HTMLDivElement>(null);
	// 상자를 그린 뒤 실제 폭을 재어 편집기 좌우 경계 안에 둔다 (오른쪽 끝의 링크도 잘리지 않게)
	useLayoutEffect(() => {
		const element = box.current;
		const root = element?.parentElement;
		if (!element || !root || !shown) return;
		const max = root.clientWidth - element.offsetWidth - EDGE;
		element.style.left = `${Math.max(EDGE, Math.min(shown.left, max))}px`;
	}, [shown]);
	const openLinkTarget = useOpenLink();
	const openAttachment = useOpenAttachment();
	/** 올린 첨부 파일(제목 '첨부 파일 · …')은 종류에 맞는 사이트 안 앱으로, 나머지는 링크 종류대로 */
	const openLink = useCallback(
		(href: string, link: HTMLAnchorElement | null) => {
			const name = link?.textContent?.trim() ?? '';
			if (link?.title.startsWith(ATTACHMENT_TITLE) && fileAppOf(name) && openAttachment(href, name)) return;
			openLinkTarget(linkTargetOf(href));
		},
		[openAttachment, openLinkTarget]
	);

	const cancelHide = () => window.clearTimeout(hideTimer.current);
	const hideSoon = () => {
		cancelHide();
		hideTimer.current = window.setTimeout(() => setShown(null), HIDE_DELAY_MS);
	};

	useEffect(() => {
		const root = marker.current?.closest<HTMLElement>('.memo-inline-editor');
		if (!root) return;
		const linkOf = (node: EventTarget | null) => {
			const link = node instanceof Element ? node.closest<HTMLAnchorElement>('.ProseMirror a[href]') : null;
			const href = link?.getAttribute('href');
			return link && href && !href.startsWith('#') && root.contains(link) ? { link, href } : null;
		};
		const onOver = (event: MouseEvent) => {
			const hit = linkOf(event.target);
			if (!hit) return;
			window.clearTimeout(hideTimer.current);
			const box = root.getBoundingClientRect();
			const line = hit.link.getClientRects()[0] ?? hit.link.getBoundingClientRect();
			const below = line.top - scrollTopOf(root) < ROOM_ABOVE;
			setShown({
				link: hit.link,
				target: linkTargetOf(hit.href),
				href: hit.href,
				left: line.left - box.left,
				top: (below ? line.bottom : line.top) - box.top,
				below,
			});
		};
		const onOut = (event: MouseEvent) => {
			const from = linkOf(event.target);
			if (!from || linkOf(event.relatedTarget)?.link === from.link) return;
			window.clearTimeout(hideTimer.current);
			hideTimer.current = window.setTimeout(() => setShown(null), HIDE_DELAY_MS);
		};
		const onClick = (event: MouseEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return;
			const hit = linkOf(event.target);
			if (!hit) return;
			event.preventDefault();
			event.stopPropagation();
			openLink(hit.href, hit.link);
		};
		// 스크롤하거나 글을 쓰기 시작하면 버튼을 거둔다 (링크 자리가 바뀐다)
		const hide = () => setShown(null);
		root.addEventListener('mouseover', onOver);
		root.addEventListener('mouseout', onOut);
		root.addEventListener('click', onClick, true);
		root.addEventListener('keydown', hide);
		document.addEventListener('scroll', hide, { capture: true, passive: true });
		return () => {
			root.removeEventListener('mouseover', onOver);
			root.removeEventListener('mouseout', onOut);
			root.removeEventListener('click', onClick, true);
			root.removeEventListener('keydown', hide);
			document.removeEventListener('scroll', hide, { capture: true });
			window.clearTimeout(hideTimer.current);
		};
	}, [openLink]);

	// 올린 첨부 파일이면 버튼에 열 앱 이름을 보이고, 내려받기 버튼을 더한다
	const attachmentName = shown?.link.textContent?.trim() ?? '';
	const isAttachment = Boolean(shown?.link.title.startsWith(ATTACHMENT_TITLE));
	const attachmentApp = isAttachment ? (fileAppOf(attachmentName)?.app ?? null) : null;

	return (
		<>
			<span ref={marker} hidden />
			{shown && (
				<div
					className={`memo-link-hover ${shown.below ? 'below' : ''}`}
					ref={box}
					style={{ left: shown.left, top: shown.top }}
					onMouseEnter={cancelHide}
					onMouseLeave={hideSoon}
				>
					<button
						type="button"
						// 편집기의 커서와 포커스를 그대로 둔다
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => {
							openLink(shown.href, shown.link);
							setShown(null);
						}}
					>
						<i
							className={
								shown.target.kind === 'external' && !attachmentApp
									? 'fa-solid fa-arrow-up-right-from-square'
									: 'fa-solid fa-arrow-right'
							}
							aria-hidden="true"
						/>
						{attachmentApp ? `${APP_NAMES[attachmentApp]}에서 열기` : linkActionLabel(shown.target)}
					</button>
					{isAttachment && (
						<button
							type="button"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								void downloadFile(shown.href, attachmentName);
								setShown(null);
							}}
						>
							<i className="fa-solid fa-arrow-down" aria-hidden="true" />
							내려받기
						</button>
					)}
					<span className="memo-link-hover-href" title={shown.href}>
						{shortHref(shown.href)}
					</span>
				</div>
			)}
		</>
	);
};

export default LinkHover;
