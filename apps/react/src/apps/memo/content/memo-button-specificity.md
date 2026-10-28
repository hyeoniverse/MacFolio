---
title: 선택자 우선순위 계산으로 흐린 게시 버튼 글자색의 원인 찾기
date: 2026-10-01
category: 개발 기록/MacFolio/디자인 시스템
summary: 노란 게시 버튼의 글자가 회색으로 흐렸다. .memo button(0,1,1)이 버튼 클래스(0,1,0)보다 우선순위가 높았다. 우선순위를 확인한 방법, 코드 복사·이미지 내려받기 버튼과 캡션 입력칸 수정, 이후 캐스케이드 레이어로 근본 원인을 해결한 기록.
---

메모 편집기 오른쪽 위의 **게시** 버튼은 수정한 내용이 있으면 노란 바탕으로 활성화된다. 그런데 활성화된 버튼의 글자가 흐려서 잘 읽히지 않았다. 편집기를 다듬는 PR([#55](https://github.com/hyeoniverse/MacFolio/pull/55))에서 함께 수정했다.

![수정 전 게시 버튼](./images/memo-publish-before.jpg '노란 바탕 위 글자가 회색이라 흐리다')

CSS에는 진한 갈색을 지정해 두었다.

```css
.memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

바탕은 노란색으로 표시되는데 글자색만 지정한 값과 달랐다.

이 버튼을 조사한 날짜는 10월 1일이다. 오전에 메모 CSS의 `:where(.memo) button` 규칙이 존재하는 이유를 파악하려고 버튼의 클래스와 스타일 구조를 도식으로 정리했다. 그 결과 앱마다 `button` 규칙을 각자 보유하고 공통 버튼 컴포넌트가 없다는 점이 드러났고, 이것이 이후의 공통 컴포넌트 리팩터링으로 이어졌다. 같은 날 저녁에는 게시 버튼 위쪽 테두리가 잘려 보이는 현상도 발견했다. 흐린 글자도 같은 조사 과정에서 원인을 찾았다.

## 어떤 규칙이 적용됐나

브라우저에서 버튼의 계산된 값([`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle))을 조회하니 글자색이 `rgb(107, 114, 128)`이었다. 메모 앱의 보조 글자색(`--memo-muted`)이다. 이 버튼에 일치하는 규칙 중 `color`를 지정하는 규칙을 [`document.styleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/styleSheets)에서 모두 추출했다.

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

원인은 앱 전체에 적용되는 다음 규칙이었다.

```css
.memo button {
	font: inherit;
	color: inherit;
	cursor: pointer;
}
```

버튼이 브라우저 기본 글꼴·색 대신 앱의 글꼴·색을 상속하도록 추가한 규칙이다. 문제는 **명시도**(specificity)[^specificity]였다.

| 선택자                 | 클래스 | 태그 | 명시도    |
| ---------------------- | ------ | ---- | --------- |
| `.memo button`         | 1      | 1    | (0, 1, 1) |
| `.memo-writer-publish` | 1      | 0    | (0, 1, 0) |

클래스 수가 같으면 태그가 하나 더 있는 `.memo button`이 우선한다. 파일 안의 선언 순서는 명시도가 같을 때만 비교한다. 그래서 갈색 대신 `inherit`이 적용되어 부모의 보조 글자색을 상속했다.

![두 규칙의 명시도](./images/memo-button-specificity.svg '클래스 수가 같으면 태그 수로 우선순위가 정해진다')

## 수정 방법

| 방법                                               | 장점                      | 단점                                                        |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| `.memo button`을 `:where(.memo) button`으로 낮춘다 | 근본 원인을 해결한다      | 그동안 덮여 있던 버튼 글꼴 선언이 한꺼번에 적용된다         |
| 게시 버튼에 `!important`                           | 선언 하나만 추가하면 된다 | 이후 이 버튼 색을 바꾸는 규칙에도 `!important`가 필요해진다 |
| **게시 버튼 규칙의 명시도를 높인다**               | 이 버튼만 바뀐다          | 버튼마다 부모 클래스를 붙이는 작업이 필요하다               |

첫 번째 방법은 [`:where()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)가 괄호 안 선택자의 명시도를 0으로 만드는 점을 이용한다. 근본 원인을 해결하는 방법이라 먼저 검토했다. 그런데 `.memo button`의 `font: inherit`은 **`font-size`·`font-weight`까지 함께 지정하는** [단축 속성](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties)이다. 실제로 게시 버튼에도 `font-size: 11px; font-weight: 600`을 지정했지만, 계산된 값은 부모를 상속한 `12px`, `400`이었다. 다른 버튼도 클래스에 지정한 글꼴이 같은 방식으로 덮여 있을 수 있다. 이 규칙의 명시도를 낮추면 덮여 있던 크기·굵기가 한꺼번에 적용되어 앱 전체의 버튼 모양이 바뀐다. 이번 수정 대상은 게시 버튼 하나라서 세 번째 방법을 택했다.

