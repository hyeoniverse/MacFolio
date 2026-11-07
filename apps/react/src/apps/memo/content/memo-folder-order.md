---
title: pointer 이벤트와 translateY로 라이브러리 없이 구현한 순서 바꾸기 드래그
date: 2026-10-02
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: 메모 폴더
seriesOrder: 3
summary: 항상 가나다순이던 메모 폴더를 iOS 메모처럼 편집 화면의 ≡ 핸들로 드래그해 같은 계층의 순서를 바꾸게 했다. 순서는 폴더 경로를 나열한 목록 하나로 저장하고, 이름을 바꾸거나 이동하면 목록의 경로도 함께 갱신한다.
---

메모 앱의 폴더는 같은 계층끼리 항상 가나다순으로 정렬됐다. 예를 들어 최상위 폴더가 '개발 기록', '기술 노트', '인사이트', '학습'이면 항상 이 순서로 표시됐다. '개발기'와 '회고'처럼 자주 여는 폴더를 위에 배치하려면 이름을 바꾸는 방법밖에 없었다. iOS 메모는 폴더 화면의 편집 모드에서 행 오른쪽의 ≡ 핸들을 드래그해 순서를 바꾼다.

![폴더 순서 바꾸기](./images/memo-folder-order.jpg '편집 모드에서는 행마다 ≡ 핸들이 표시된다. 드래그하는 동안 잡은 폴더가 떠오르고, 지나간 폴더는 자리를 비킨다')

휴대폰 메모의 폴더 화면을 iOS 메모 편집 화면의 스크린샷과 비교하며 맞추던 중이었다. 새 폴더·편집 버튼을 복원하고 나니 iOS에는 편집 모드에서 행마다 ≡ 핸들이 있었다. 이름을 바꾸지 않고 순서를 정하려면 이 핸들이 필요해서 함께 구현했다.

