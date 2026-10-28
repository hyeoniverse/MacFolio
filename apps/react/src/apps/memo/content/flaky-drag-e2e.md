---
title: 이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E
date: 2026-10-01
category: 개발 기록/MacFolio/품질
summary: 블로그 글에 이미지를 추가한 PR에서, 변경과 무관한 이미지 드래그 E2E가 실패했다. 이벤트를 하나씩 기록해 확인한 원인은 두 가지였다. 이미지 로드가 끝나기 전에 측정한 좌표, 그리고 마지막 이동 단계에서 발생하지 않은 dragover.
---

기존 블로그 글에 스크린샷을 추가하는 PR([#47](https://github.com/hyeoniverse/MacFolio/pull/47))을 생성했다. 변경 파일은 Markdown과 이미지뿐이었는데 CI가 실패했다. 실패한 시험은 153개 중 하나로, 편집기에서 **이미지를 드래그하면 놓을 위치에 표시선(drop indicator)이 나타나는지** 확인하는 시험이었다. `e2e/memo-editor.spec.ts`의 "이미지: 캡션을 눌러 그 자리에서 고치고, 내려받기 버튼으로 받고, 끌 때 놓을 자리가 보인다"의 마지막 부분이다.

```text
TypeError: Cannot read properties of null (reading 'height')

  357 | await expect(indicator).toBeVisible();
  358 | const line = (await indicator.boundingBox())!;
> 359 | expect(line.height).toBeLessThanOrEqual(4);
```

`toBeVisible()`은 통과했는데 바로 다음 줄에서 `boundingBox()`가 `null`을 반환했다. 표시선이 **나타났다가 곧바로 사라졌다**는 뜻이다. 재시도(retry)에서도 같은 결과로 실패했으므로 일시적인 실패로 볼 수 없었다.

## 코드 변경 없이 실패한 이유

이 시험은 "Markdown 블로그에 글쓰기 붙이기" 글을 열고, 첫 이미지를 첫 소제목 위로 드래그한다. 이 PR에서 바로 그 글에 이미지를 하나 추가했으므로 레이아웃 변경을 먼저 의심했다. 그러나 새 이미지는 글 하단에 있었고, 첫 이미지와 첫 소제목 사이에는 변경이 없었다.

로컬에서 실행하자 `main`에서도 같은 방식으로 실패했다. 이 PR이 만든 버그가 아니라 **기존에 있던 불안정한(flaky) 시험**[^flaky]이었고, 이전 PR들은 조건이 맞지 않아 통과했을 뿐이었다. 글을 변경하지 않고 규칙 문서만 추가한 다른 PR([#48](https://github.com/hyeoniverse/MacFolio/pull/48))에서도 같은 시험이 실패했다.

## 표시선을 숨기는 코드 분석

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

## 이벤트 기록

편집기에 캡처 단계[^capture] 리스너를 등록하고, 드래그하는 동안 발생하는 이벤트를 모두 기록했다. 열은 시각(ms), 이벤트, 대상 요소, 마우스 y 좌표다.

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

마지막 이동 단계에서 소제목(H2)으로 넘어가며 `dragenter`·`dragleave`는 발생했지만 `dragover`가 없다. 로그 전체를 다시 확인하자 **요소 경계를 넘는 이동 단계마다 `dragover`가 누락되어 있었다.** Playwright가 Chromium에 전달하는 드래그 입력에서는 경계를 넘는 단계에 `dragover`가 발생하지 않는다. 사람이 드래그할 때는 다음 `dragover`가 곧바로 이어지므로 문제가 없지만, 시험은 그 위치에서 마우스를 멈추고 표시선을 측정한다.

![마지막 걸음에서 dragover가 오지 않을 때](./images/drag-events.svg '경계를 넘는 이동 단계에는 dragover가 없다. 마지막 단계가 경계를 넘으면 30ms 뒤 표시선이 사라진다')

마지막 단계가 경계를 넘는지는 좌표에 따라 결정된다. 글자 크기, 이미지 높이, 글 내용이 조금만 달라져도 결과가 바뀐다. 그래서 실행 환경에 따라 통과와 실패가 엇갈렸다.

## 첫 수정 후에도 실패

마지막에 마우스를 1px 더 움직여 `dragover`를 한 번 더 발생시켰다. 그래도 실패했다. 다시 기록하자 이번에는 마지막 줄이 다음과 같았다.

```text
6630 dragover  DIV  690
6631 dragleave DIV  706   ← 편집기 밖
```

y가 706인데 메모 창은 700에서 끝난다. **소제목이 창 밖에 있었다.** 측정한 소제목 위치는 472였는데, 측정 이후 위쪽 이미지의 로드가 끝나 높이가 확정되면서 소제목이 아래로 밀렸다(레이아웃 이동). 마우스가 창 밖으로 나가면 편집기를 벗어난 것으로 판단해 표시선을 숨긴다. 첫 번째 원인만 수정해서는 해결되지 않는 이유였다.

![위치를 측정한 뒤 밀린 소제목](./images/flaky-drag-e2e-layout-shift.svg '이미지 높이가 확정되기 전에 측정한 좌표로 드래그하면 목표가 창 밖으로 밀려 있다')

## 고려한 방법

수정 전에 다음 방법을 비교했다.

| 방법                                                                  | 장점                    | 선택하지 않은 이유                                                                                  |
| --------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| 재시도 횟수를 늘린다                                                  | 설정 한 줄              | 조건이 맞으면 매번 실패하므로 재시도해도 결과가 같다                                                |
| 표시선 검사를 삭제한다                                                | 더 이상 실패하지 않는다 | 표시선 기능이 고장 나도 검출할 수 없다. 이 기능의 목적이 그 표시선이다                              |
| 숨기기 지연(30ms)을 늘리도록 라이브러리를 수정한다                    | 시험 코드는 그대로      | 실제 사용자와 무관한 문제로 라이브러리 동작을 바꾸게 되고, 창 밖으로 벗어나는 두 번째 원인은 남는다 |
| **로드 완료를 기다리고, 창 안으로 스크롤하고, 1px 한 번 더 이동한다** | 두 원인을 모두 제거     | 시험 코드가 몇 줄 늘어난다                                                                          |

마지막 방법을 선택했다. 시험이 실제 사용자의 드래그와 같은 조건을 재현하는 것이 목적에 맞기 때문이다.

## 두 원인을 함께 수정

```ts
// 이미지를 다 불러온 뒤(크기가 정해진 뒤) 창 맨 위로 올려, 이미지와 놓을 자리가 모두 창 안에 오게 한다
await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
await figure.evaluate((element) => element.scrollIntoView({ block: 'start' }));
// …자리를 재고 끈다
await page.mouse.move(target.x + 40, target.y + 2, { steps: 12 });
// 마지막 걸음이 경계를 넘었을 수 있으니 제자리에서 dragover를 한 번 더
await page.mouse.move(target.x + 41, target.y + 3);
```

| 원칙                                          | 이유                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| **좌표는 레이아웃이 확정된 뒤에 측정한다**    | 이미지 로드 전에 측정한 좌표는 로드 후 틀린 좌표가 된다                     |
| **대상을 창 안으로 스크롤한다**               | 창 크기와 글 길이에 의존하지 않는다                                         |
| **실제 브라우저처럼 `dragover`를 발생시킨다** | 표시선 유지 조건은 라이브러리가 정한 것이고, 시험이 그 조건을 충족해야 한다 |

로컬에서 6회 연속 실행해 모두 통과했고, CI도 통과했다. 현재도 같은 시험이 `toBeVisible()` 다음에 표시선 높이가 4px 이하인지, 표시선의 y가 소제목 위치에서 40px 이내인지, 마우스를 놓으면 표시선이 사라지는지 확인한다.

## CI 시간 초과로 인한 취소

같은 수정을 다른 PR에 적용했다. 이번엔 실패가 아니라 **취소(cancelled)**가 떴다. CI 상태가 실패가 아니라 취소로 표시되었다는 뜻이다. 원인은 시험이 아니라 실행 시간이었다. CI 제한 시간이 15분인데 실행마다 13~15분이 걸렸다. 그중 Playwright용 시스템 패키지(글꼴, 그래픽 라이브러리) 설치에만 약 4분이 걸려, 러너가 느린 날에는 제한을 넘었다. 제한 시간을 25분으로 늘리고, 그 값의 근거를 설정 파일 주석에 기록했다([#48](https://github.com/hyeoniverse/MacFolio/pull/48)에 포함). 이후 시험이 510개로 늘자 25분에도 도달하기 시작해, 화면 E2E를 별도 작업으로 분리하고 샤드로 나눠 병렬 실행했다. 그 과정은 [Playwright 샤드 6개와 git 트리 비교로 머지에서 배포까지 15분을 5분으로 줄이기](/memo/faster-e2e-ci)에 있다.

## 정리

- 불안정한 시험은 "가끔 실패"하는 것이 아니라 **특정 조건에서 반드시 실패한다.** 그 조건을 찾으면 수정할 수 있다. 이번에는 이벤트 로그 기록으로 조건을 특정했다
- 코드를 변경하지 않은 PR이 실패하면 `main`에서도 실행한다. 기존 문제인지 먼저 판별해야 관계없는 코드를 수정하지 않는다
- 화면 좌표를 측정하는 시험은 측정 시각이 값만큼 중요하다. 이미지·웹 글꼴처럼 크기가 늦게 확정되는 요소가 위에 있으면, 로드 완료를 기다린 뒤 측정한다
- Playwright의 드래그는 사람의 드래그와 이벤트 순서가 다를 수 있다. 라이브러리가 의존하는 이벤트를 먼저 확인하면 시험이 충족해야 할 조건을 알 수 있다
- 남은 과제: 다른 드래그 시험에도 같은 "1px 추가 이동"을 적용할지는 검토하지 않았다. 현재는 실패하지 않아 그대로 두었다

## 직접 확인하기

불안정한 시험은 한 번 통과로는 수정 여부를 판단할 수 없다. 같은 시험을 반복 실행한다.

```bash
cd apps/react
npx playwright test e2e/memo-editor.spec.ts --project=desktop-chromium --repeat-each=20
npx playwright test e2e/memo-editor.spec.ts --trace=on      # 실패하면
npx playwright show-trace test-results/…/trace.zip          # 이벤트·화면을 한 단계씩
```

이 글처럼 이벤트 순서를 확인하려면 시험 안에서 `page.on('console', …)`로 페이지의 콘솔 로그를 수신해 출력한다. trace와 반복 실행은 [Playwright Trace viewer](https://playwright.dev/docs/trace-viewer)와 [CLI 문서](https://playwright.dev/docs/test-cli)에 있다.

## 관련 글

- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)
- [Playwright와 E2E 가짜 API로 블로그 스크린샷 찍기](/memo/screenshots-with-playwright)
- [Playwright 샤드 6개와 git 트리 비교로 머지에서 배포까지 15분을 5분으로 줄이기](/memo/faster-e2e-ci)
- [리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그](/memo/bugs-found-by-tests)
- [가끔 실패하는 시험이 찾아 준 버그 - 아직 없는 편집기로 옮긴 초점](/memo/lazy-editor-focus)

[^flaky]: 코드 변경 없이 실행마다 통과와 실패가 바뀌는 시험. 대부분 타이밍, 레이아웃, 외부 상태 같은 숨은 조건에 의존한다.

[^capture]: DOM 이벤트는 루트에서 대상으로 내려가는 캡처 단계와 대상에서 루트로 올라가는 버블 단계를 거친다. `addEventListener(type, fn, { capture: true })`로 등록하면 하위 요소의 리스너보다 먼저 호출된다. [MDN: addEventListener](https://developer.mozilla.org/ko/docs/Web/API/EventTarget/addEventListener)

#MacFolio #테스트 #Playwright #트러블슈팅