```css
/* 글자색은 .memo button(color: inherit)보다 앞서도록 .memo-writer-actions를 붙인다 */
.memo-writer-actions .memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

명시도가 (0, 2, 0)이 되어 `.memo button`보다 우선한다. 같은 줄의 "변경 사항 버리기" 버튼 규칙도 구조가 같아서 함께 높였다.

![수정 후 게시 버튼](./images/memo-publish-after.jpg '노란 바탕 위에 진한 갈색 글자')

## 코드 복사와 이미지 내려받기 버튼 통일

본문에서 블록 위에 표시되는 버튼이 두 개 있다. 코드 블록의 **복사**와 이미지의 **내려받기**다. 두 버튼은 별도로 구현되어 모양이 서로 달랐다.

| 버튼     | 수정 전                         | 수정 후                                             |
| -------- | ------------------------------- | --------------------------------------------------- |
| 복사     | 글자 "복사", 회색 바탕의 알약   | 복사 아이콘, 28px 둥근 사각형, 어두운 반투명 바탕   |
| 내려받기 | 화살표 아이콘, 어두운 반투명 원 | 화살표 아이콘, 28px 둥근 사각형, 어두운 반투명 바탕 |

![수정 전 두 버튼](./images/memo-overlay-before.jpg '왼쪽은 코드 블록의 복사, 오른쪽은 이미지의 내려받기. 같은 위치에 표시되는데 모양이 다르다')

둘 다 "블록 오른쪽 위에 표시되는 버튼"이라서 클래스 하나(`.memo-overlay-button`)로 통합했다.

- 28px 둥근 사각형, 어두운 반투명 바탕(`rgba(28, 28, 30, 0.55)` + 블러), 흰 아이콘
- 블록에 마우스를 올리면 표시되고, 터치 기기에서는 항상 표시된다
- 복사는 글자 대신 복사 아이콘을 사용한다. 누르면 1.5초 동안 체크 아이콘으로 바뀌고, 마우스를 올리면 "복사됨" 툴팁이 표시된다

코드 위와 사진 위 모두에서 보여야 하므로, 밝은 코드 바탕에 맞춘 회색 대신 사진 위에서 쓰던 어두운 바탕을 선택했다. 이 규칙에도 `.memo`를 붙였다. 앞에서처럼 `.memo button`이 흰 글자색을 덮어쓰지 않도록 하기 위해서다.

![수정 후 두 버튼](./images/memo-overlay-after.jpg '같은 크기·모서리·바탕의 버튼. 복사는 아이콘으로')

두 버튼의 모양이 다시 달라지지 않도록 E2E 시험으로 고정했다. 같은 글의 복사 버튼과 내려받기 버튼을 찾아 계산된 크기·모서리·바탕색·글자색이 같은지 비교한다.

```ts
const look = (el: Element) => {
	const style = getComputedStyle(el);
	const rect = el.getBoundingClientRect();
	return [rect.width, rect.height, style.borderRadius, style.backgroundColor, style.color];
};
expect(await copy.evaluate(look)).toEqual(await download.evaluate(look));
```

## 캡션 입력칸

이미지 캡션을 누르면 그 위치에서 편집하는 입력칸이 열린다. 이 입력칸에는 문제가 세 가지 있었다.

![수정 전 캡션 입력칸](./images/memo-caption-before.jpg '긴 캡션이 한 줄 칸에서 잘리고, 열자마자 전체가 선택되어 있다')

| 문제                                                                     | 수정                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 한 줄짜리 `<input>`이라 긴 캡션의 양 끝이 잘려 보였다                    | `<textarea rows="1">`로 바꾸고 내용 높이에 맞춘다          |
| 열자마자 캡션 전체가 선택되어, 글자 하나만 입력해도 캡션 전체가 삭제됐다 | 전체 선택 대신 글 끝에 커서를 놓는다                       |
| 굵은 노란 테두리가 주변 글보다 눈에 띄었다                               | 평소에는 옅은 테두리, 포커스 시 노란 선과 옅은 노란 그림자 |

캡션은 Markdown 이미지의 제목(title)이라 한 줄이어야 한다. 그래서 Enter는 줄바꿈 대신 저장으로 처리하고, 붙여 넣은 줄바꿈은 공백으로 바꾼다. 높이는 [`scrollHeight`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight)로 측정한다.

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

![수정 후 캡션 입력칸](./images/memo-caption-after.jpg '긴 캡션도 줄을 바꿔 모두 보이고, 커서는 글 끝에')

## 이후 작업: 근본 원인 해결

이 글을 쓴 시각에는 `.memo button`을 그대로 유지했다. 현재 화면이 덮인 값에 맞춰져 있어서, 한 번에 바꾸면 앱 전체의 버튼 모양이 바뀌기 때문이다.

며칠 뒤 공통 컴포넌트 작업을 시작하면서 이 작업을 먼저 진행했다([#57](https://github.com/hyeoniverse/MacFolio/pull/57)). `:where()`로 명시도를 낮추는 대신 [캐스케이드 레이어](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)(cascade layer)를 사용했다. 앱 루트의 기본값은 `@layer reset`에, 공통 컴포넌트는 `@layer components`에 넣는다. 레이어 안의 규칙은 선택자 명시도와 관계없이 레이어 밖의 규칙보다 우선순위가 낮다.

```css
/* memo/styles/theme.css (현재) */
@layer reset {
	.memo button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
}
```

![캐스케이드 레이어 순서](./images/memo-button-specificity-layers.svg '레이어 순서가 명시도보다 먼저 비교되므로, 버튼 클래스 하나로도 reset보다 우선한다')

이제 게시 버튼 규칙은 `.memo-writer-publish` 하나만으로도 우선한다. 다만 이번에 추가한 `.memo-writer-actions .memo-writer-publish`는 현재도 남아 있다. 명시도가 높아도 부작용이 없고, 주석에 이유를 기록해 두었다. 레이어 순서를 처음 선언하는 위치 때문에 공통 버튼 여백이 사라진 일도 있었다. 그 내용은 [CSS 층 순서를 index.html에서 정하기](/memo/css-layer-order-fix)에 정리했다.

## 정리

- "지정한 값이 적용되지 않는다"는 대개 다른 규칙이 우선한다는 뜻이다. 계산된 값을 조회하고, 그 요소에 일치하는 규칙을 모두 추출하면 적용된 규칙이 바로 드러난다. 위의 `document.styleSheets` 스크립트는 개발자 도구의 Computed 탭이 보여 주는 정보를 코드로 추출한 것이다.
- `font`·`background`·`border` 같은 단축 속성은 지정하지 않은 하위 속성까지 초기화한다. 앱 루트의 기본값에 단축 속성을 쓰면 영향 범위가 넓다.
- 같은 위치에 표시되는 버튼은 같은 클래스로 묶고, "모양이 같다"를 시험으로 고정하면 다시 달라지지 않는다.

## 관련 글

- [앱 루트 기본값을 @layer reset으로](/memo/css-layer-reset)
- [CSS 층 순서를 index.html에서 정하기](/memo/css-layer-order-fix)
- [!important를 지우고 아이콘 버튼을 IconButton으로](/memo/shared-button)
- [Memo.css를 구역마다 한 파일로](/memo/memo-css-split)

[^specificity]: 같은 요소에 여러 규칙이 일치할 때 어느 규칙을 적용할지 정하는 점수. (ID 수, 클래스·속성·의사 클래스 수, 태그·의사 요소 수) 세 자리를 앞자리부터 비교한다. 자세한 계산 방법은 [MDN의 Specificity 문서](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)에 있다.

#MacFolio #메모앱 #CSS #트러블슈팅
