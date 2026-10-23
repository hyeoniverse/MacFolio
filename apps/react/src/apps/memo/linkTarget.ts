// 글 본문의 링크가 가리키는 곳. 읽기 화면(MarkdownLink)과 편집기의 링크 버튼(LinkHover)이 같은 규칙으로 연다
import { bundledDocOf } from '@/apps/finder/repoDocs';
import { appLinkOf, type AppLink } from '@/shared/lib/appLink';

export type LinkTarget =
	/** 같은 글 안의 자리 (#각주 등) */
	| { kind: 'anchor'; id: string }
	/** 이 사이트의 앱 항목 (/memo/<글>, /safari/<프로젝트>): 사이트 안에서 연다 */
	| { kind: 'app'; link: AppLink }
	/** 저장소 문서 (GitHub의 README·docs/*.md): Finder에서 연다 */
	| { kind: 'doc'; path: string }
	/** 바깥 주소: 새 탭에서 연다 */
	| { kind: 'external'; href: string };

/** origin: 이 사이트의 주소 (같은 사이트의 전체 주소도 앱 항목으로 본다) */
export function linkTargetOf(href: string, origin = window.location.origin): LinkTarget {
	if (href.startsWith('#') && href.length > 1) return { kind: 'anchor', id: decodeURIComponent(href.slice(1)) };
	const doc = bundledDocOf(href);
	if (doc) return { kind: 'doc', path: doc };
	const link = appLinkOf(href, origin);
	if (link) return { kind: 'app', link };
	return { kind: 'external', href };
}

/** 편집기의 링크 버튼 글자 */
export function linkActionLabel(target: LinkTarget): string {
	switch (target.kind) {
		case 'anchor':
			return '그 자리로 이동';
		case 'app':
			return target.link.app === 'memo' ? '글로 이동' : '프로젝트 열기';
		case 'doc':
			return '문서 열기';
		case 'external':
			return '새 탭에서 열기';
	}
}
