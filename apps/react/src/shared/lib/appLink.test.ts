import { describe, expect, it } from 'vitest';
import { appPath, appUrl, parseAppPath } from './appLink';

describe('앱 항목 주소', () => {
	it('앱과 항목을 경로로 만들고, 거꾸로 읽는다', () => {
		expect(appPath({ app: 'memo', id: 'cra-to-vite' })).toBe('/memo/cra-to-vite');
		expect(appPath({ app: 'safari', id: 'sproutfarm' })).toBe('/safari/sproutfarm');
		expect(appUrl({ app: 'memo', id: 'cra-to-vite' }, 'https://macfolio.hyeoniverse.com')).toBe(
			'https://macfolio.hyeoniverse.com/memo/cra-to-vite'
		);
		expect(parseAppPath('/memo/cra-to-vite')).toEqual({ app: 'memo', id: 'cra-to-vite' });
		expect(parseAppPath('/safari/sproutfarm/')).toEqual({ app: 'safari', id: 'sproutfarm' });
	});

	it('한글처럼 주소에 쓸 수 없는 글자는 인코딩했다가 그대로 되돌린다', () => {
		const path = appPath({ app: 'memo', id: '새 글 1' });
		expect(path).toBe('/memo/%EC%83%88%20%EA%B8%80%201');
		expect(parseAppPath(path)).toEqual({ app: 'memo', id: '새 글 1' });
	});

	it('주소가 있는 앱의 항목이 아니면 null', () => {
		expect(parseAppPath('/')).toBeNull();
		expect(parseAppPath('/memo/')).toBeNull();
		expect(parseAppPath('/memo/a/b')).toBeNull();
		expect(parseAppPath('/music/a')).toBeNull();
		expect(parseAppPath('/memo/%E0%A4%A')).toBeNull();
	});
});
