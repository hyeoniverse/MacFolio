---
title: 이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E
date: 2026-10-01
category: 개발 기록/MacFolio/트러블슈팅
series: E2E 시험
seriesOrder: 4
summary: 블로그 글에 이미지를 추가한 PR에서, 변경과 무관한 이미지 드래그 E2E가 실패했다. 이벤트를 하나씩 기록해 확인한 원인은 두 가지였다. 이미지 로드가 끝나기 전에 측정한 좌표, 그리고 마지막 이동 단계에서 발생하지 않은 dragover.
---

| 증상                                                                  | 원인                                                                  | 해결                                                    | 영향 범위                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 끌기 표시선 시험이 `toBeVisible()` 직후 `boundingBox()` `null`로 실패 | 경계를 넘는 이동 단계의 `dragover` 누락, 이미지 로드 전에 측정한 좌표 | 로드 완료를 기다리고, 창 안으로 스크롤하고, 1px 더 이동 | `e2e/memo-editor.spec.ts` 이미지 끌기 시험. 무관한 PR도 실패 |

## 배경

### E2E 시험과 불안정한 시험

**E2E(End-to-End) 시험**은 실제 브라우저를 띄워 사용자처럼 클릭·입력·드래그하고 화면 결과를 확인하는 시험이다. MacFolio는 [Playwright](https://playwright.dev/)로 E2E를 작성하고, PR마다 CI(GitHub Actions)에서 실행한다. 같은 코드로 실행해도 통과와 실패가 바뀌는 시험을 **불안정한 시험(flaky test)**[^flaky]이라고 한다. 시험이 화면 좌표, 로드 시각처럼 고정되지 않은 조건에 의존할 때 주로 생긴다.

### 드래그 앤 드롭 이벤트

브라우저의 [HTML 드래그 앤 드롭](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)은 요소를 끄는 동안 다음 이벤트를 차례로 보낸다.

| 이벤트      | 받는 요소        | 발생 시각                                                |
| ----------- | ---------------- | -------------------------------------------------------- |
| `dragstart` | 끄는 요소        | 드래그를 시작할 때 한 번                                 |
| `dragenter` | 마우스 아래 요소 | 끄는 중에 마우스가 새 요소로 들어갈 때                   |
| `dragover`  | 마우스 아래 요소 | 놓을 수 있는 요소 위에 있는 동안 반복해서 (수백 ms 간격) |
| `dragleave` | 직전 요소        | 마우스가 그 요소를 벗어날 때                             |
| `drop`      | 마우스 아래 요소 | 마우스 버튼을 놓을 때                                    |
| `dragend`   | 끄는 요소        | 드래그가 끝날 때 한 번                                   |

HTML 표준은 드래그하는 동안 마우스가 멈춰 있어도 약 350ms(±200ms)마다 `dragover`를 다시 보내도록 정한다[^dnd]. 요소 경계를 넘는 순간에는 새 요소에 `dragenter`, 이전 요소에 `dragleave`가 연달아 발생한다.

![끄는 이미지 줄에 dragstart와 dragend, 문단 A 줄에 dragenter·dragover·dragleave, 소제목 B 줄에 dragenter·dragover·drop이 시간 순서로 놓여 있다](./images/flaky-drag-e2e-dnd-events.svg '이미지를 문단 A에서 소제목 B 위로 끌어 놓을 때의 이벤트 순서')

### 이벤트 전파와 캡처 단계

DOM 이벤트는 대상 요소에서만 처리되지 않고, 문서 루트에서 대상까지 내려간 뒤(캡처 단계) 대상에서 다시 루트로 올라간다(버블 단계)[^capture]. 부모 요소에 캡처 단계 리스너를 등록하면 그 안의 어떤 자식에게 가는 이벤트든 자식보다 먼저 받을 수 있다. 원인 추적에서는 이 성질을 이용해 편집기 안에서 발생하는 드래그 이벤트를 모두 기록했다.

![Window, Document, html, body, table, tbody, tr, td로 이어지는 트리에서 빨간 점선은 위에서 대상 td까지 내려가는 캡처 단계, 초록 점선은 대상에서 위로 올라가는 버블 단계를 나타낸다](./images/flaky-drag-e2e-event-flow.png '이벤트는 캡처 단계(1), 대상 단계(2), 버블 단계(3)를 거친다 (W3C UI Events)')

## 증상

기존 블로그 글에 스크린샷을 추가하는 PR([#47](https://github.com/hyeoniverse/MacFolio/pull/47))을 생성했다. 변경 파일은 Markdown과 이미지뿐이었는데 CI가 실패했다. 실패한 시험은 153개 중 하나로, 편집기에서 **이미지를 드래그하면 놓을 위치에 표시선(drop indicator)이 나타나는지** 확인하는 시험이었다. `e2e/memo-editor.spec.ts`의 "이미지: 캡션을 눌러 그 자리에서 고치고, 내려받기 버튼으로 받고, 끌 때 놓을 자리가 보인다"의 마지막 부분이다.

```text
TypeError: Cannot read properties of null (reading 'height')

  357 | await expect(indicator).toBeVisible();
  358 | const line = (await indicator.boundingBox())!;
> 359 | expect(line.height).toBeLessThanOrEqual(4);
```

`toBeVisible()`은 통과했는데 바로 다음 줄에서 `boundingBox()`가 `null`을 반환했다. `boundingBox()`는 요소가 화면에 없으면 `null`을 반환하므로, 표시선이 **나타났다가 곧바로 사라졌다**는 뜻이다. 재시도(retry)에서도 같은 결과로 실패했으므로 일시적인 실패로 볼 수 없었다.

## 원인 추적

| 가설                                      | 확인 방법                      | 결과                                                                                                |
| ----------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| 이 PR이 추가한 이미지가 레이아웃을 바꿨다 | 새 이미지 위치 확인            | 배제. 새 이미지는 글 하단에 있다                                                                    |
| 이 PR이 만든 버그다                       | `main`에서 같은 시험 실행      | 배제. `main`에서도 실패, 다른 PR([#48](https://github.com/hyeoniverse/MacFolio/pull/48))에서도 실패 |
| 마지막 이동 단계에서 `dragover`가 없다    | 캡처 단계 리스너로 이벤트 기록 | 확인. 경계를 넘는 단계마다 `dragover` 누락                                                          |
| `dragover`만 보충하면 해결된다            | 1px 추가 이동 후 다시 기록     | 부족. 소제목이 창 밖으로 밀려 있었다                                                                |

### 코드 변경 없이 실패한 이유

이 시험은 "Markdown 블로그에 글쓰기 붙이기" 글을 열고, 첫 이미지를 첫 소제목 위로 드래그한다. 이 PR에서 바로 그 글에 이미지를 하나 추가했으므로 레이아웃 변경을 먼저 의심했다. 그러나 새 이미지는 글 하단에 있었고, 첫 이미지와 첫 소제목 사이에는 변경이 없었다.

로컬에서 실행하자 `main`에서도 같은 방식으로 실패했다. 이 PR이 만든 버그가 아니라 **기존에 있던 불안정한 시험**이었고, 이전 PR들은 조건이 맞지 않아 통과했을 뿐이었다. 글을 변경하지 않고 규칙 문서만 추가한 다른 PR([#48](https://github.com/hyeoniverse/MacFolio/pull/48))에서도 같은 시험이 실패했다.

### 표시선을 숨기는 코드 분석

표시선은 Milkdown이 사용하는 `prosemirror-drop-indicator`가 렌더링한다. 표시선을 숨기는 코드는 다음과 같다.

```ts
const scheduleHide = () => {
	hasDragOverEvent = false;
	hideId = setTimeout(() => {
		if (hasDragOverEvent) return; // 그 사이 dragover가 오면 숨기지 않는다
		options.onHide?.();
	}, 30);
};
dom.addEventListener('dragover', handleDragOver); // hasDragOverEvent = true, 선을 그린다
dom.addEventListener('dragleave', scheduleHide);
```

`dragleave`가 발생하면 30ms 뒤에 숨긴다. 그 사이에 `dragover`가 한 번이라도 발생하면 숨기기가 취소된다. 요소 경계를 넘을 때마다 `dragleave`가 발생하지만, 실제 브라우저는 드래그하는 동안 `dragover`를 계속 발생시키므로 표시선이 유지된다([MDN: dragover 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event)).

### 이벤트 기록

편집기에 캡처 단계 리스너를 등록하고, 드래그하는 동안 발생하는 이벤트를 모두 기록했다. 열은 시각(ms), 이벤트, 대상 요소, 마우스 y 좌표다.

```text
6750 dragover  IMG  393
6751 dragover  IMG  409
6752 dragenter SPAN 425
6752 dragleave IMG  425
6754 dragenter DIV  441
6754 dragleave SPAN 441
6755 dragover  DIV  457
6756 dragenter H2   473   ← 마지막 이동 단계
6756 dragleave DIV  473   ← 숨기기 예약
                          ← dragover 없음
```

시험은 `page.mouse.move(x, y, { steps: 12 })`로 마우스를 움직인다. [`steps`](https://playwright.dev/docs/api/class-mouse#mouse-move) 옵션은 출발점과 도착점 사이를 지정한 횟수로 나눠 중간 `mousemove`를 보낸다. 위 기록에서 y가 16px씩 증가하는 것이 각 이동 단계다. 마지막 이동 단계에서 소제목(H2)으로 넘어가며 `dragenter`·`dragleave`는 발생했지만 `dragover`가 없다. 로그 전체를 다시 확인하자 **요소 경계를 넘는 이동 단계마다 `dragover`가 누락되어 있었다.**

![이동 단계 7부터 12까지 마우스 y, 포인터 아래 요소, 발생한 이벤트를 표로 정리했다. 경계를 넘은 9, 10, 12단계에는 dragover가 없고, 수정 후 1px 추가 이동에서 dragover가 발생한다](./images/flaky-drag-e2e-steps.svg '로그를 이동 단계별로 정리한 결과. 경계를 넘는 단계에는 dragover가 없다')

### 첫 수정 후에도 실패

마지막에 마우스를 1px 더 움직여 `dragover`를 한 번 더 발생시켰다. 그래도 실패했다. 다시 기록하자 이번에는 마지막 줄이 다음과 같았다.

```text
6630 dragover  DIV  690
6631 dragleave DIV  706   ← 편집기 밖
```

y가 706인데 메모 창은 700에서 끝난다. **소제목이 창 밖에 있었다.** 첫 번째 원인만 수정해서는 해결되지 않는 이유였다.

## 원인

원인은 두 가지였다.

**1. 경계를 넘는 이동 단계에 `dragover`가 없다.** ==Playwright가 Chromium에 전달하는 드래그 입력에서는 경계를 넘는 단계에 `dragover`가 발생하지 않는다.== 사람이 드래그할 때는 수백 ms 안에 다음 `dragover`가 이어지므로 문제가 없지만, 시험은 그 위치에서 마우스를 멈추고 곧바로 표시선을 측정한다.

![마지막 걸음에서 dragover가 오지 않을 때](./images/drag-events.svg '경계를 넘는 이동 단계에는 dragover가 없다. 마지막 단계가 경계를 넘으면 30ms 뒤 표시선이 사라진다')

마지막 단계가 경계를 넘는지는 좌표에 따라 결정된다. 글자 크기, 이미지 높이, 글 내용이 조금만 달라져도 결과가 바뀐다. 그래서 실행 환경에 따라 통과와 실패가 엇갈렸다.

**2. 이미지 로드가 끝나기 전에 좌표를 측정했다.** `<img>`는 파일을 받기 전에는 실제 높이를 알 수 없어, 로드가 끝나면 그 높이만큼 아래 요소가 밀려난다(레이아웃 이동). 측정한 소제목 위치는 472였는데, 측정 이후 위쪽 이미지의 로드가 끝나 높이가 확정되면서 소제목이 아래로 밀렸다. 마우스가 창 밖으로 나가면 편집기를 벗어난 것으로 판단해 표시선을 숨긴다.

![위치를 측정한 뒤 밀린 소제목](./images/flaky-drag-e2e-layout-shift.svg '이미지 높이가 확정되기 전에 측정한 좌표로 드래그하면 목표가 창 밖으로 밀려 있다')

## 해결

### 고려한 방법

| 방법                                                                  | 장점                    | 선택하지 않은 이유                                                                                  |
| --------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| 재시도 횟수를 늘린다                                                  | 설정 한 줄              | 조건이 맞으면 매번 실패하므로 재시도해도 결과가 같다                                                |
| 표시선 검사를 삭제한다                                                | 더 이상 실패하지 않는다 | 표시선 기능이 고장 나도 검출할 수 없다. 이 기능의 목적이 그 표시선이다                              |
| 숨기기 지연(30ms)을 늘리도록 라이브러리를 수정한다                    | 시험 코드는 그대로      | 실제 사용자와 무관한 문제로 라이브러리 동작을 바꾸게 되고, 창 밖으로 벗어나는 두 번째 원인은 남는다 |
| **로드 완료를 기다리고, 창 안으로 스크롤하고, 1px 한 번 더 이동한다** | 두 원인을 모두 제거     | 시험 코드가 몇 줄 늘어난다                                                                          |

마지막 방법을 선택했다. ==시험이 실제 사용자의 드래그와 같은 조건을 재현하는 것==이 목적에 맞기 때문이다.

### 두 원인을 함께 수정

`img.complete`는 이미지 로드가 끝나면 `true`가 되고, `naturalWidth`는 실제로 디코딩된 이미지의 너비다. 둘을 함께 확인하면 로드 실패(`naturalWidth === 0`)와 구분할 수 있다.

```ts
// 이미지를 다 불러온 뒤(크기가 정해진 뒤) 창 맨 위로 올려, 이미지와 놓을 자리가 모두 창 안에 오게 한다
await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
await figure.evaluate((element) => element.scrollIntoView({ block: 'start' }));
// …자리를 재고 끈다
await page.mouse.move(target.x + 40, target.y + 2, { steps: 12 });
// 마지막 걸음이 경계를 넘었을 수 있으니 제자리에서 dragover를 한 번 더
await page.mouse.move(target.x + 41, target.y + 3);
```

## 확인

로컬에서 6회 연속 실행해 모두 통과했고, CI도 통과했다. 현재도 같은 시험이 `toBeVisible()` 다음에 표시선 높이가 4px 이하인지, 표시선의 y가 소제목 위치에서 40px 이내인지, 마우스를 놓으면 표시선이 사라지는지 확인한다.

불안정한 시험은 한 번 통과로는 수정 여부를 판단할 수 없다. 같은 시험을 반복 실행한다.

```bash
cd apps/react
npx playwright test e2e/memo-editor.spec.ts --project=desktop-chromium --repeat-each=20
npx playwright test e2e/memo-editor.spec.ts --trace=on      # 실패하면
npx playwright show-trace test-results/…/trace.zip          # 이벤트·화면을 한 단계씩
```

드래그 이벤트 순서를 직접 확인하려면 시험 안에서 `page.on('console', …)`로 페이지의 콘솔 로그를 수신해 출력한다. trace와 반복 실행은 [Playwright Trace viewer](https://playwright.dev/docs/trace-viewer)와 [CLI 문서](https://playwright.dev/docs/test-cli)에 있다.

## 재발 방지

화면 좌표를 측정하는 시험에 다음 원칙을 적용했다.

| 원칙                                          | 이유                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| **좌표는 레이아웃이 확정된 뒤에 측정한다**    | 이미지 로드 전에 측정한 좌표는 로드 후 틀린 좌표가 된다                     |
| **대상을 창 안으로 스크롤한다**               | 창 크기와 글 길이에 의존하지 않는다                                         |
| **실제 브라우저처럼 `dragover`를 발생시킨다** | 표시선 유지 조건은 라이브러리가 정한 것이고, 시험이 그 조건을 충족해야 한다 |

> [!IMPORTANT] 불안정한 시험은 특정 조건에서 반드시 실패한다
> 불안정한 시험은 "가끔 실패"하는 것이 아니라 특정 조건에서 반드시 실패한다. 그 조건을 찾으면 수정할 수 있다. 이번에는 이벤트 로그 기록으로 조건을 특정했다.

> [!TIP] 코드를 변경하지 않은 PR이 실패하면
> `main`에서도 실행한다. 기존 문제인지 먼저 판별해야 관계없는 코드를 수정하지 않는다.

- 화면 좌표를 측정하는 시험은 측정 시각이 값만큼 중요하다. 이미지·웹 글꼴처럼 크기가 늦게 확정되는 요소가 위에 있으면 로드 완료를 기다린 뒤 측정한다.
- Playwright의 드래그는 사람의 드래그와 이벤트 순서가 다를 수 있다. 라이브러리가 의존하는 이벤트를 먼저 확인하면 시험이 충족해야 할 조건을 알 수 있다.
- 남은 과제: 다른 드래그 시험에도 같은 "1px 추가 이동"을 적용할지는 검토하지 않았다. 현재는 실패하지 않아 그대로 두었다.

## 부가 문제: CI 시간 초과로 인한 취소

같은 수정을 다른 PR에 적용하자 이번에는 CI 상태가 실패가 아니라 **취소(cancelled)**로 표시되었다. GitHub Actions는 작업에 지정한 제한 시간(`timeout-minutes`)을 넘기면 작업을 취소한다. 원인은 시험이 아니라 실행 시간이었다.

| 항목                                                          | 값                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| CI 제한 시간                                                  | 15분                                                                                                         |
| 실행마다 걸린 시간                                            | 13~15분                                                                                                      |
| 그중 Playwright용 시스템 패키지(글꼴, 그래픽 라이브러리) 설치 | 약 4분                                                                                                       |
| 조치                                                          | 제한 시간 25분, 근거는 설정 파일 주석에 기록 ([#48](https://github.com/hyeoniverse/MacFolio/pull/48)에 포함) |

러너가 느린 날에는 15분을 넘겼다. 이후 시험이 510개로 늘자 25분에도 도달하기 시작해, 화면 E2E를 별도 작업으로 분리하고 샤드로 나눠 병렬 실행했다. 그 과정은 [git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기](/memo/faster-e2e-ci)에 있다.

## 관련 글

- [Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)
- [Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)
- [git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기](/memo/faster-e2e-ci)
- [리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그](/memo/bugs-found-by-tests)
- [마운트 전 React.lazy 편집기로 가는 포커스를 onReady까지 대기시키기](/memo/lazy-editor-focus)

[^flaky]: 코드 변경 없이 실행마다 통과와 실패가 바뀌는 시험. 대부분 타이밍, 레이아웃, 외부 상태 같은 숨은 조건에 의존한다.

[^dnd]: [HTML Standard: Drag-and-drop processing model](https://html.spec.whatwg.org/multipage/dnd.html#drag-and-drop-processing-model). 드래그를 시작한 뒤 350ms(±200ms) 간격으로 드래그 처리 단계를 반복하고, 그때마다 현재 대상 요소에 `dragover`를 보낸다.

[^capture]: `addEventListener(type, fn, { capture: true })`로 등록하면 캡처 단계에서 호출되어 하위 요소의 리스너보다 먼저 실행된다. [MDN: addEventListener](https://developer.mozilla.org/ko/docs/Web/API/EventTarget/addEventListener)

<details>
<summary>참고 문헌</summary>

- [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [MDN: dragover 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dragover_event)
- [HTML Standard: Drag and drop](https://html.spec.whatwg.org/multipage/dnd.html)
- [W3C: UI Events, Event dispatch and DOM event flow](https://w3c.github.io/uievents/#event-flow)
- [MDN: HTMLImageElement.complete](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/complete)
- [Playwright: Mouse.move](https://playwright.dev/docs/api/class-mouse#mouse-move)
- [Playwright: Trace viewer](https://playwright.dev/docs/trace-viewer)
- [GitHub Docs: jobs.<job_id>.timeout-minutes](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes)

</details>

<details>
<summary>사진 출처</summary>

- DOM 이벤트 전파 도식: W3C, [UI Events](https://w3c.github.io/uievents/#event-flow) ([원본 SVG](https://w3c.github.io/uievents/images/eventflow.svg)), W3C Software and Document License

</details>

#MacFolio #테스트 #Playwright #트러블슈팅
