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

	it('==형광펜==은 <mark>로, 안의 다른 서식도 그대로 그린다', () => {
		expect(render('핵심은 ==데이터 독립성==이다')).toBe(
			'<p>핵심은 <mark class="memo-highlight">데이터 독립성</mark>이다</p>'
		);
		expect(render('==**굵게** 와 [링크](https://a.b)==')).toBe(
			'<p><mark class="memo-highlight"><strong>굵게</strong> 와 <a href="https://a.b">링크</a></mark></p>'
		);
		expect(render('==하나== 그리고 ==둘==')).toBe(
			'<p><mark class="memo-highlight">하나</mark> 그리고 <mark class="memo-highlight">둘</mark></p>'
		);
	});

	it('공백을 낀 ==, 짝이 없는 ==, 코드 안의 ==는 글자 그대로다', () => {
		// prettier가 줄 첫머리의 ==를 \\==로 이스케이프해도 형광펜이다
		expect(render('> \\==**정의**==이다')).toBe(
			'<blockquote>\n<p><mark class="memo-highlight"><strong>정의</strong></mark>이다</p>\n</blockquote>'
		);
		expect(render('a == b 이고 c == d')).toBe('<p>a == b 이고 c == d</p>');
		expect(render('==닫히지 않음')).toBe('<p>==닫히지 않음</p>');
		expect(render('`a == b`와 ====')).toBe('<p><code>a == b</code>와 ====</p>');
	});

	it('제목에 글 안 주소(id)를 붙여 [제목](#주소) 링크로 이동할 수 있다', () => {
		expect(render('## 데이터와 정보')).toBe('<h2 id="user-content-데이터와-정보">데이터와 정보</h2>');
		expect(render('### 1단계: `정규` 개체 타입')).toBe(
			'<h3 id="user-content-1단계-정규-개체-타입">1단계: <code>정규</code> 개체 타입</h3>'
		);
		// 같은 제목은 -1, -2
		expect(render('## 정리\n\n## 정리')).toBe(
			'<h2 id="user-content-정리">정리</h2>\n<h2 id="user-content-정리-1">정리</h2>'
		);
	});

	it('> [!NOTE] 같은 GitHub 경고 표기는 콜아웃 상자로, 같은 줄의 글자는 제목으로 그린다', () => {
		expect(render('> [!NOTE]\n> 정규화는 의미로 판단한다.')).toBe(
			'<aside class="memo-callout memo-callout-note">\n<p class="memo-callout-title"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>참고</p>\n<p>정규화는 의미로 판단한다.</p>\n</aside>'
		);
		expect(render('> [!warning] Heath의 정리\n> 역은 성립하지 않는다.')).toBe(
			'<aside class="memo-callout memo-callout-warning">\n<p class="memo-callout-title"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>Heath의 정리</p>\n<p>역은 성립하지 않는다.</p>\n</aside>'
		);
		// 표시가 없거나 모르는 종류면 인용 그대로
		expect(render('> [!TODO] 할 일')).toBe('<blockquote>\n<p>[!TODO] 할 일</p>\n</blockquote>');
	});
});
