import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { rehypeHighlightCode } from './highlight';

const render = (markdown: string) =>
	renderToStaticMarkup(createElement(ReactMarkdown, { rehypePlugins: [rehypeHighlightCode] }, markdown));

describe('rehypeHighlightCode', () => {
	it('```sql 코드 블록을 강조한다', () => {
		expect(render('```sql\nSELECT 1\n```')).toContain('<span class="hljs-keyword">SELECT</span>');
	});

	it('인라인 코드는 끝에 {:언어} 꼬리표가 있을 때만 꼬리표를 떼고 강조한다', () => {
		expect(render('`SELECT * FROM ENROL{:sql}`를 실행한다')).toBe(
			'<p><code class="language-sql hljs"><span class="hljs-keyword">SELECT</span> ' +
				'<span class="hljs-operator">*</span> <span class="hljs-keyword">FROM</span> ENROL</code>를 실행한다</p>'
		);
		// 꼬리표가 없거나 모르는 언어면 글자 그대로
		expect(render('`SELECT * FROM ENROL`')).toBe('<p><code>SELECT * FROM ENROL</code></p>');
		expect(render('`x{:nope}`')).toBe('<p><code>x{:nope}</code></p>');
	});
});
