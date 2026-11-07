---
title: 정적 사이트의 편집 권한을 useCanEditMemo 하나로 관리자에게만 열기
date: 2026-09-29
category: 개발 기록/MacFolio/구조·상태 관리
series: 메모 폴더
seriesOrder: 1
summary: 폴더 생성·드래그 이동·고정까지 구현한 뒤 모두 비활성화했다. 정적 사이트의 브라우저 코드만으로는 관리자를 판별할 수 없기 때문이다. 편집 권한은 useCanEditMemo 하나로 판단하게 했고, 다음 날 관리자 로그인이 추가되자 그 한 줄만 바꿔 다시 활성화했다.
---

MacFolio의 메모 앱은 이 블로그의 글 목록이다. 왼쪽 사이드바에 폴더가 있고, 가운데 목록에 글이 있으며, 글을 누르면 오른쪽에 본문이 열린다. 이 메모 앱에 폴더 생성, 이름 변경, 드래그 앤 드롭 이동, 글 고정을 차례로 구현했다. 처음에는 누구나 자기 브라우저에서 폴더를 정리할 수 있게 했다.

그런데 블로그의 폴더 구조와 글 순서는 작성자가 정하는 정보다. 예를 들어 "개발 기록/MacFolio/구조·상태 관리" 폴더에 어떤 글을 넣을지는 글쓴이가 결정하고, 방문자는 그 구조를 읽기만 하면 된다. 방문자가 폴더를 옮기는 기능은 필요하지 않고, 작성자가 정리한 결과는 모든 방문자에게 같은 모습으로 보여야 한다. 따라서 편집 기능은 **관리자 한 명에게만** 열려야 한다.

문제는 9월 28일의 MacFolio가 **정적 사이트**였다는 점이다. 정적 사이트는 미리 빌드한 HTML·자바스크립트·CSS 파일을 모든 방문자에게 똑같이 내려보내는 방식이다. 요청마다 코드를 실행해 "이 사람이 누구인가"를 판단하는 서버가 없다.

## 선택지 비교

관리자만 편집하게 만드는 방법은 네 가지였다.

| 방법                                                                                                  | 장점                                                   | 단점                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 누구나 자기 브라우저에서 정리한다 (기존)                                                              | 추가 구현이 없다                                       | 블로그의 폴더 구조를 방문자가 변경할 수 있다. 관리자의 정리 결과도 다른 방문자에게 보이지 않는다 |
| 브라우저에서 비밀번호를 입력받는다                                                                    | 서버가 필요 없다                                       | 비밀번호나 해시가 번들에 포함된다 (아래)                                                         |
| [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) 같은 앞단 인증 | 코드가 적다                                            | 정리 결과를 저장할 곳은 여전히 없다                                                              |
| 서버 로그인 + 서버 저장 (채택, 다음 단계)                                                             | 서버가 관리자를 판별하고 결과가 모든 방문자에게 보인다 | 백엔드가 필요하다. 그 시각까지는 비활성화한다                                                    |

세 번째 방법의 Cloudflare Access는 요청이 사이트에 도달하기 전에 Cloudflare가 로그인 여부를 확인하는 서비스다. 특정 주소(예: `/admin`)에 정책을 걸면, 허용한 이메일로 로그인한 사람만 그 주소의 파일을 받는다. 접근을 막는 데는 충분하지만, 관리자가 폴더를 옮긴 결과를 어디에 저장해 다른 방문자에게 보여 줄지는 해결하지 못한다.

## 브라우저 비밀번호 검사를 쓰지 않은 이유

가장 간단한 방법은 편집 버튼을 누르면 비밀번호를 입력받는 것이다. 하지만 정적 사이트에서 비밀번호를 검사하는 코드는 방문자 브라우저에서 실행된다. 검사하려면 정답과 비교해야 하므로, ==비밀번호나 그 해시가 자바스크립트 번들에 그대로 포함된다==. 번들은 빌드 도구(Vite)가 소스 코드를 묶어 만든 `assets/index-….js` 같은 파일이고, 모든 방문자가 같은 파일을 내려받는다.

![브라우저 비밀번호 검사의 한계](./images/read-only-memo-bundle-secret.svg '번들 안의 해시와 분기는 개발자 도구에서 누구나 확인하고 바꿀 수 있다. 통과해도 결과는 그 브라우저에만 남는다')

예를 들어 아래와 같은 검사 코드를 넣었다고 가정한다.

```ts
// 예시: 채택하지 않은 방식
const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
if ((await sha256(input)) === HASH) setCanEdit(true);
```

