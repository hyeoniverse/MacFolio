import { describe, expect, it } from 'vitest';
import { linkActionLabel, linkTargetOf as targetOf } from './linkTarget';

const SITE = 'https://macfolio.hyeoniverse.com';
const linkTargetOf = (href: string) => targetOf(href, SITE);

describe('글 본문 링크가 가리키는 곳', () => {
	it('같은 글 안의 자리, 이 사이트의 글·프로젝트, 저장소 문서, 바깥 주소를 가른다', () => {
		expect(linkTargetOf('#fn-1')).toEqual({ kind: 'anchor', id: 'fn-1' });
		expect(linkTargetOf('/memo/site-performance-report')).toEqual({
			kind: 'app',
			link: { app: 'memo', id: 'site-performance-report' },
		});
		expect(linkTargetOf('/safari/qru')).toEqual({ kind: 'app', link: { app: 'safari', id: 'qru' } });
		expect(linkTargetOf('https://github.com/hyeoniverse/MacFolio/blob/main/docs/performance.md')).toEqual({
			kind: 'doc',
			path: 'docs/performance.md',
		});
		expect(linkTargetOf('https://example.com/a')).toEqual({ kind: 'external', href: 'https://example.com/a' });
		// 같은 사이트의 전체 주소도 앱 항목
		expect(linkTargetOf(`${SITE}/memo/a`)).toEqual({ kind: 'app', link: { app: 'memo', id: 'a' } });
	});

	it('편집기 버튼 글자: 글은 "글로 이동", 프로젝트는 "프로젝트 열기", 바깥은 "새 탭에서 열기"', () => {
		expect(linkActionLabel(linkTargetOf('/memo/a'))).toBe('글로 이동');
		expect(linkActionLabel(linkTargetOf('/safari/qru'))).toBe('프로젝트 열기');
		expect(linkActionLabel(linkTargetOf('https://example.com'))).toBe('새 탭에서 열기');
	});
});
