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
});
