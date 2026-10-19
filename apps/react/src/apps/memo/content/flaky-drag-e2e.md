---
title: 글 한 편 추가했더니 E2E가 깨졌다 - 이미지 끌기 테스트가 흔들린 이유
date: 2026-10-01
category: 개발기/MacFolio/인프라
summary: 블로그 글에 이미지를 넣은 PR에서, 코드와 상관없는 이미지 끌기 E2E가 실패했다. 이벤트를 하나씩 찍어 보니 원인은 둘이었다. 이미지를 다 불러오기 전에 잰 자리, 그리고 마지막 걸음에 오지 않은 dragover.
---

예전 블로그 글에 스크린샷을 넣는 PR([#47](https://github.com/hyeoniverse/MacFolio/pull/47))을 올렸다. 바꾼 것은 Markdown과 이미지뿐이었는데 CI가 빨갛게 떴다. 153개 중 하나, 편집기에서 **이미지를 끌면 놓을 자리에 선이 보이는지** 보는 테스트였다. `e2e/memo-editor.spec.ts`의 "이미지: 캡션을 눌러 그 자리에서 고치고, 내려받기 버튼으로 받고, 끌 때 놓을 자리가 보인다"의 마지막 부분이다.

```text
TypeError: Cannot read properties of null (reading 'height')

  357 | await expect(indicator).toBeVisible();
  358 | const line = (await indicator.boundingBox())!;
> 359 | expect(line.height).toBeLessThanOrEqual(4);
```

`toBeVisible()`은 통과했는데 바로 다음 줄에서 `boundingBox()`가 `null`이다. 선이 **보였다가 곧바로 사라졌다**는 뜻이다. 재시도(retry)에서도 똑같이 실패해서 운이 나빴다고 넘길 수 없었다.

## 코드는 안 바꿨는데 왜

이 테스트는 "Markdown 블로그에 글쓰기 붙이기" 글을 열고, 첫 이미지를 첫 소제목 위로 끌어 본다. 그런데 이 PR에서 바로 그 글에 이미지를 하나 더 넣었다. 레이아웃이 바뀌었으니 뭔가 걸린다는 짐작은 들었지만, 새 이미지는 한참 아래에 있었다. 위쪽 첫 이미지와 첫 소제목 사이에는 달라진 게 없다.

로컬에서 돌려 보니 `main`에서도 똑같이 실패했다. 이 PR이 만든 버그가 아니라 **원래 있던 흔들리는 테스트**였고, 지난 PR이 통과한 것은 운이었다. 실제로 규칙 문서를 더한 다른 PR([#48](https://github.com/hyeoniverse/MacFolio/pull/48), 글은 하나도 안 바꾼)에서도 같은 테스트가 실패했다.

## 선을 숨기는 코드부터 읽었다

선은 Milkdown이 쓰는 `prosemirror-drop-indicator`가 그린다. 숨기는 쪽을 찾아보니 이렇게 되어 있었다.

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

`dragleave`가 오면 30ms 뒤에 숨긴다. 그 사이에 `dragover`가 한 번이라도 오면 취소된다. 요소 경계를 넘을 때마다 `dragleave`가 오지만, 실제 브라우저는 끄는 동안 `dragover`를 계속 보내서 선이 유지된다.

## 이벤트를 하나씩 찍었다

편집기에 capture로 리스너를 달고, 끄는 동안 오는 이벤트를 모두 기록했다.

```text
6750 dragover  IMG  393
6751 dragover  IMG  409
6752 dragenter SPAN 425
6752 dragleave IMG  425
6754 dragenter DIV  441
6754 dragleave SPAN 441
6755 dragover  DIV  457
6756 dragenter H2   473   ← 마지막 걸음
6756 dragleave DIV  473   ← 숨기기 예약
                          ← dragover 없음
```

마지막 걸음에서 소제목(H2)으로 넘어가며 `dragenter`·`dragleave`는 왔는데 `dragover`가 없다. 로그를 다시 보니 **경계를 넘는 걸음마다 `dragover`가 빠져 있었다.** Playwright가 Chromium에 보내는 끌기에서는 경계를 넘는 걸음에 `dragover`가 오지 않는다. 사람이 끌 때는 다음 `dragover`가 금방 따라오니 문제가 없지만, 테스트는 거기서 마우스를 멈추고 선을 잰다.

![마지막 걸음에서 dragover가 오지 않을 때](./images/drag-events.svg '경계를 넘는 걸음에는 dragover가 없다. 마지막 걸음이 그런 걸음이면 30ms 뒤 선이 사라진다')

마지막 걸음이 경계를 넘느냐는 좌표에 달렸다. 글자 크기, 이미지 높이, 글 내용이 조금만 달라져도 바뀐다. 그래서 됐다 안 됐다 했다.

## 고쳤는데 또 실패했다

마지막에 제자리에서 1px 더 움직여 `dragover`를 한 번 더 보내게 했다. 그런데 여전히 실패했다. 다시 찍어 보니 이번에는 마지막 줄이 이랬다.

```text
6630 dragover  DIV  690
6631 dragleave DIV  706   ← 편집기 밖
```

y가 706인데 메모 창은 700에서 끝난다. **소제목이 창 밖에 있었다.** 앞에서 잰 소제목 위치는 472였는데, 잰 뒤에 위의 이미지가 다 불러와지면서 높이가 생겨 소제목이 아래로 밀린 것이다. 마우스가 창 밖으로 나가니 편집기를 떠난 것으로 보고 숨긴다. 첫 번째 원인만 고쳐서는 안 되는 이유였다.

![자리를 잰 뒤 밀린 소제목](./images/flaky-drag-e2e-layout-shift.svg '이미지 높이가 정해지기 전에 잰 좌표로 끌면 목표가 창 밖으로 밀려 있다')

## 고려한 방법

고치기 전에 쉬운 길도 몇 가지 떠올렸다.

| 방법                                                                    | 좋은 점              | 버린 이유                                                                                                  |
| ----------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| 재시도 횟수를 늘린다                                                    | 한 줄이면 된다       | 조건이 맞으면 매번 실패해서, 재시도해도 같은 결과였다                                                      |
| 선을 확인하는 부분을 지운다                                             | 다시는 안 깨진다     | 끌기 표시가 사라져도 아무도 모른다. 이 기능을 만든 이유가 그 선이다                                        |
| 숨기기 지연(30ms)을 늘리게 라이브러리를 고친다                          | 테스트 코드는 그대로 | 실제 사용자와 상관없는 문제로 라이브러리 동작을 바꾸는 것이고, 창 밖으로 나간 두 번째 원인은 그대로 남는다 |
| **불러오기를 기다리고, 창 안으로 올리고, 제자리에서 한 번 더 움직인다** | 원인 둘을 다 없앤다  | 테스트가 몇 줄 길어진다                                                                                    |

마지막을 골랐다. 테스트가 실제 사람의 끌기와 같은 조건을 만들어 주는 쪽이 맞다고 봤다.

## 두 가지를 같이 고쳤다

```ts
// 이미지를 다 불러온 뒤(크기가 정해진 뒤) 창 맨 위로 올려, 이미지와 놓을 자리가 모두 창 안에 오게 한다
await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
await figure.evaluate((element) => element.scrollIntoView({ block: 'start' }));
// …자리를 재고 끈다
await page.mouse.move(target.x + 40, target.y + 2, { steps: 12 });
// 마지막 걸음이 경계를 넘었을 수 있으니 제자리에서 dragover를 한 번 더
await page.mouse.move(target.x + 41, target.y + 3);
```

- **자리는 레이아웃이 끝난 뒤에 잰다.** 이미지를 다 불러오기 전에 잰 좌표는 곧 틀린 좌표가 된다
- **움직일 대상을 창 안으로 가져온다.** 창 크기와 글 길이에 기대지 않는다
- **실제 브라우저처럼 `dragover`가 오게 한다.** 선이 유지되는 조건은 앱이 정한 것이고, 테스트가 그 조건을 채워 줘야 한다

로컬에서 여섯 번 연달아 돌려 모두 통과했고, CI에서도 초록이 됐다. 지금도 같은 시험이 `toBeVisible()` 다음에 선의 높이가 4px 이하인지, 선의 y가 소제목 위치에서 40px 안인지 확인하고, 마우스를 놓으면 선이 사라지는지까지 본다.

## CI가 이번엔 취소됐다

같은 수정을 다른 PR에 옮겨 넣고 기다렸더니, 이번엔 실패가 아니라 **취소(cancelled)**가 떴다. 테스트가 아니라 시간이었다. CI 제한 시간이 15분인데 한 번에 13~15분이 걸리고 있었다. 그중 Playwright용 시스템 패키지(글꼴, 그래픽 라이브러리)를 받는 데만 4분 안팎이 걸려서, 조금만 느린 날이면 선을 넘는다. 제한 시간을 25분으로 늘리고, 왜 그 숫자인지 설정 파일에 적어 두었다(#48에 함께 들어갔다). 뒤에 시험이 510개로 늘자 25분에도 걸리기 시작해서, 화면 E2E를 따로 떼어 여러 조각으로 나눠 동시에 돌렸다. 그 이야기는 [E2E를 빠르게](/memo/faster-e2e-ci)에 있다.

## 남은 것

- 흔들리는 테스트는 "가끔 실패한다"가 아니라 **조건에 따라 반드시 실패한다.** 그 조건을 찾으면 고칠 수 있다. 이번에는 이벤트 로그 한 번이 추측 열 번보다 빨랐다
- 코드를 안 바꾼 PR이 실패하면 `main`에서도 돌려 본다. 원래 있던 문제인지부터 가려야 엉뚱한 곳을 고치지 않는다
- 화면 좌표를 재는 테스트는 "언제 쟀는가"가 값만큼 중요하다. 이미지·글꼴처럼 늦게 크기가 정해지는 것이 위에 있으면, 기다린 뒤에 잰다
- Playwright의 끌기는 사람의 끌기와 이벤트 순서가 다를 수 있다. 라이브러리가 어떤 이벤트에 기대는지 먼저 읽으면 테스트가 채워 줘야 할 조건이 보인다
- 아직 남은 것: 다른 끌기 시험에도 같은 "제자리 한 걸음"을 넣을지는 보지 않았다. 지금은 흔들리지 않아서 그대로 두었다

## 따라 해 보기

흔들리는 시험은 한 번 통과로는 고쳤는지 알 수 없다. 같은 시험을 여러 번 돌려 본다.

```bash
cd apps/react
npx playwright test e2e/memo-editor.spec.ts --project=desktop-chromium --repeat-each=20
npx playwright test e2e/memo-editor.spec.ts --trace=on      # 실패하면
npx playwright show-trace test-results/…/trace.zip          # 이벤트·화면을 한 단계씩
```

이 글에서처럼 이벤트 순서를 보려면 시험 안에서 `page.on('console', …)`로 화면의 로그를 받아 찍는다. trace와 반복 실행은 [Playwright Trace viewer](https://playwright.dev/docs/trace-viewer)와 [CLI 문서](https://playwright.dev/docs/test-cli)에 있다.

## 관련 글

- [Playwright로 휴대폰 화면과 움직임 시험](/memo/playwright-mobile-and-motion)
- [Playwright로 블로그 스크린샷 찍기](/memo/screenshots-with-playwright)
- [E2E를 6칸으로 나눠 빠르게](/memo/faster-e2e-ci)
- [시험이 찾아낸 버그들](/memo/bugs-found-by-tests)

#MacFolio #테스트 #Playwright #트러블슈팅
