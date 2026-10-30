---
title: /health 응답 시간과 DB 상태를 막대 수로 환산하는 서버 상태 표시
date: 2026-10-05
category: 개발 기록/MacFolio/UI·인터랙션
series: 메뉴 막대
seriesOrder: 2
summary: 장식이던 메뉴 막대의 Wi-Fi 아이콘을 이 사이트 API 서버의 상태 표시로 바꿨다. /health를 30초마다 호출해 응답 시간과 DB 상태를 막대 수로 표시한다. 메뉴가 화면 끝에서 잘리던 문제와 음량 창 위치가 어긋나던 문제도 함께 수정했다.
---

메뉴 막대 오른쪽의 Wi-Fi 아이콘은 macOS 외형을 재현하기 위한 장식이었다. 서버를 배포한 뒤에는 서버 동작 여부를 확인하려면 `/health`를 직접 열어야 했다. 그래서 Wi-Fi 막대가 **이 사이트 서버(API)의 상태**를 표시하게 했다([#90](https://github.com/hyeoniverse/MacFolio/pull/90)).

## 채택한 방법과 제외한 방법

| 방법                                        | 장점                                    | 단점                                                              |
| ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| 외부 상태 페이지(업타임 서비스)로 링크      | 기록과 그래프가 이미 있다               | 방문자가 사이트를 떠나야 하고, 현재 브라우저 기준의 상태가 아니다 |
| 앱마다 실패 시에만 "서버 오류" 표시         | 추가 요청이 없다                        | 사용하기 전에는 서버 상태를 알 수 없다                            |
| 메뉴 막대에서 `/health`를 주기적으로 (채택) | 사이트 어디서든 보이고, macOS 외형 유지 | 30초마다 요청이 하나씩 발생한다                                   |

`/health`는 이미 있었다. 서버가 DB에 `SELECT 1`을 실행해 성공하면 `status`·`database`·`version`을, 실패하면 [503](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503)과 "DB에 연결할 수 없습니다."를 반환한다. 프론트엔드 로딩 화면이 서버를 미리 기동(웜업)하는 데 쓰던 경로라, 같은 경로를 주기적으로 호출하기만 하면 됐다.

```ts
// apps/api/src/health/health.controller.ts
async check(): Promise<HealthResponse> {
	try {
		await this.prisma.$queryRaw`SELECT 1`;
	} catch {
		throw new ServiceUnavailableException('DB에 연결할 수 없습니다.');
	}
	return { status: 'ok', database: 'up', version: this.config.version };
}
```

## 막대 수의 의미

| 막대        | 상태                  | 기준                                                        |
| ----------- | --------------------- | ----------------------------------------------------------- |
| 셋          | 정상                  | 300ms보다 빠르게 응답                                       |
| 둘          | 정상                  | 1초 안에 응답                                               |
| 하나        | 응답 느림             | 1초보다 오래 걸림                                           |
| 하나 (주황) | DB 연결 안 됨         | 서버는 응답하지만 `/health`가 503과 DB 메시지를 돌려줌      |
| 없음 + 사선 | 서버에 연결할 수 없음 | 응답이 없거나 다른 오류 (터널이 서버에 닿지 못하면 502·530) |

![Wi-Fi 막대 수와 색으로 나타내는 서버 상태 다섯 가지와 확인 주기](./images/server-status-wifi-bars.svg '막대 수는 응답 시간, 주황은 DB, 사선은 연결할 수 없음')

막대를 누르면 macOS Wi-Fi 메뉴처럼 상태, 응답 시간, 마지막 확인 시각, 서버 주소가 표시되고, '지금 확인'과 'API 문서 열기' 항목이 있다.

![정상, DB 연결 안 됨, 서버에 연결할 수 없음의 세 메뉴](./images/server-status-wifi-menus.jpg '가짜 API로 세 상태를 만들어 찍었다. 막대 색과 사선, 메뉴 폭이 다르다')

막대 수는 작은 순수 함수가 결정한다.

```ts
// apps/react/src/shared/server/serverStatus.ts
export const SLOW_MS = 1000;
export const FAST_MS = 300;

export function barsOf({ state, latency }: Pick<ServerStatus, 'state' | 'latency'>): number {
	if (state === 'online') return latency !== null && latency < FAST_MS ? 3 : 2;
	if (state === 'slow' || state === 'database') return 1;
	return 0;
}
```

## 확인 주기

| 시점                                                                                                                                                                                                                        | 동작                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 상태를 표시하는 동안 30초마다                                                                                                                                                                                               | 확인. 탭이 숨겨져 있으면 건너뜀                  |
| 탭이 다시 보일 때([`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)), 인터넷 복구 시([`online`](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event)) | 즉시 확인                                        |
| 인터넷 끊김(`offline`)                                                                                                                                                                                                      | 서버에 요청하지 않고 '인터넷 연결 없음'으로 전환 |
| 메뉴를 열 때                                                                                                                                                                                                                | 한 번 더 확인해 최신 상태 표시                   |

- 요청은 한 번에 하나만 보낸다. 확인 중에 다시 호출하면 진행 중인 요청의 결과를 함께 기다린다.
- 6초(`TIMEOUT_MS`) 안에 응답이 없으면 요청을 중단한다.

메뉴 막대와 휴대폰 상태 표시줄이 같은 상태를 구독한다. 구독하는 화면이 몇 개든 타이머는 하나만 동작한다. 구독자 수를 집계해 첫 구독자가 생길 때 타이머를 등록하고, 마지막 구독자가 사라질 때 해제한다.

![감시하는 화면 수와 관계없이 타이머는 하나](./images/server-status-wifi-polling.svg 'watchers 집계가 0에서 1이 될 때만 타이머와 이벤트를 등록하고, checkServer는 진행 중인 요청을 공유한다')

결과를 상태로 분류하는 부분은 순수 함수로 분리해 단위 시험으로 확인했다. 화면 시험은 가짜 API의 `/health`를 정상 → DB 오류 → 연결 끊김 → 복구로 바꿔 가며 막대 수와 메뉴 텍스트를 확인한다.

## 메뉴가 화면 끝에서 잘린 문제

Wi-Fi 메뉴는 화면 오른쪽 끝에서 열린다. 메뉴는 열 때 크기를 측정해 화면 안쪽으로 위치를 보정하는데, 이 메뉴는 열면서 서버를 다시 확인한다. '정상'이던 텍스트가 '서버에 연결할 수 없음'으로 길어지면, 이미 정한 위치에서 폭이 줄어 텍스트가 줄바꿈되고 끝이 잘렸다. 처음 측정한 폭은 188px, 전체 폭은 252px였다.

공통 메뉴가 [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)로 자기 크기를 감시하다가 커지면 위치를 다시 보정하게 했다.

```ts
// apps/react/src/shared/ui/menu/Menu.tsx
const resize = new ResizeObserver(place);
resize.observe(menu);
return () => resize.disconnect();
```

위 캡처의 세 메뉴도 폭이 다르다. 오른쪽의 '서버에 연결할 수 없음'이 가장 넓다. 크기는 [`getBoundingClientRect`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) 대신 [`offsetWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth)로 측정한다.

| API                       | `transform: scale()` 반영      | 소수점                |
| ------------------------- | ------------------------------ | --------------------- |
| `getBoundingClientRect()` | 반영 (애니메이션 중 작게 측정) | 유지                  |
| `offsetWidth`             | 미반영 (레이아웃 크기)         | 반올림 (252.25 → 252) |

메뉴 등장 애니메이션(scale) 중에 측정하면 실제보다 작게 측정되므로 `offsetWidth`를 쓰고, 반올림으로 잘리는 폭을 보완하기 위해 1px를 더한다. Apple 메뉴, 컨텍스트 메뉴처럼 같은 메뉴 컴포넌트를 쓰는 곳이 모두 함께 수정됐다.

## 음량 창 위치가 어긋난 문제

Wi-Fi 위치의 아이콘을 바꾸자 음량 창이 음량 아이콘에서 벗어난 위치에 열렸다. 음량 창의 위치가 CSS에 `right: 8.5rem`으로 고정되어 있어서, 오른쪽 아이콘의 폭이 바뀌면 어긋나는 구조였다. 처음에는 클릭 시 아이콘 위치를 측정해 전달하도록 수정했는데, 고정 숫자 대신 측정값을 넣었을 뿐 구조는 그대로였다.

| 기존 구조                                                 | 문제                                   |
| --------------------------------------------------------- | -------------------------------------- |
| 메뉴 막대(StatusBar)가 음량 창의 열림 상태를 보유         | 메뉴 막대가 음량 창의 세부 사항에 의존 |
| 음량 아이콘이 버튼이 아닌 `<i onClick>`                   | 키보드로 열 수 없음                    |
| 바깥 클릭 시 닫기 위해 화면 전체를 투명한 오버레이로 덮음 | 다른 요소의 클릭을 가로챔              |

메뉴 막대는 넘치는 영역을 잘라 내므로(`overflow: hidden`) 음량 창을 아이콘 안에 두고 CSS만으로 표시할 수 없다. 그래서 Apple 메뉴·서버 상태처럼 **버튼과 팝오버를 함께 가진 메뉴 막대 항목**(`VolumeMenu`)으로 바꿨다. 팝오버는 body에 렌더링하고, 위치는 다른 팝오버와 같은 공통 함수(`placeBelow`)로, 닫기는 공통 `useDismiss`(바깥 클릭, Esc)로 처리한다. 메뉴 막대는 이제 `<VolumeMenu />` 한 줄만 포함한다.

같은 PR에서 메뉴 막대 글자 굵기도 macOS에 맞췄다. 막대 전체가 굵게(700) 지정되어 있던 것을 보통 굵기로 바꾸고, 맨 앞 앱 이름(Finder)만 굵게 유지한다.

## macOS에서만 실패하던 타입 검사

작업 중 타입 검사가 macOS에서만 실패했다. GitHub 앱이 `GithubActivity.tsx`(화면)와 `githubActivity.ts`(데이터)를 함께 사용하는데, 두 파일 이름이 대소문자만 다르다.

| 환경              | 파일 시스템     | `'@/apps/github/GithubActivity'` 해석 결과 |
| ----------------- | --------------- | ------------------------------------------ |
| Linux (CI)        | 대소문자 구분   | `GithubActivity.tsx` (의도한 화면 파일)    |
| macOS (기본 APFS) | 대소문자 비구분 | `githubActivity.ts` (`.ts`를 먼저 탐색)    |

화면 파일 이름을 `GithubContributions.tsx`로 바꿔 해결했다.

## 확인

- 단위(`shared/server/serverStatus.test.ts`): 응답 코드·응답 시간·DB 상태로 상태 분류, 막대 수, `checkServer`가 `/health` 응답을 상태로 저장하는지
- E2E(`e2e/server-status.spec.ts`): 정상이면 막대가 채워지고 메뉴에 상태·응답 시간·주소가 표시되는지, 'API 문서 열기'가 사이트 안의 API 문서 앱으로 열리는지, 가짜 API의 `/health`를 DB 오류 → 연결 끊김 → 복구로 바꿔 가며 막대와 텍스트가 바뀌는지
- 위 캡처는 미리보기 빌드에 가짜 API를 연결해 세 상태를 차례로 만들어 캡처했다

## 남은 것과 배운 것

- **현재 브라우저 기준의 상태다.** 방문자의 네트워크가 느리면 서버가 정상이어도 '응답 느림'으로 표시된다. 서버 중단 알림은 별도의 업타임 모니터링이 담당한다([GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)).
- **PR 미리보기에서는 항상 "연결할 수 없음"이었다.** 서버가 미리보기 주소를 [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)로 허용하지 않았기 때문이다. 이후 글에서 '이 주소에서는 쓸 수 없음' 상태로 구분했다([no-cors 요청으로 CORS 차단과 서버 중지 구분하기](/memo/server-status-blocked-origin)).
- **고정 위치는 인접 요소가 바뀌면 어긋난다.** 음량 창의 `right: 8.5rem`처럼 인접 요소의 폭에 의존하는 숫자는, 인접 요소가 바뀌는 시각에 버그가 된다. 팝오버는 기준 요소를 측정해 배치하는 공통 함수 하나로 통합하는 편이 낫다.
- **대소문자만 다른 파일 이름은 만들지 않는다.** CI(Linux)에서는 통과하고 macOS에서만 실패한다.

## 관련 글

- [Always Free 유휴 회수 기준을 충전량으로 환산한 메뉴 막대 배터리](/memo/battery-server-resources)
- [no-cors 요청으로 CORS 차단과 서버 중지 구분하기](/memo/server-status-blocked-origin)
- [GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)
- [placement·useDismiss·Menu 세 모듈로 중복된 메뉴 구현 합치기](/memo/shared-menu)

#MacFolio #데스크톱 #메뉴막대 #서버