PR([#68](https://github.com/hyeoniverse/MacFolio/pull/68))은 서버(정리 내용 검증), 화면(정렬·드래그), 시험을 함께 수정했다. 변경 규모는 15개 파일, 301줄 추가, 13줄 삭제다.

## 배경: 폴더가 생기는 두 출처와 정리 내용

이 블로그의 폴더는 별도의 폴더 테이블에서 오지 않는다. 폴더는 두 출처를 합쳐 만든다.

| 출처                   | 예                                                                      |
| ---------------------- | ----------------------------------------------------------------------- |
| 글 머리말의 `category` | `category: 개발 기록/MacFolio/회고`인 글이 있으면 세 단계 폴더가 생긴다 |
| 관리자가 만든 빈 폴더  | 정리 내용의 `folders` 배열                                              |

**정리 내용**(`MemoOrganization`)은 관리자가 폴더를 만들고, 글이나 폴더를 옮기고, 고정·잠금한 결과를 담은 JSON 하나다. 서버 DB에 한 행으로 저장되고, 화면은 저장소 글 목록 위에 이 JSON을 겹쳐 폴더 트리를 만든다. 폴더 경로는 `/`로 계층을 구분한 문자열(`개발 기록/MacFolio`)이고, 최대 3단계다.

순서 바꾸기를 구현하려면 두 가지를 정해야 했다.

1. 순서를 정리 내용 JSON의 어디에 어떤 형태로 저장할지
2. 손가락이나 마우스로 행을 끄는 동작을 어떻게 화면에 그릴지

## 저장: 경로 목록 하나

저장 방식은 세 가지를 비교해 선택했다.

| 방법                                            | 장점                                            | 단점                                                                                      |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 폴더마다 순번 숫자                              | 정렬이 쉽다                                     | 폴더는 글의 `category`에서 생기기도 해서 별도의 "폴더 객체"가 없다. 숫자를 붙일 곳이 없다 |
| 계층마다 배열 (`{ '개발기': ['MacFolio', …] }`) | 계층 구분이 명확하다                            | 폴더 이름을 바꾸면 키와 값을 모두 수정해야 한다                                           |
| **전체 경로를 한 목록으로**                     | 구조가 단순하고, 정렬은 "목록 안의 위치"로 결정 | 목록에 없는 폴더의 위치를 정해야 한다                                                     |

정리 내용 JSON에 `order`를 추가했다.

```ts
/** 폴더 순서: 폴더 경로를 보일 순서대로. 같은 층끼리 이 순서를 따르고, 없는 폴더는 뒤에 가나다순 */
order: string[];
```

계층마다 따로 저장하지 않고 전체 경로를 한 목록으로 나열했다. 트리를 만들면서 같은 계층의 폴더를 이 목록 안의 위치로 정렬하고, 목록에 없는 폴더(새로 생긴 글의 폴더 등)는 그 뒤에 가나다순으로 배치한다. 따라서 ==순서를 한 번도 바꾸지 않았으면 기존 정렬과 같다==.

```ts
const rank = (path: string) => {
	const index = order.indexOf(path);
	return index === -1 ? Infinity : index;
};
nodes.sort((a, b) => rank(a.path) - rank(b.path) || a.name.localeCompare(b.name));
```

[`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)는 비교 함수가 음수를 돌려주면 `a`를 앞에, 양수면 `b`를 앞에 둔다. 위 비교 함수는 먼저 `order` 안의 위치(rank)를 비교하고, rank 차이가 0이거나 계산할 수 없으면 `||` 뒤의 [`localeCompare`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)로 가나다순을 비교한다.

두 폴더가 모두 목록에 없으면 `Infinity - Infinity`가 `NaN`이 되고, `NaN`은 falsy[^falsy]이므로 `||` 뒤의 가나다순 비교로 넘어간다.

| `a` 위치 | `b` 위치 | `rank(a) - rank(b)` | 결과                       |
| -------- | -------- | ------------------- | -------------------------- |
| 0        | 2        | `-2`                | `a`가 앞                   |
| 1        | 없음     | `-Infinity`         | 목록에 있는 `a`가 앞       |
| 없음     | 없음     | `NaN`               | `localeCompare`로 가나다순 |

순서를 바꾸면 해당 계층의 경로만 목록에서 제거하고 새 순서로 다시 추가한다. 다른 계층의 순서는 변경하지 않는다.

```ts
export function reorderFolders(organization: Organization, siblings: string[]): Organization {
	return { ...organization, order: [...organization.order.filter((path) => !siblings.includes(path)), ...siblings] };
}
```

![order 목록으로 폴더를 정렬하는 예](./images/memo-folder-order-rank.svg 'order에 있는 학습(0)과 개발 기록(1)이 앞에, 목록에 없는 기술 노트와 인사이트가 뒤에 가나다순으로 놓인다. 개발 기록을 맨 위로 옮기면 최상위 경로 네 개만 새 순서로 다시 추가되고, 하위 계층의 경로는 그대로 남는다')

경로로 저장하므로 폴더 이름을 바꾸거나 다른 폴더 안으로 이동하면 목록의 경로도 갱신해야 한다. 예를 들어 '학습'을 '공부'로 바꾸면 `order`의 `'학습'`도 `'공부'`가 되어야 순서가 유지된다. 이름 바꾸기와 이동은 이미 같은 함수(`relocate`)로 글과 하위 폴더의 경로를 바꾸고 있어서, 그 함수에 `order` 갱신을 한 줄 추가했다. 폴더를 삭제하면 목록에서도 제거한다.

서버도 같은 규칙(최대 3단계, 이름 길이, 중복 금지)으로 `order`를 검증한다(`apps/api/src/memo/organization.ts`). 이전 형식의 JSON에는 `order`가 없으므로, 값이 없으면 빈 배열로 읽는다. 빈 배열이면 모든 폴더의 rank가 `Infinity`라서 기존 가나다순과 같다.

## 드래그: 잡은 폴더만 따라오게

### 포인터 이벤트

[포인터 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)는 마우스, 터치, 펜 입력을 하나의 이벤트 모델로 다루는 브라우저 API다. 마우스용 `mousedown`·`mousemove`와 터치용 `touchstart`·`touchmove`를 따로 처리하지 않고, 다음 이벤트 네 개로 같은 코드를 쓴다.

| 이벤트          | 발생 시각                                                     |
| --------------- | ------------------------------------------------------------- |
| `pointerdown`   | 버튼을 누르거나 화면에 손가락이 닿은 순간                     |
| `pointermove`   | 누른 채로 움직이는 동안 계속                                  |
| `pointerup`     | 버튼을 떼거나 손가락을 뗀 순간                                |
| `pointercancel` | 브라우저가 입력을 가져간 순간(스크롤·확대 시작, 화면 회전 등) |

![드래그하는 동안의 세 단계](./images/memo-folder-order-drag.svg '누르면 위치를 측정하고, 드래그하는 동안은 transform만 바꾸고, 놓으면 저장한다')

1. **누름**(`pointerdown`): 같은 계층 행들의 위치를 [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)로 한 번 측정해 보관한다.
2. **이동**(`pointermove`): 포인터가 움직인 만큼 잡은 행을 `translateY`로 이동한다. 잡은 행의 중심이 다른 행의 중심을 넘으면, 그 행은 잡은 행의 높이만큼 반대쪽으로 이동한다.
3. **놓음**(`pointerup`·`pointercancel`): 그 시각의 순서를 저장하고 `transform`을 제거한다.

행 높이 44px 목록에서 첫 행 '학습'을 100px 아래로 끈 순간을 계산하면 다음과 같다.

![첫 행을 100px 끈 순간의 계산](./images/memo-folder-order-shift.svg '잡은 행의 중심 122px은 기술 노트의 중심 110px을 넘고 인사이트의 중심 154px은 넘지 않았다. 그래서 새 자리는 2이고, 지나간 개발 기록과 기술 노트는 위로 44px 비킨다')

```ts
const dy = moveEvent.clientY - startY; // 100
const center = rects[from].top + height / 2 + dy; // 0 + 22 + 100 = 122
const found = rects.findIndex((rect) => center < rect.top + rect.height / 2); // 3 (중심 154)
to = found === -1 ? rects.length - 1 : found > from ? found - 1 : found; // 2
li.style.transform = `translateY(${dy}px)`;
```

### transform만 바꾸는 이유

브라우저는 화면을 고칠 때마다 다음 단계를 거친다. 스타일 계산(Style), 요소의 크기와 위치 계산(Layout), 픽셀 그리기(Paint), 여러 층을 합치기(Composite)다. `top`이나 `margin`을 바꾸면 위치가 바뀌므로 Layout부터 다시 계산하고, 그 결과에 따라 다른 행의 위치도 다시 계산한다. `transform`은 요소가 이미 그려진 층을 옮기기만 하므로 Layout과 Paint를 건너뛸 수 있다.

![픽셀 파이프라인 비교](./images/memo-folder-order-pixel-pipeline.jpg 'web.dev의 픽셀 파이프라인 그림. (가) 위치 속성을 바꾸면 Layout·Paint·Composite를 모두 거치고, (나) transform처럼 Layout과 Paint가 필요 없는 속성은 Composite만 다시 한다')

`pointermove`는 1초에 수십 번 발생하므로, 이벤트마다 Layout을 다시 하면 행이 많은 목록에서 프레임이 밀린다. ==드래그하는 동안에는 React 상태를 바꾸지 않고 스타일만 바꾸므로 컴포넌트를 다시 렌더링하지도 않는다==. 상태는 놓는 순간 `onDrop(from, to)`으로 한 번만 바꾼다.

### 세부 동작

- **같은 계층만**: 다른 폴더 안으로 넣는 동작은 '이 폴더 이동' 메뉴나 넓은 창의 드래그 앤 드롭으로 한다. 순서 바꾸기와 섞으면 포인터가 행 경계에 있으면 사용자의 의도를 판별할 수 없다
- **하위 폴더가 펼쳐진 폴더**: 하위 폴더까지 한 덩어리(`li`)로 함께 이동한다
- **스크롤 방지**: 핸들에 [`touch-action: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)을 지정했다. 이 속성이 없으면 휴대폰에서 핸들을 위아래로 끄는 동작을 브라우저가 스크롤로 해석하고 `pointercancel`을 보낸다
- **키보드**: 핸들에 포커스를 두고 ↑·↓를 누르면 한 칸씩 이동한다(`reorderKeyDelta`가 `ArrowUp`은 -1, `ArrowDown`은 1로 바꾼다)

### 라이브러리를 쓰지 않은 이유

드래그 라이브러리(dnd-kit 등)는 사용하지 않았다. 같은 계층의 세로 목록 하나만 다루면 되고, 다른 폴더 안으로 넣는 드래그 앤 드롭은 이미 별도로 구현되어 있었다. 필요한 것은 포인터 이벤트 네 개와 `transform`뿐이라 직접 구현했다. 이 코드는 직후에 만든 GitHub 저장소 선택 화면에도 같은 핸들이 필요해서 `shared/ui/reorder/pointerReorder.ts`로 옮겼다. 현재는 메모 폴더, 시스템 설정의 GitHub 저장소와 프로젝트 편집이 함께 사용한다.

## 확인

<details>
<summary>시험 목록 (서버 단위, 화면 단위, 화면 E2E)</summary>

- 서버 단위: `organization.test.ts`의 "폴더 순서: 없으면 빈 값, 있으면 폴더 경로 배열 (겹치거나 규칙에 어긋나면 거절)". 서버 E2E(`memo.e2e.test.ts`)의 빈 정리 내용 시험에도 `order`를 추가했다.
- 화면 단위: `organize.test.ts`의 "폴더 순서: 같은 층만 새 순서로 바꾸고, 이름을 바꾸거나 옮기거나 지우면 순서도 따라간다", `posts.test.ts`의 "같은 층은 정한 순서를 따르고, 순서에 없는 폴더는 뒤에 가나다순".
- 화면 E2E: `e2e/mobile.spec.ts`의 "폴더 편집의 ≡ 손잡이로 같은 층 폴더 순서를 바꾸고, 정리 내용에 저장한다". 휴대폰 화면에서 핸들을 드래그하고, 가짜 서버가 수신한 `order`를 확인한다.

</details>

## 남은 것·정리

- 다른 계층으로 이동하면서 순서까지 정하는 기능은 없다. 이동한 뒤 그 계층에서 다시 드래그한다.
- 경로를 키로 쓰는 데이터는 "경로가 바뀌는 모든 곳"을 찾아 함께 수정해야 한다. 이번에는 이름 바꾸기와 이동이 이미 `relocate` 하나를 거치고 있어서 한 줄 추가로 끝났다. ==경로를 바꾸는 코드 경로를 함수 하나로 모아 두면 이런 변경의 범위가 줄어든다==.

## 관련 글

- [Markdown 글은 두고 서버 JSON 한 행으로 겹치는 메모 폴더 정리](/memo/memo-organization-api)
- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile)
- [컴포넌트는 공유하고 휴대폰에서만 플로팅 막대를 쓰는 iOS 메모 화면](/memo/memo-mobile)

[^falsy]: 불리언 문맥에서 `false`로 취급되는 값. `false`, `0`, `""`, `null`, `undefined`, `NaN` 등이 해당한다. [MDN: Falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy)

<details>
<summary>참고 문헌</summary>

- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [MDN: Element.getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
- [MDN: Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)
- [web.dev: Rendering performance](https://web.dev/articles/rendering-performance)

</details>

<details>
<summary>사진 출처</summary>

- 픽셀 파이프라인 그림 두 장: Paul Lewis, web.dev, [Rendering performance](https://web.dev/articles/rendering-performance), CC BY 4.0 (두 그림을 위아래로 잇고 (가)·(나) 제목을 더했다)

</details>

#MacFolio #메모앱
