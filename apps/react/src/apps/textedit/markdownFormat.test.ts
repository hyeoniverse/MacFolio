import { describe, expect, it } from 'vitest';
import { applyMarkdown, fromEditorMarkdown, headingAt, setHeading } from './markdownFormat';

describe('Markdown 도구 막대', () => {
	it('굵게: 고른 글자를 감싸고, 다시 누르면 벗긴다', () => {
		const once = applyMarkdown('안녕 세상', 3, 5, 'bold');
		expect(once).toEqual({ text: '안녕 **세상**', start: 5, end: 7 });
		expect(applyMarkdown(once.text, once.start, once.end, 'bold')).toEqual({ text: '안녕 세상', start: 3, end: 5 });
	});

	it('코드·기울임·취소선도 같은 방식', () => {
		expect(applyMarkdown('x', 0, 1, 'strike').text).toBe('~~x~~');
		expect(applyMarkdown('React', 0, 5, 'code').text).toBe('`React`');
		expect(applyMarkdown('a', 0, 1, 'italic').text).toBe('_a_');
	});

	it('링크: [글자](https://)를 넣고 주소 자리를 고른다', () => {
		const edit = applyMarkdown('MacFolio', 0, 8, 'link');
		expect(edit.text).toBe('[MacFolio](https://)');
		expect(edit.text.slice(edit.start, edit.end)).toBe('https://');
	});

	it('줄 표시: 고른 줄마다 붙이고, 모두 붙어 있으면 뗀다', () => {
		const text = '첫 줄\n둘째 줄\n셋째 줄';
		const listed = applyMarkdown(text, 2, 7, 'list');
		expect(listed.text).toBe('- 첫 줄\n- 둘째 줄\n셋째 줄');
		expect(applyMarkdown(listed.text, listed.start, listed.end, 'list').text).toBe(text);
		expect(applyMarkdown('항목', 1, 1, 'ordered').text).toBe('1. 항목');
		expect(applyMarkdown('a\nb', 2, 2, 'quote').text).toBe('a\n> b');
	});

	it('문단 스타일: 줄의 # 단계를 읽고 바꾼다', () => {
		expect(headingAt('글\n## 절', 6)).toBe(2);
		expect(headingAt('본문', 1)).toBe(0);
		expect(setHeading('## 절', 2, 2, 3).text).toBe('### 절');
		expect(setHeading('### 절', 0, 0, 0).text).toBe('절');
		expect(setHeading('글', 0, 0, 1).text).toBe('# 글');
	});

	it('편집기의 Markdown을 이력서 원문 모양으로: <주소>·<메일>을 풀고, 강조가 아닌 \\*를 *로', () => {
		expect(fromEditorMarkdown('<a@b.com> · 설명 <https://x.com>')).toBe('a@b.com · 설명 https://x.com');
		expect(fromEditorMarkdown('A\\* 경로 탐색')).toBe('A* 경로 탐색');
		// 강조 기호와 링크는 그대로
		expect(fromEditorMarkdown('**굵게** [이름](#project/x)')).toBe('**굵게** [이름](#project/x)');
	});
});
