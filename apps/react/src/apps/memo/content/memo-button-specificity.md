---
title: 게시 단추 글자가 흐렸던 이유 - 선택자 우선순위에 진 색
date: 2026-10-01
category: 개발기/MacFolio/메모
summary: 노란 게시 단추의 글자가 회색으로 흐렸다. 색을 정한 규칙은 있었는데 다른 규칙이 이기고 있었다. 우선순위를 확인한 방법과, 그 김에 모양이 제각각이던 코드 복사·이미지 내려받기 단추와 캡션 입력칸을 다듬은 기록.
---

메모 편집기 오른쪽 위의 **게시** 단추는 고친 내용이 있으면 노란 바탕으로 켜진다. 그런데 켜진 단추의 글자가 흐려서 잘 안 읽혔다.

![고치기 전 게시 단추](./images/memo-publish-before.jpg '노란 바탕 위 글자가 회색이라 흐리다')

CSS에는 분명히 진한 갈색을 적어 두었다.

```css
.memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

바탕은 노랗게 나오는데 글자색만 적은 대로 나오지 않았다.

## 어떤 규칙이 이겼나

브라우저에서 단추의 계산된 색을 읽어 보니 `rgb(107, 114, 128)`이었다. 메모 앱의 흐린 글자색(`--memo-muted`)이다. 이 단추에 걸리는 규칙 중 `color`를 정하는 것을 모두 뽑아 봤다.

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

단추가 브라우저 기본 글꼴·색 대신 앱의 글꼴·색을 따르게 하려고 둔 것이다. 그런데 **우선순위**가 문제였다.

| 선택자                 | 클래스 | 태그 | 우선순위  |
| ---------------------- | ------ | ---- | --------- |
| `.memo button`         | 1      | 1    | (0, 1, 1) |
| `.memo-writer-publish` | 1      | 0    | (0, 1, 0) |

클래스 수가 같으면 태그가 하나 더 있는 `.memo button`이 이긴다. 파일에서 뒤에 적었는지는 우선순위가 같을 때만 따진다. 그래서 갈색 대신 `inherit`이 들어가 부모의 흐린 글자색을 물려받았다.

![두 규칙의 우선순위](./images/memo-button-specificity.svg '클래스 수가 같으면 태그 수로 갈린다')

## 고친 방법

방법은 두 가지였다.

1. `.memo button`을 `:where(.memo) button`으로 바꿔 우선순위를 (0, 0, 1)로 낮춘다
2. 게시 단추 규칙의 우선순위를 올린다

1번이 뿌리를 고치는 쪽이라 먼저 따져 봤다. 그런데 `.memo button`의 `font: inherit`은 **`font-size`·`font-weight`까지 함께 덮는** 줄임 속성이다. 실제로 게시 단추도 `font-size: 11px; font-weight: 600`으로 적었지만, 계산된 값은 부모를 따른 `12px`, `400`이었다. 단추마다 클래스로 적은 글꼴이 이렇게 덮여 있을 수 있다. 이 규칙을 약하게 만들면 그동안 덮여 있던 크기·굵기가 한꺼번에 살아나 앱 곳곳의 단추 모양이 바뀐다. 이번 일은 게시 단추 하나라서 2번으로 했다.

```css
/* 글자색은 .memo button(color: inherit)보다 앞서도록 .memo-writer-actions를 붙인다 */
.memo-writer-actions .memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

(0, 2, 0)이 되어 이긴다. 같은 줄의 "변경 사항 버리기" 단추 규칙도 같은 꼴이라 함께 올렸다.

![고친 뒤 게시 단추](./images/memo-publish-after.jpg '노란 바탕 위에 진한 갈색 글자')

## 코드 복사와 이미지 내려받기를 같은 모양으로

본문에서 블록 위에 뜨는 단추가 둘 있다. 코드 블록의 **복사**와 이미지의 **내려받기**다. 그런데 둘은 따로 만든 탓에 모양이 전혀 달랐다.

- 복사: 글자 "복사", 회색 바탕의 작은 알약
- 내려받기: 화살표 아이콘, 어두운 반투명 원

![고치기 전 두 단추](./images/memo-overlay-before.jpg '왼쪽은 코드 블록의 복사, 오른쪽은 이미지의 내려받기. 같은 자리에 뜨는데 모양이 다르다')

둘 다 "블록 오른쪽 위에 뜨는 단추"라서 클래스 하나(`.memo-overlay-button`)로 모았다.

- 28px 둥근 사각형, 어두운 반투명 바탕(`rgba(28, 28, 30, 0.55)` + 흐림), 흰 아이콘
- 블록에 마우스를 올리면 보이고, 터치 기기에서는 늘 보인다
- 복사는 글자 대신 복사 아이콘이 된다. 누르면 1.5초 동안 체크 아이콘으로 바뀌고, 마우스를 올리면 "복사됨"이 뜬다

코드 위에서도 사진 위에서도 보여야 해서, 밝은 코드 바탕에 맞춘 회색이 아니라 사진 위에서 쓰던 어두운 바탕을 골랐다. 이 규칙에도 `.memo`를 붙였다. 위에서 겪은 것처럼 `.memo button`에 흰 글자색을 빼앗기지 않게 하려는 것이다.

![고친 뒤 두 단추](./images/memo-overlay-after.jpg '같은 크기·모서리·바탕의 단추. 복사는 아이콘으로')

두 단추가 다시 따로 놀지 않게 E2E로 묶어 두었다. 같은 글의 복사 단추와 내려받기 단추를 찾아 계산된 크기·모서리·바탕색·글자색이 같은지 비교한다.

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

## 남은 것

`.memo button`은 그대로 두었다. 언젠가 `:where(.memo) button`으로 낮추면 단추마다 클래스로 적은 크기·색이 제대로 먹는다. 다만 지금 화면이 그 덮인 값에 맞춰져 있어서, 한 번에 바꾸면 앱 곳곳의 단추가 바뀐다. 바꾼다면 화면별로 스크린샷을 비교하며 따로 해야 한다.

#MacFolio #메모앱 #CSS #트러블슈팅