개발자 도구의 Sources 탭에서 번들을 열면 `HASH` 값과 `setCanEdit(true)` 분기가 그대로 보인다. 해시를 역산하지 않아도, 중단점을 걸고 조건을 건너뛰거나 콘솔에서 상태를 바꾸면 검사를 통과한다. 브라우저에서 실행되는 코드는 방문자가 마음대로 수정할 수 있으므로 보안 경계가 될 수 없다.

검사를 우회하지 못하게 만들더라도 두 번째 문제가 남는다. 편집 결과는 그 사용자 브라우저의 [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)[^storage]에만 저장된다. 관리자가 자기 노트북에서 "React" 폴더를 만들어도, 다른 방문자의 브라우저에는 그 폴더가 없다. 따라서 두 가지가 필요하다.

1. 누가 관리자인지 **서버가** 판단한다.
2. 정리한 결과를 **서버에** 저장한다.

둘 다 백엔드가 필요하다.

## 백엔드 전까지 비활성화

백엔드가 생기기 전까지는 편집 기능을 모두 끄기로 했다. 다만 기능마다 따로 끄지 않고, React hook 하나의 반환값으로 활성화 여부를 결정하게 했다. hook은 컴포넌트가 상태나 외부 값을 읽는 데 쓰는 `use`로 시작하는 함수다. 새 폴더 버튼, ••• 메뉴, 드래그 처리기가 모두 이 hook을 호출하므로, 반환값 하나가 편집 기능 전체를 제어한다. 백엔드가 추가되기 전까지 반환값은 항상 `false`다.

```ts
/**
 * 편집은 관리자만 할 수 있다. 이 사이트는 정적 파일이라 브라우저 코드만으로는 관리자를 가릴 수 없으므로
 * 백엔드의 관리자 로그인이 붙기 전까지는 늘 false다.
 */
export function useCanEditMemo(): boolean {
	return false;
}
```

화면은 이 값 하나로 분기한다.

| `useCanEditMemo()` | 새 폴더 버튼 | ••• 메뉴 | 드래그 이동 | 브라우저에 저장된 기존 폴더·순서 |
| ------------------ | ------------ | -------- | ----------- | -------------------------------- |
| `false` (방문자)   | 숨김         | 숨김     | 불가        | 읽지 않고 삭제                   |
| `true` (관리자)    | 표시         | 표시     | 가능        | (이후 서버 저장으로 대체)        |

마지막 열의 "읽지 않고 삭제"는 이전 버전에서 방문자가 자기 브라우저에 만든 폴더 구조를 정리하는 처리다. 이 값을 그대로 읽으면, 편집 기능을 꺼도 그 방문자에게는 예전에 만든 폴더가 계속 보인다.

