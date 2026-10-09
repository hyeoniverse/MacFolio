import { describe, expect, it } from 'vitest';
import { collectTags, tagsInText, tagsOf } from './tags.js';

describe('tagsOf', () => {
	it('본문의 #태그를 처음 나온 순서로, 대소문자가 달라도 하나로', () => {
		expect(tagsOf('오늘은 #React 와 #리팩터링 을 했다.\n\n#react 다시, (#CSS) 그리고 [#링크글자]')).toEqual([
			'React',
			'리팩터링',
			'CSS',
			'링크글자',
		]);
	});

	it('제목, 코드, 링크 주소, 이슈 번호, 색, 단어 가운데의 #은 태그가 아니다', () => {
		const markdown = [
			'# 제목',
			'## 작은 제목',
			'```css',
			'.a { color: #edbb4d; } /* #코드안 */',
			'```',
			'`#인라인코드` 와 [링크](https://example.com/#section), [앞](#anchor)',
			'Refs #14, 색은 #fff 와 #2b2100, C#언어',
			'#115의 API, #96에서, #14로 옮긴 것',
			'<a href="#html">',
			'#진짜태그',
		].join('\n');
		expect(tagsOf(markdown)).toEqual(['진짜태그']);
	});
});

describe('tagsInText', () => {
	it('#부터 이름 끝까지의 자리', () => {
		expect(tagsInText('가 #태그 나')).toEqual([{ name: '태그', start: 2, end: 5 }]);
		expect(tagsInText('#첫줄')).toEqual([{ name: '첫줄', start: 0, end: 3 }]);
	});
});

describe('collectTags', () => {
	it('글이 많은 태그가 앞, 같으면 이름 순', () => {
		expect(collectTags([{ body: '#나 #가' }, { body: '#나 #다' }, { body: '코드뿐' }])).toEqual([
			{ name: '나', count: 2 },
			{ name: '가', count: 1 },
			{ name: '다', count: 1 },
		]);
	});
});
