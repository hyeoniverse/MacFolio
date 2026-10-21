import React from 'react';
import { useAppState } from '@/desktop/useAppState';
import { bundledDocOf } from '@/apps/finder/repoDocs';
import { useOpenDocument } from '@/apps/textedit/openDocument';
import { appLinkOf } from '@/shared/lib/appLink';
import { requestOpen } from '@/shared/lib/openRequest';

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	href?: string;
	title?: string;
	children?: React.ReactNode;
}

/**
 * 같은 글 안의 자리(`#user-content-fn-1` 같은 각주)로. 주소의 #은 바꾸지 않고 그 자리로 스크롤한다:
 * 글은 창 안의 스크롤 영역에 있고, 주소는 사이트 경로(/memo/<글>)를 쓰기 때문이다.
 * 같은 글이 화면에 두 번(편집기 미리 보기 등) 있을 수 있어 누른 링크가 든 본문 안에서 찾는다
 */
function scrollToAnchor(link: HTMLAnchorElement, id: string) {
	const root = link.closest('.memo-markdown') ?? document;
	const find = (name: string) => root.querySelector<HTMLElement>(`[id="${CSS.escape(name)}"]`);
	// 글 안의 id는 user-content-가 붙는다 (각주, 접기 블록). 글에는 짧은 이름(#terms)으로 적는다
	const target = find(id) ?? find(`user-content-${id}`);
	if (!target) return;
	// 접힌 블록이거나 접힌 블록 안이면 펼친다
	for (let el: HTMLElement | null = target; el && el !== root; el = el.parentElement) {
		if (el instanceof HTMLDetailsElement) el.open = true;
	}
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	target.scrollIntoView({
		block: target instanceof HTMLDetailsElement ? 'start' : 'center',
		behavior: reduce ? 'auto' : 'smooth',
	});
	// 도착한 자리를 잠깐 표시하고, 키보드 사용자도 그 자리에서 이어 읽게 포커스를 옮긴다
	const focusable =
		target instanceof HTMLDetailsElement
			? (target.querySelector<HTMLElement>(':scope > summary') ?? target)
			: target.matches('a, button')
				? target
				: (target.querySelector<HTMLElement>('a') ?? target);
	focusable.focus({ preventScroll: true });
	target.classList.remove('memo-anchor-hit');
	void target.offsetWidth;
	target.classList.add('memo-anchor-hit');
}

/**
 * 글 본문의 링크. 이 사이트의 앱 항목(/memo/<글>, /safari/<프로젝트>)은 새 탭이 아니라 사이트 안에서 연다:
 * 메모 글은 지금 메모 앱에서 그 글로, 프로젝트는 Safari의 그 탭으로 (Finder가 여는 것과 같은 길, openRequest).
 * 저장소 문서(GitHub의 README·CONTRIBUTING·docs/*.md)는 Finder에서 연다 (Apple 메뉴의 개인정보 처리 방침과 같은 길).
 * ⌘·Ctrl·Shift를 누르거나 가운데 버튼으로 누르면 브라우저 기본대로 (새 탭 등). 바깥 링크는 새 탭에서 연다
 */
const MarkdownLink: React.FC<Props> = ({ href, title, children, ...rest }) => {
	const { openApp } = useAppState();
	const openDocument = useOpenDocument();
	const link = appLinkOf(href);
	const doc = bundledDocOf(href);

	if (href?.startsWith('#') && href.length > 1) {
		const id = decodeURIComponent(href.slice(1));
		return (
			<a
				{...rest}
				href={href}
				title={title}
				onClick={(event) => {
					event.preventDefault();
					scrollToAnchor(event.currentTarget, id);
				}}
			>
				{children}
			</a>
		);
	}

	if (doc) {
		return (
			<a
				href={href}
				title={title}
				target="_blank"
				rel="noopener noreferrer"
				onClick={(event) => {
					if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					event.preventDefault();
					openDocument(doc);
				}}
			>
				{children}
			</a>
		);
	}

	if (!link) {
		return (
			<a href={href} title={title} target="_blank" rel="noopener noreferrer">
				{children}
			</a>
		);
	}

	return (
		<a
			href={href}
			title={title}
			onClick={(event) => {
				if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				event.preventDefault();
				openApp(link.app);
				requestOpen(link.app, link.id);
			}}
		>
			{children}
		</a>
	);
};

export default MarkdownLink;
