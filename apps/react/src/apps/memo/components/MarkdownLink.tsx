import React from 'react';
import { linkTargetOf } from '../linkTarget';
import { useOpenLink } from '../useOpenLink';
import { useOpenAttachment } from '../useOpenAttachment';
import { ATTACHMENT_TITLE } from '../writer/attachments';
import { fileAppOf } from '@/shared/lib/fileApps';
import { downloadFile } from '../download';

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
 * 올린 첨부 파일은 종류에 맞는 사이트 안 앱(미리보기·텍스트 편집기·Safari)으로 연다 (useOpenAttachment).
 * ⌘·Ctrl·Shift를 누르거나 가운데 버튼으로 누르면 브라우저 기본대로 (새 탭 등). 바깥 링크는 새 탭에서 연다
 */
const MarkdownLink: React.FC<Props> = ({ href, title, children, ...rest }) => {
	const openLink = useOpenLink();
	const openAttachment = useOpenAttachment();
	const target = href ? linkTargetOf(href) : null;

	// 올린 첨부 파일(링크 제목 '첨부 파일 · …')은 종류에 맞는 사이트 안 앱으로 (PDF·그림은 미리보기, md·txt는 텍스트 편집기, html은 Safari).
	// 맞는 앱이 없으면(zip 등) 새 탭에서 연다. 어느 쪽이든 배지 안의 내려받기 버튼 [📎 이름 ⬇]으로 올릴 때의 파일 이름 그대로 받는다
	// (링크 안에 버튼을 둘 수 없어 링크 뒤에 두고 CSS로 배지 안에 당긴다. 편집기는 writer/attachmentDownload.ts)
	const fileName = typeof children === 'string' ? children : null;
	if (href && fileName && title?.startsWith(ATTACHMENT_TITLE)) {
		const opensInApp = Boolean(fileAppOf(fileName));
		return (
			<span className="memo-attachment">
				<a
					href={href}
					title={title}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(event) => {
						if (!opensInApp) return;
						if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
						if (openAttachment(href, fileName)) event.preventDefault();
					}}
				>
					{children}
				</a>
				<button
					type="button"
					className="memo-attachment-download"
					aria-label={`${fileName} 내려받기`}
					title="내려받기"
					onClick={() => void downloadFile(href, fileName)}
				>
					<i className="fa-solid fa-download" aria-hidden="true" />
				</button>
			</span>
		);
	}

	if (target?.kind === 'anchor') {
		return (
			<a
				{...rest}
				href={href}
				title={title}
				onClick={(event) => {
					event.preventDefault();
					scrollToAnchor(event.currentTarget, target.id);
				}}
			>
				{children}
			</a>
		);
	}

	if (!target || target.kind === 'external') {
		return (
			<a href={href} title={title} target="_blank" rel="noopener noreferrer">
				{children}
			</a>
		);
	}

	// 사이트 안의 글·프로젝트, 저장소 문서
	return (
		<a
			href={href}
			title={title}
			{...(target.kind === 'doc' && { target: '_blank', rel: 'noopener noreferrer' })}
			onClick={(event) => {
				if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				event.preventDefault();
				openLink(target);
			}}
		>
			{children}
		</a>
	);
};

export default MarkdownLink;
