---
title: 서로 import하는 파일 둘을 풀고, 다시 생기면 CI가 막게
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: madge로 재 보니 순환 의존이 둘 있었다. 메일의 데스크톱·휴대폰 화면이 서로를 import했고, 앱 목록(registry)과 Finder가 서로를 읽었다. 공통 타입은 셋째 파일(model.ts)로, 창 앱 이름 목록은 manifest로 옮겨 풀고, pnpm cycles를 CI에 넣어 다시 생기면 실패하게 했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "폴더 구조와 의존"의 첫 PR. 순환 의존을 끊고, CI에서 막는다.

## 용어

- **순환 의존(circular dependency)**: A가 B를 import하고 B가 A를 import하는 것. 둘이 서로를 필요로 해서 어느 쪽을 먼저 읽어야 하는지가 정해지지 않는다
- **madge**: import 그래프를 그려 순환을 찾아 주는 도구. `--circular`만 켜면 순환이 있을 때 1로 끝나 CI 검사로 쓸 수 있다

## 왜 문제인가

자바스크립트 모듈은 위에서 아래로 한 줄씩 실행된다. a.ts를 읽다가 b.ts를 만나 그쪽으로 들어갔는데, b.ts가 다시 a.ts의 값을 쓰려 하면 그 값은 아직 만들어지기 전이라 `undefined`다. 타입만 가져올 때는 실행 시 사라져서 괜찮지만, 상수나 함수를 가져오면 "어제는 됐는데 import 순서를 바꾸니 깨진다"가 된다.

![순환 의존이 undefined를 만드는 순서](./images/break-import-cycles-init-order.svg 'a.ts를 읽다 b.ts로 들어갔는데, b.ts가 아직 만들어지지 않은 a.ts의 값을 쓴다')

실행이 되더라도 두 가지가 더 나쁘다. 파일 구조는 "이 파일은 저 파일 위에 쌓여 있다"는 층을 말해 줘야 하는데, 서로 의존하면 층이 사라져 둘 중 하나만 떼어 시험하거나 옮길 수 없다. 그리고 Finder처럼 처음 열 때 불러오는(lazy) 파일이 자기를 불러온 쪽을 다시 읽으면, 번들러가 둘을 떼어 놓지 못한다.

## 재 보니 둘

```
1) apps/registry.ts > apps/finder/Finder.tsx
2) apps/mail/Mail.tsx > apps/mail/components/MailMobile.tsx
```

API는 Prisma가 생성한 코드끼리만 순환이라(우리 코드가 아니다) `generated/`를 빼고 보면 없고, `desktop-core`는 없었다.

## 메일: 공통 타입은 셋째 파일로

`Mail.tsx`(데스크톱)가 휴대폰 화면 `MailMobile.tsx`를 그리고, `MailMobile.tsx`는 `Mail.tsx`에서 `ListMail`·`Mailbox` 타입을 가져왔다. 타입만 가져오는 것이라 실행에는 문제가 없었지만, 그래프로는 순환이다. 같은 이름표(`MAILBOX_LABEL`)도 두 파일에 따로 적혀 있었다.

둘이 함께 쓰는 것(`Mailbox`, `ListMail`, `MAILBOX_LABEL`)을 `mail/model.ts`로 옮기고 양쪽이 거기서 가져온다. 규칙으로 적어 두면: **두 화면이 같은 타입을 쓰면 둘 중 하나가 아니라 셋째 파일에 둔다.**

![메일 앱의 순환 의존: 전과 후](./images/break-import-cycles-mail.svg '전에는 두 파일이 서로를, 후에는 둘 다 model.ts를 본다')

## Finder: 이름 목록은 manifest로

`registry.ts`는 앱 이름 → 컴포넌트 표이고, Finder를 `lazy()`로 불러온다. 그런데 Finder는 "창으로 열리는 앱 목록"을 보여 주려고 `registry.ts`의 `WINDOW_APPS`를 다시 읽었다. lazy라 실제로는 돌아갔지만, Finder가 필요한 것은 컴포넌트가 아니라 **이름**뿐이다.

![registry와 Finder의 순환: 전과 후](./images/break-import-cycles-registry.svg 'Finder가 registry의 컴포넌트 표를 다시 읽던 것을, manifest의 이름 목록을 읽게')

이름은 React를 모르는 `manifest.ts`가 이미 다 갖고 있다. 거기에 `WINDOW_APP_NAMES`(action이 없는 앱, 즉 창으로 열리는 앱)를 두고, Finder는 그것을 읽는다. `registry.ts`도 같은 목록에서 컴포넌트를 찾되, 목록에 있는데 컴포넌트가 없으면 조용히 빠지는 대신 바로 에러를 내게 바꿨다. 전에는 `flatMap`으로 빠져서 앱을 추가하고 컴포넌트 연결을 잊으면 Dock에 아이콘만 있고 창이 안 열리는 채로 지나갈 수 있었다.

## CI

루트에 `pnpm cycles`를 두고(`apps/react`, `apps/api`(generated 제외), `packages/desktop-core` 셋), `check` 작업의 린트 다음에 넣었다. 순환이 하나라도 생기면 PR이 빨개진다.

#MacFolio #리팩터링 #madge #순환의존
