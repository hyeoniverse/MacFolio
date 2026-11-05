import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { rehypeHighlightCode } from './highlight';
import { rehypeMath } from './math';

const render = (markdown: string) =>
	renderToStaticMarkup(createElement(ReactMarkdown, { rehypePlugins: [rehypeMath, rehypeHighlightCode] }, markdown));

describe('rehypeMath', () => {
	it('```math 블록은 블록 수식 자리로, 식은 글자로도 남긴다', () => {
		expect(render('```math\n\\sigma_{A}(R)\n```')).toBe(
			'<memo-math data-tex="\\sigma_{A}(R)" data-display="true">\\sigma_{A}(R)</memo-math>'
		);
	});

	it('인라인 코드는 끝에 {:math}가 있을 때만 인라인 수식 자리로', () => {
		expect(render('조건 `\\pi_{X}(R){:math}`를 쓴다')).toBe(
			'<p>조건 <memo-math data-tex="\\pi_{X}(R)" data-display="false">\\pi_{X}(R)</memo-math>를 쓴다</p>'
		);
		expect(render('`a{:sql}` `b`')).not.toContain('memo-math');
	});
});
