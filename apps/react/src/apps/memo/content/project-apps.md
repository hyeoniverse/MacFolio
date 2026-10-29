---
title: PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입
date: 2026-10-03
category: 개발 기록/MacFolio/프론트엔드
summary: 새싹 농장만 창 안에서 실행할 수 있던 것을 HYEONIVERSE·NewPick·WTD·QRU까지 확장했다. 다섯 앱이 ProjectApp 컴포넌트 하나를 공유하고, 앱 목록은 PROJECTS의 app 필드에서 생성하며, Dock에 고정하되 창이 좁으면 프로젝트 앱부터 Launchpad로 넘긴다.
---

포트폴리오 프로젝트 가운데 배포한 사이트가 있는 것은 HYEONIVERSE, NewPick, QRU, WTD, 새싹 농장 다섯 개다. 그런데 이 사이트 안에서 바로 실행할 수 있는 것은 새싹 농장 게임뿐이었다. 나머지는 Safari 프로젝트 페이지에서 "새 탭에서 열기"를 눌러 사이트 밖으로 이동해야 했다.

![프로젝트 앱 창](./images/project-apps.jpg '배포한 사이트를 창 안에 띄운다. 실행 중이면 Dock 끝에 아이콘이 나타난다')

10월 3일 밤, 데스크톱 화면을 실제 Mac처럼 구성하는 작업 중에 배포한 사이트가 있는 프로젝트마다 [iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)으로 사이트를 표시하는 앱을 만들기로 했다. 다음 날 [#87](https://github.com/hyeoniverse/MacFolio/pull/87)을 정리하면서 앱 목록을 별도로 작성하지 않고 `PROJECTS`를 읽도록 변경했다. 프로젝트 앱의 Dock 고정도 Projects 목록에 있으면 자동으로 적용되어야 한다고 보고, 실제로 그렇게 동작하는지 확인했다.

## 표시 방식 비교

| 방법                                         | 장점                              | 단점                                                                                                       |
| -------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 링크로 새 탭에서 연다 (기존)                 | 추가 구현이 없다                  | 사이트 밖으로 이동해 포트폴리오 탐색 흐름이 끊긴다                                                         |
| 화면 녹화·캡처로 보여 준다                   | 외부 사이트가 중단돼도 표시된다   | 직접 조작할 수 없다                                                                                        |
| 배포한 사이트를 창 안 iframe으로 표시 (채택) | 사이트 안에서 바로 조작할 수 있다 | 외부 사이트가 iframe 삽입을 차단하면 빈 화면이 된다. 외부 페이지가 이 사이트를 조작하지 못하게 막아야 한다 |

## 컴포넌트 하나로 다섯 앱

새싹 농장 앱은 배포한 게임 주소를 iframe으로 표시하는 창이었다. 다른 프로젝트도 동작은 같다. 그래서 이 창을 `ProjectApp`으로 일반화하고 프로젝트 id만 전달하도록 했다.

처음에는 앱마다 한 줄씩 작성했다.

```tsx
export const NewPick = () => <ProjectApp appName="newpick" projectId="newpick" />;
```

그런데 주소, 이름, 아이콘은 이미 프로젝트 정보(`shared/profile.ts`의 `PROJECTS`)에 있고, Safari 탭·Finder·터미널·GitHub 앱도 모두 그 목록을 읽는다. 앱 목록만 별도로 관리하면 프로젝트를 추가할 때 누락되기 쉽다. 그래서 프로젝트에 `app` 필드(Dock·Launchpad에 표시할 이름, 아이콘, 창 크기, 게임 여부)를 추가하고, 앱 목록(`apps/manifest.ts`)이 데모 주소와 `app`이 있는 프로젝트를 읽어 앱을 생성하도록 했다. 새 프로젝트를 배포하면 그 프로젝트에 `app`만 작성하면 Dock, 터미널 `open`, Safari의 "여기서 열기"에 모두 반영된다.

![앱 목록은 PROJECTS에서 생성된다](./images/project-apps-source.svg 'PROJECTS → PROJECT_APPS → Dock·Launchpad·터미널·Safari, 창은 ProjectApp')

앱 이름은 타입으로 고정한 목록(`'safari' | 'memo' | …`)이었다. 프로젝트 앱 이름은 런타임에 결정되므로, 프로젝트 id 문자열에 표시를 붙인 브랜드 타입(`ProjectAppName`)[^brand]으로 정의했다.

```ts
declare const projectApp: unique symbol;
export type ProjectAppName = string & { readonly [projectApp]: true };
export type AppName = BuiltinAppName | ProjectAppName;

export const projectAppName = (id: string): ProjectAppName | null =>
	PROJECT_APPS.some((project) => project.id === id) ? (id as ProjectAppName) : null;
```

내장 앱 이름은 기존처럼 컴파일 시점에 오타를 검출하고, 프로젝트 앱은 `projectAppName(id)`를 거쳐야만 앱 이름이 된다. 이 사이트 자체인 MacFolio와 데모가 없는 DevCourse는 앱이 아니다.

`ProjectApp`의 역할은 세 가지다.

1. **창을 맨 앞으로 가져오기**: iframe 안을 클릭하면 클릭 이벤트가 바깥 문서로 전달되지 않는다. 대신 바깥 문서가 포커스를 잃고 [`blur`](https://developer.mozilla.org/en-US/docs/Web/API/Window/blur_event) 이벤트가 발생하므로, 그 시각에 포커스가 이 iframe으로 이동했으면 창을 맨 앞으로 올린다. 새싹 농장에서 쓰던 방식을 그대로 옮겼다.

   ```ts
   const onBlur = () => {
   	if (document.activeElement === frame.current) bringAppToFront(appName);
   };
   window.addEventListener('blur', onBlur);
   ```

2. **로딩 화면**: 사이트가 표시되기 전에는 프로젝트 아이콘과 "불러오는 중"을 표시한다. 게임은 검은 배경, 웹 서비스는 흰 배경이다.
3. **로드 실패 처리**: 외부 사이트가 다른 사이트 안에 삽입되는 것을 차단하면([`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)), iframe에는 빈 화면만 남는다. 바깥 문서에서는 그 원인을 읽을 수 없으므로, 8초(`SLOW_MS = 8000`)가 지나도 로드가 끝나지 않으면 "새 탭에서 열기" 링크를 표시한다.

## Dock에 고정하기

앱이 다섯 개 늘면 Dock 아이콘은 16개가 된다. 이 사이트의 Dock은 화면 폭에 들어가지 않는 앱을 Launchpad로 넘긴다(아이콘 하나에 100px, 양옆 여백 300px).

처음에는 macOS의 "Dock에 유지하지 않은 앱"처럼 새 앱을 Dock에 고정하지 않고 Launchpad에 배치했다가, 실행 중일 때만 Dock 끝에 표시했다. 그런데 프로젝트 앱은 이 사이트의 핵심 콘텐츠이므로 눈에 잘 띄는 Dock에 배치하는 편이 적합하다고 판단했다. 그래서 `PROJECTS`에서 앱이 된 프로젝트는 기본적으로 Dock에 고정한다. 제외할 프로젝트만 `app.inDock`을 `false`로 지정한다.

![창 폭에 따라 Dock에 들어가는 앱](./images/project-apps-dock-capacity.svg '1600px이면 13칸이라 프로젝트 앱은 둘까지, 1920px이면 16칸이라 다섯 모두')

처음에는 프로젝트 앱을 메일 다음에 배치했더니, 1600px 창에서도 공유·터미널·시스템 설정이 Launchpad로 넘어가 E2E 시험 20개가 실패했다. Dock에서 시스템 설정을 여는 시험들이다. 사용자도 마찬가지로 자주 쓰는 앱이 Dock에서 사라지면 찾기 어렵다. 그래서 프로젝트 앱을 시스템 설정 다음에 배치해, 창이 좁으면 프로젝트 앱이 먼저 Launchpad로 넘어가게 했다.

| 창 폭  | Dock 칸 수 | Dock에 들어가는 프로젝트 앱 | Launchpad로 넘어가는 프로젝트 앱 |
| ------ | ---------- | --------------------------- | -------------------------------- |
| 1600px | 13         | HYEONIVERSE, NewPick        | QRU, WTD, 새싹 농장              |
| 1920px | 16         | 다섯 개 모두                | 없음                             |

또한 고정하지 않은 앱뿐 아니라 칸이 부족해 Launchpad로 넘어간 앱도, 실행 중이면 Dock 끝에 아이콘과 실행 표시 점을 표시한다. Launchpad에서 QRU를 열면 QRU가 Dock 끝에 나타나고, 닫으면 사라진다.

Safari 프로젝트 페이지에는 "여기서 열기" 버튼을 배치하고, 데모 링크는 "새 탭에서 열기"로 그 옆에 둔다. 게임인 새싹 농장만 "여기서 플레이"다.

![Dock에 고정한 프로젝트 앱](./images/project-apps-launchpad.jpg '위: 1920px 창 (다섯 개가 모두 Dock에) / 아래: 1600px 창 (HYEONIVERSE와 NewPick까지, 나머지는 Launchpad)')

## 아이콘 배경 타일

프로젝트 아이콘은 투명 배경의 로고였다. Safari 탭에서는 문제가 없었지만, Dock과 Launchpad에서는 다른 앱 아이콘과 달리 배경 없이 로고만 표시되어 형태가 일정하지 않았다. 그래서 앱 아이콘을 별도로 제작했다. Dock의 다른 아이콘처럼 입체감이 나도록 세 레이어를 겹쳤다.

| 레이어                   | 처리                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| 세로 그라데이션 타일     | 위는 밝고 아래로 갈수록 어둡다. 색은 로고별로 지정: NewPick 푸른 회색, WTD 따뜻한 미색, QRU 옅은 청록 |
| 가장자리 하이라이트·음영 | 맨 위 몇 픽셀은 더 밝게, 맨 아래 띠는 약간 어둡게 처리해 볼록한 형태를 표현                           |
| 로고 그림자              | 로고를 약간 위로 올리고, 그 아래에 블러 처리한 그림자를 배치                                          |

Safari 탭에서는 원래 로고를 그대로 사용한다. HYEONIVERSE는 프로젝트 아이콘(`icon.svg`)에 이미 그라데이션과 그림자가 있었지만, Dock에서는 별의 윤곽이 뭉개지고 흐리게 보였다. 별을 수치 없이 근사한 곡선으로 작성했기 때문이다. 원본 사이트의 로고를 측정하니 별의 네 변은 바깥 네 모서리를 중심으로 한 반지름 143.5px의 사분원이고, 점은 (358.5, 149.5)에 반지름 21px이었다. 이 치수대로 호 명령(`A`) 네 개로 다시 작성하고, Dock에서는 다른 앱처럼 512px PNG(`app-icon.png`)를 사용한다. Dock 아이콘은 포인터를 올리면 확대되는데, SVG를 그대로 쓰면 확대 시 흐리게 보였다.

## 확인

- `apps/react/e2e/project-apps.spec.ts`: "Dock에 고정되어 있고, 열면 배포한 사이트를 창 안에 띄운다", "Dock에 다 들어가지 않아 Launchpad로 간 앱도 실행 중에는 Dock 끝에 나타난다", "Safari 프로젝트 페이지의 '여기서 열기'로 그 앱을 연다". 외부 사이트에 실제로 요청하지 않도록 [`page.route`](https://playwright.dev/docs/network)로 배포 주소의 응답을 가짜 HTML로 대체한다.
- 앱 구현은 [#87](https://github.com/hyeoniverse/MacFolio/pull/87), Dock 고정과 넘친 앱 표시는 [#91](https://github.com/hyeoniverse/MacFolio/pull/91)로 나누어 병합했다.

## 이후 변경

- 엿새 뒤 iframe에 [`sandbox`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox) 속성을 적용했다(`4e0604324`). 내부 사이트의 `target="_top"` 링크가 이 사이트 자체를 다른 주소로 이동시킬 수 있었기 때문이다. `allow-scripts`·`allow-same-origin`은 허용하고 `allow-top-navigation`은 허용하지 않는다. 시험 "안에 띄운 사이트의 링크가 이 사이트를 다른 주소로 바꾸지 못한다"가 가짜 페이지의 링크를 클릭한 뒤 주소가 유지되는지 확인한다. 자세한 내용은 [보안 점검 3 - iframe sandbox에서 allow-top-navigation을 빼 최상위 창 이동 막기](/memo/iframe-sandbox)에 정리했다.
- `ProjectApp`의 iframe 부분은 API 문서 앱과 공유하는 `shared/ui/web-frame/WebFrame.tsx`로 옮겼다.
- 프로젝트와 프로젝트 앱은 이후 시스템 설정에서 코드 수정 없이 추가·수정할 수 있게 되었다([사이트 편집 2 - 코드 기본값 위에 서버의 덮어쓸 값만 합치는 프로젝트 편집](/memo/site-projects-editing)). 서버에는 덮어쓸 값만 저장하고, 새 앱의 주소는 CSP에도 추가한다.

## 남은 것·배운 것

- 외부 사이트가 `X-Frame-Options`나 CSP [`frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors)로 삽입을 차단하면, 8초 뒤 "새 탭에서 열기"를 표시하는 것 외에 대응할 방법이 없다. iframe 내부의 실패 원인은 바깥 문서에서 읽을 수 없다.
- 앱 목록을 프로젝트 목록에서 생성하니 프로젝트를 추가할 때 수정할 위치가 한 곳으로 줄었다. 대신 앱 이름이 런타임에 결정되므로, 브랜드 타입(`ProjectAppName`)으로 내장 앱 이름의 오타 검사를 유지했다.
- Dock 순서를 바꿀 때는 시험이 Dock에서 어떤 앱을 클릭하는지까지 확인해야 했다. 시험이 실패한 지점이 곧 사용자가 앱을 찾지 못할 지점이었다.

## 관련 글

- [보안 점검 3 - iframe sandbox에서 allow-top-navigation을 빼 최상위 창 이동 막기](/memo/iframe-sandbox)
- [절대 위치 대신 내용 폭 한 줄 flex로 겹치지 않는 Dock 배치](/memo/dock-layout)
- [별도 목록 없이 프로젝트 데이터를 순회해 생성하는 사진 앨범](/memo/photos-app)
- [모듈 구조 5 - index.ts 재내보내기로 import 경로를 유지하며 큰 모듈을 폴더로 나누기](/memo/profile-split)
- [PROJECTS 단일 원본으로 GitHub 스냅샷과 프로젝트 목록 합치기](/memo/projects-one-list)

[^brand]: 브랜드 타입(branded type)은 `string` 같은 기본 타입에 실행 시점에는 존재하지 않는 표시 속성을 교차 타입으로 붙여, 검사 함수를 거친 값만 그 타입으로 인정하게 하는 TypeScript 기법이다. 이 저장소의 `PostSlug`·`FolderPath`도 같은 방식이다.

#MacFolio #프로젝트앱 #Dock