구현한 편집 기능을 삭제하지 않은 이유는 재사용이다. 관리자 로그인이 추가되면 ==이 hook이 서버의 로그인 상태를 반환하기만 하면 된다==. 편집 E2E 시험도 삭제하지 않고 [건너뛰기(`skip`)](https://playwright.dev/docs/api/class-test#test-skip)로 표시했다. Playwright의 `test.skip()`은 시험을 목록에 남겨 두되 실행하지 않는 표시로, 결과 보고서에는 "skipped"로 집계된다. 관리자 로그인이 생기는 시각에 표시를 해제하면 같은 시험을 그대로 다시 실행할 수 있다.

![방문자가 보는 메모 앱](./images/memo-window.jpg '방문자가 보는 메모. 새 폴더 버튼과 ••• 메뉴가 없고, 글을 끌어 옮길 수 없다')

## 다음 단계

9월 28일에는 백엔드가 없었다. 백엔드에서 구현할 항목은 다음과 같았다.

1. [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)로 로그인하고, 지정한 계정만 관리자로 인정한다
2. 폴더·순서·고정 상태를 서버에 저장하고, 쓰기 요청마다 서버가 권한을 다시 확인한다
3. 같은 로그인으로 GitHub 앱에 표시할 고정 저장소도 설정에서 선택한다

OAuth는 사용자가 비밀번호를 MacFolio에 입력하지 않고, GitHub에서 로그인한 결과만 MacFolio 서버에 전달받는 인증 방식이다. 흐름은 "GitHub 로그인 화면으로 이동 → 사용자가 승인 → GitHub가 일회용 코드와 함께 MacFolio로 되돌려 보냄 → 서버가 그 코드로 GitHub 계정 정보를 조회" 순서다. 서버는 조회한 계정이 미리 지정한 관리자 계정인지만 비교하면 된다.

> [!IMPORTANT] 숨김은 안내, 차단은 서버
> 화면에서 버튼을 숨기는 것은 보안이 아니라 안내다. 실제 차단은 서버가 담당한다.

## 다음 날 다시 활성화

![잠그고 다시 열기까지](./images/read-only-memo-timeline.svg '편집 기능을 hook 하나 뒤에 둔 덕분에, 다시 열 때는 그 한 줄만 바꿨다')

9월 29일에 NestJS·Prisma API 기본 구조([#37](https://github.com/hyeoniverse/MacFolio/pull/37))와 GitHub 관리자 로그인([#38](https://github.com/hyeoniverse/MacFolio/pull/38))이 병합됐다. 같은 날 관리자 메모 편집 커밋(`0150b9be1`)에서 hook의 본문이 바뀌었다.

```ts
// apps/react/src/apps/memo/useCanEditMemo.ts
export function useCanEditMemo(): boolean {
	return useAdmin().status === 'signed-in';
}
```

`useAdmin()`은 서버의 `/auth/me` 응답으로 만든 로그인 상태를 반환한다. 관리자로 로그인한 브라우저에서는 `'signed-in'`이므로 `true`, 그 밖의 방문자는 `false`다. 정리 내용은 이제 API에 저장되고, 방문자는 관리자가 정리한 구조로 조회한다. 화면 쪽 변경은 이 한 줄과, 정리 내용을 `localStorage` 대신 API에서 읽고 쓰는 부분뿐이었다.

서버 쪽에서는 관리자 경로마다 [Guard](https://docs.nestjs.com/guards)(`AdminGuard`)가 세션 쿠키를 DB와 대조한다. NestJS의 Guard는 요청이 컨트롤러(실제 처리 함수)에 도달하기 전에 실행되어, `true`를 반환하면 요청을 통과시키고 예외를 던지면 거부하는 클래스다. `AdminGuard`는 쿠키 `macfolio_session`의 토큰을 SHA-256으로 해시해 `AdminSession` 테이블에서 찾고, 세션이 없거나 만료되었거나 지정한 GitHub 계정이 아니면 401(`관리자 로그인이 필요합니다.`)을 반환한다.

![버튼 숨김과 서버 차단](./images/read-only-memo-server-check.svg '화면의 hook은 버튼 표시만 정하고, 저장 허용 여부는 AdminGuard가 요청마다 정한다')

이 구조에서는 방문자가 개발자 도구로 hook의 반환값을 `true`로 바꿔 버튼을 표시해도 결과가 달라지지 않는다. 버튼을 눌러 보낸 `PUT /memo/organization` 요청에는 유효한 세션 쿠키가 없으므로, `AdminGuard`가 401로 거부하고 DB는 바뀌지 않는다.

## 확인

- 비활성화한 커밋(`25d435e5d`)에서 편집 E2E를 `e2e/memo.spec.ts`에서 분리해 `e2e/memo-admin.spec.ts`(162줄)로 옮기고 건너뛰기로 표시했다. 다시 활성화하면서 그 파일의 건너뛰기를 해제했다.
- 현재 `memo-admin.spec.ts`에는 "새로운 폴더를 만들고 지운다 (서버에 저장된다)", "글과 폴더를 끌어서 다른 폴더로 옮긴다", "폴더는 3단까지만 만들고 옮길 수 있다", "메모를 고정하면 맨 위 고정됨 묶음에 들어가고, 풀 수 있다", "방문자도 관리자가 정리한 대로 보지만, 편집할 수는 없다" 같은 시험이 있다.

## 남은 것·배운 것

- 구현한 기능을 삭제하지 않고 비활성화만 한 덕분에 다음 날 그대로 재사용했다. 기능을 끄면서 판단 지점을 하나(`useCanEditMemo`)로 모아 두면, 다시 켜는 작업은 그 함수의 본문 한 줄 수정으로 끝난다.
- 버튼을 숨기는 것과 요청을 차단하는 것은 다르다. 다시 활성화한 뒤에도 hook은 "버튼을 표시할지"만 결정하고, 저장 허용 여부는 서버가 요청마다 세션으로 다시 확인한다.

## 관련 글

- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)
- [메모에 태그 붙이기](/memo/memo-tags)
- [메모 잠그기 - 실수로 고치지 않게](/memo/memo-lock)

<details><summary>참고 문헌</summary>

- MDN, [Window: localStorage property](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- Cloudflare, [Access policies](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- GitHub Docs, [Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- NestJS, [Guards](https://docs.nestjs.com/guards)
- Playwright, [test.skip()](https://playwright.dev/docs/api/class-test#test-skip)

</details>

[^storage]: `localStorage`는 출처(origin)별로 브라우저에 문자열을 저장하는 Web Storage API다. 저장한 브라우저에서만 읽을 수 있고 서버로 전송되지 않는다.

#MacFolio #메모앱 #보안
