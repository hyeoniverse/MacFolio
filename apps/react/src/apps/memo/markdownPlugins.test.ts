import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { REMARK_PLUGINS } from './markdownPlugins';

const render = (markdown: string) =>
	renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: REMARK_PLUGINS }, markdown));

describe('REMARK_PLUGINS', () => {
	it('문장부호로 끝난 굵게 뒤에 조사가 붙어도 굵게로 그린다', () => {
		expect(render('이번엔 **취소(cancelled)**가 떴다')).toBe('<p>이번엔 <strong>취소(cancelled)</strong>가 떴다</p>');
		expect(render('**`dragover`**를 보낸다')).toBe('<p><strong><code>dragover</code></strong>를 보낸다</p>');
		expect(render('*“기울임”*은 된다')).toBe('<p><em>“기울임”</em>은 된다</p>');
	});

	it('영어 글과 GFM은 그대로다', () => {
		expect(render('a **b** c')).toBe('<p>a <strong>b</strong> c</p>');
		expect(render('~~old~~ new')).toBe('<p><del>old</del> new</p>');
	});

	it('취소선은 ~~만, 범위를 적은 ~ 하나는 글자 그대로다', () => {
		expect(render('220~440px, 380~640px')).toBe('<p>220~440px, 380~640px</p>');
		expect(render('~하나~ ~~둘~~')).toBe('<p>~하나~ <del>둘</del></p>');
	});

	it('#태그는 누를 수 있는 태그로, 코드·링크 안은 그대로', () => {
		expect(render('오늘 #리팩터링 했다')).toBe(
			'<p>오늘 <span class="memo-tag" data-tag="리팩터링">#리팩터링</span> 했다</p>'
		);
		expect(render('`#코드` [#링크](https://a.b) #14')).toBe(
			'<p><code>#코드</code> <a href="https://a.b">#링크</a> #14</p>'
		);
	});

	it('<details>·<summary> 표기는 접기 블록으로, 안의 Markdown은 그대로 그린다', () => {
		expect(render('<details>\n<summary>용어</summary>\n\n**굵게** 설명\n\n</details>')).toBe(
			'<details class="memo-details"><summary>용어</summary><p><strong>굵게</strong> 설명</p></details>'
		);
		expect(render('<details open>\n<summary>펼침</summary>\n\n내용\n\n</details>')).toBe(
			'<details class="memo-details" open=""><summary>펼침</summary><p>내용</p></details>'
		);
	});

	it('<details id>는 user-content-를 붙인 id로 (본문 링크로 찾아간다)', () => {
		expect(render('<details id="terms">\n<summary>용어</summary>\n\n내용\n\n</details>')).toBe(
			'<details class="memo-details" id="user-content-terms"><summary>용어</summary><p>내용</p></details>'
		);
	});

	it('접기 요약은 글자로만 넣고, 다른 HTML은 여전히 요소로 그리지 않는다', () => {
		const html = render(
			'<details>\n<summary>&lt;b&gt;굵게&lt;/b&gt;</summary>\n\n내용\n\n</details>\n\n<script>x</script>'
		);
		expect(html).toContain('<summary>&lt;b&gt;굵게&lt;/b&gt;</summary>');
		expect(html).not.toContain('<script');
		// 속성이 붙은 줄은 접기로 알아보지 않는다 (지금처럼 글자로 보인다)
		expect(render('<details onclick="x">\n\n내용\n\n</details>')).not.toContain('<details');
	});
});
