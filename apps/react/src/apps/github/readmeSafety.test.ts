import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GithubReadme from './GithubReadme';

// 프로필 README는 바깥(GitHub)에서 온 내용이다. HTML은 그리되 스크립트가 될 수 있는 것은 그리지 않는다.
// 이 시험은 그 보장을 고정한다: rehype-sanitize를 빼거나 순서를 바꾸면 여기서 깨진다.
// 메모 글은 브라우저가 필요해서 e2e/markdown-safety.spec.ts에서 본다

const ATTACKS = [
	'[링크](javascript:alert(1))',
	'[링크](JaVaScRiPt:alert(1))',
	'[링크](vbscript:msgbox(1))',
	'[링크](data:text/html,<script>alert(1)</script>)',
	'![그림](javascript:alert(1))',
	'<script>alert(1)</script>',
	'<img src="x" onerror="alert(1)">',
	'<a href="javascript:alert(1)">링크</a>',
	'<iframe src="https://evil.example"></iframe>',
].join('\n\n');

/** 그린 HTML에 스크립트로 이어질 수 있는 흔적이 없는지 */
function expectNoScript(html: string) {
	expect(html).not.toMatch(/<script/i);
	expect(html).not.toMatch(/<iframe/i);
	expect(html).not.toMatch(/\son[a-z]+=/i);
	expect(html).not.toMatch(/(href|src)="\s*(javascript|vbscript|data):/i);
}

describe('README를 그릴 때 스크립트를 막는다', () => {
	it('GitHub README: HTML은 그리되 스크립트·이벤트 속성·위험한 주소는 지운다', () => {
		const html = renderToStaticMarkup(
			createElement(GithubReadme, {
				markdown: `${ATTACKS}\n\n<p align="center"><b>안전한 HTML</b></p>`,
				login: 'hyeoniverse',
				rawBase: 'https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/main/',
				dark: false,
			})
		);
		expectNoScript(html);
		expect(html).toContain('<b>안전한 HTML</b>');
	});
});
