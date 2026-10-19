---
title: 게시 버튼 글자가 흐렸던 이유 - 선택자 우선순위에 진 색
date: 2026-10-01
category: 개발기/MacFolio/프론트엔드
summary: 노란 게시 버튼의 글자가 회색으로 흐렸다. .memo button(0,1,1)이 버튼 클래스(0,1,0)를 이기고 있었다. 우선순위를 찾은 방법, 코드 복사·이미지 내려받기 버튼과 캡션 입력칸 손질, 그 뒤 CSS 층으로 뿌리를 고친 기록.
---

메모 편집기 오른쪽 위의 **게시** 버튼은 고친 내용이 있으면 노란 바탕으로 켜진다. 그런데 켜진 버튼의 글자가 흐려서 잘 안 읽혔다. 편집기를 다듬는 PR([#55](https://github.com/hyeoniverse/MacFolio/pull/55))에서 함께 고쳤다.

![고치기 전 게시 버튼](./images/memo-publish-before.jpg '노란 바탕 위 글자가 회색이라 흐리다')

CSS에는 분명히 진한 갈색을 적어 두었다.

```css
.memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

바탕은 노랗게 나오는데 글자색만 적은 대로 나오지 않았다.

## 어떤 규칙이 이겼나

브라우저에서 버튼의 계산된 색을 읽어 보니 `rgb(107, 114, 128)`이었다. 메모 앱의 흐린 글자색(`--memo-muted`)이다. 이 버튼에 걸리는 규칙 중 `color`를 정하는 것을 모두 뽑아 봤다.

```ts
const rules = [];
for (const sheet of document.styleSheets)
	for (const rule of sheet.cssRules)
		if (rule.selectorText && rule.style.color && button.matches(rule.selectorText))
			rules.push(`${rule.selectorText} → ${rule.style.color}`);
```

```text
.memo button → inherit
.memo-writer-publish → rgb(43, 33, 0)
```

범인은 앱 전체에 깔아 둔 이 규칙이었다.

```css
.memo button {
	font: inherit;
	color: inherit;
	cursor: pointer;
}
```

버튼이 브라우저 기본 글꼴·색 대신 앱의 글꼴·색을 따르게 하려고 둔 것이다. 그런데 **우선순위**가 문제였다.

| 선택자                 | 클래스 | 태그 | 우선순위  |
| ---------------------- | ------ | ---- | --------- |
| `.memo button`         | 1      | 1    | (0, 1, 1) |
| `.memo-writer-publish` | 1      | 0    | (0, 1, 0) |

클래스 수가 같으면 태그가 하나 더 있는 `.memo button`이 이긴다. 파일에서 뒤에 적었는지는 우선순위가 같을 때만 따진다. 그래서 갈색 대신 `inherit`이 들어가 부모의 흐린 글자색을 물려받았다.

![두 규칙의 우선순위](./images/memo-button-specificity.svg '클래스 수가 같으면 태그 수로 갈린다')

## 고친 방법

| 방법                                               | 좋은 점          | 걸리는 점                                                     |
| -------------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| `.memo button`을 `:where(.memo) button`으로 낮춘다 | 뿌리를 고친다    | 그동안 덮여 있던 버튼 글꼴이 한꺼번에 살아난다                |
| 게시 버튼에 `!important`                           | 한 단어          | 다음에 이 버튼 색을 바꾸려는 규칙도 `!important`가 필요해진다 |
| **게시 버튼 규칙의 점수를 올린다**                 | 이 버튼만 바뀐다 | 부모 클래스를 붙이는 손질이 버튼마다 필요하다                 |

첫 번째가 뿌리를 고치는 쪽이라 먼저 따져 봤다. 그런데 `.memo button`의 `font: inherit`은 **`font-size`·`font-weight`까지 함께 덮는** 줄임 속성이다. 실제로 게시 버튼도 `font-size: 11px; font-weight: 600`으로 적었지만, 계산된 값은 부모를 따른 `12px`, `400`이었다. 버튼마다 클래스로 적은 글꼴이 이렇게 덮여 있을 수 있다. 이 규칙을 약하게 만들면 그동안 덮여 있던 크기·굵기가 한꺼번에 살아나 앱 곳곳의 버튼 모양이 바뀐다. 이번 일은 게시 버튼 하나라서 세 번째로 했다.

```css
/* 글자색은 .memo button(color: inherit)보다 앞서도록 .memo-writer-actions를 붙인다 */
.memo-writer-actions .memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

(0, 2, 0)이 되어 이긴다. 같은 줄의 "변경 사항 버리기" 버튼 규칙도 같은 꼴이라 함께 올렸다.

![고친 뒤 게시 버튼](./images/memo-publish-after.jpg '노란 바탕 위에 진한 갈색 글자')

## 코드 복사와 이미지 내려받기를 같은 모양으로

본문에서 블록 위에 뜨는 버튼이 둘 있다. 코드 블록의 **복사**와 이미지의 **내려받기**다. 그런데 둘은 따로 만든 탓에 모양이 전혀 달랐다.

- 복사: 글자 "복사", 회색 바탕의 작은 알약
- 내려받기: 화살표 아이콘, 어두운 반투명 원

![고치기 전 두 버튼](./images/memo-overlay-before.jpg '왼쪽은 코드 블록의 복사, 오른쪽은 이미지의 내려받기. 같은 자리에 뜨는데 모양이 다르다')

둘 다 "블록 오른쪽 위에 뜨는 버튼"이라서 클래스 하나(`.memo-overlay-button`)로 모았다.

- 28px 둥근 사각형, 어두운 반투명 바탕(`rgba(28, 28, 30, 0.55)` + 흐림), 흰 아이콘
- 블록에 마우스를 올리면 보이고, 터치 기기에서는 늘 보인다
- 복사는 글자 대신 복사 아이콘이 된다. 누르면 1.5초 동안 체크 아이콘으로 바뀌고, 마우스를 올리면 "복사됨"이 뜬다

코드 위에서도 사진 위에서도 보여야 해서, 밝은 코드 바탕에 맞춘 회색이 아니라 사진 위에서 쓰던 어두운 바탕을 골랐다. 이 규칙에도 `.memo`를 붙였다. 위에서 겪은 것처럼 `.memo button`에 흰 글자색을 빼앗기지 않게 하려는 것이다.

![고친 뒤 두 버튼](./images/memo-overlay-after.jpg '같은 크기·모서리·바탕의 버튼. 복사는 아이콘으로')

두 버튼이 다시 따로 놀지 않게 E2E로 묶어 두었다. 같은 글의 복사 버튼과 내려받기 버튼을 찾아 계산된 크기·모서리·바탕색·글자색이 같은지 비교한다.

```ts
const look = (el: Element) => {
	const style = getComputedStyle(el);
	const rect = el.getBoundingClientRect();
	return [rect.width, rect.height, style.borderRadius, style.backgroundColor, style.color];
};
expect(await copy.evaluate(look)).toEqual(await download.evaluate(look));
```

## 캡션 입력칸

이미지 캡션을 누르면 그 자리에서 고치는 입력칸이 열린다. 이 칸도 손볼 곳이 셋 있었다.

![고치기 전 캡션 입력칸](./images/memo-caption-before.jpg '긴 캡션이 한 줄 칸에서 잘리고, 열자마자 전부 골라져 있다')

- 한 줄짜리 `<input>`이라 긴 캡션은 양옆이 잘려 보였다
- 열자마자 캡션 전체가 골라져 있어서, 글자 하나만 쳐도 캡션이 통째로 지워졌다
- 굵은 노란 테두리가 주변 글보다 눈에 띄었다

`<textarea rows="1">`로 바꾸고 글에 맞춰 높이를 늘렸다. 캡션은 Markdown 이미지의 제목이라 한 줄이어야 한다. 그래서 Enter는 줄바꿈 대신 저장으로 두고, 붙여 넣은 줄바꿈은 띄어쓰기로 바꾼다.

```ts
const fit = () => {
	input.style.height = 'auto';
	input.style.height = `${input.scrollHeight + 2}px`;
};
input.addEventListener('input', () => {
	if (/\n/.test(input.value)) input.value = input.value.replace(/\s*\n\s*/g, ' ');
	fit();
});
```

열 때는 전부 고르지 않고 글 끝에 커서를 둔다. 테두리는 옅은 선으로 두고, 포커스를 받으면 노란 선과 옅은 노란 그림자를 준다.

![고친 뒤 캡션 입력칸](./images/memo-caption-after.jpg '긴 캡션도 줄을 바꿔 다 보이고, 커서는 글 끝에')

## 남은 것: 그 뒤에 뿌리를 고쳤다

이 글을 쓸 때는 `.memo button`을 그대로 두었다. 지금 화면이 그 덮인 값에 맞춰져 있어서, 한 번에 바꾸면 앱 곳곳의 버튼이 바뀌기 때문이다.

며칠 뒤 공통 컴포넌트를 만들기 시작하면서 이 일을 먼저 했다([#57](https://github.com/hyeoniverse/MacFolio/pull/57)). `:where()`로 점수를 낮추는 대신 CSS 층(cascade layer)을 썼다. 앱 루트의 기본값은 `@layer reset`에, 공통 컴포넌트는 `@layer components`에 넣는다. 층에 든 규칙은 층 밖의 규칙에 선택자 점수와 상관없이 진다.

```css
/* memo/styles/theme.css (지금) */
@layer reset {
	.memo button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
}
```

![CSS 층 순서](./images/memo-button-specificity-layers.svg '층 사이 순서가 점수보다 먼저라, 버튼 클래스 하나로도 reset을 이긴다')

이제 게시 버튼 규칙은 `.memo-writer-publish` 하나로도 이긴다. 다만 이번에 붙인 `.memo-writer-actions .memo-writer-publish`는 지금도 그대로 남아 있다. 이겨도 해가 없고, 주석으로 이유를 적어 두었다. 층 순서를 어디서 처음 정하느냐에 따라 공통 버튼 여백이 사라진 일도 있었다. 그 이야기는 [CSS 층 순서 고침](/memo/css-layer-order-fix)에 있다.

## 배운 것

- "적은 값이 안 먹는다"는 대개 다른 규칙이 이기고 있다는 뜻이다. 계산된 값을 읽고, 그 요소에 걸리는 규칙을 모두 뽑아 보면 이긴 쪽이 바로 보인다. 위의 `document.styleSheets` 스크립트는 개발자 도구의 "Computed" 탭이 하는 일을 코드로 한 것이다.
- `font`·`background`·`border` 같은 줄임 속성은 적지 않은 하위 속성까지 덮는다. 앱 루트의 기본값에 줄임 속성을 쓰면 그 영향이 넓다.
- 같은 자리에 뜨는 버튼은 같은 클래스로 묶고, "모양이 같다"를 시험으로 고정해 두면 다시 갈라지지 않는다.

## 관련 글

- [앱 루트 기본값을 @layer reset으로](/memo/css-layer-reset)
- [CSS 층 순서를 index.html에서 정하기](/memo/css-layer-order-fix)
- [!important를 지우고 아이콘 버튼을 IconButton으로](/memo/shared-button)
- [Memo.css를 구역마다 한 파일로](/memo/memo-css-split)

#MacFolio #메모앱 #CSS #트러블슈팅
