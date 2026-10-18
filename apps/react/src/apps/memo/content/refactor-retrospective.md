---
title: 리팩터링 계획을 마치며 — 일곱 단계 전후
date: 2026-10-18
category: 개발기/MacFolio/회고
summary: 열흘 동안 기능을 붙이며 쌓인 중복을 정리한 리팩터링 계획(#150)을 돌아본다. 일곱 단계의 글을 잇고, 계획을 세울 때의 상태와 지금을 한 표로 비교하고, 일부러 남긴 것을 적는다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 목적은 두 가지였다. 다음 기능을 붙일 때 고칠 곳이 한 군데가 되게 하는 것, 그리고 기능마다 따로 챙긴 보안 설정을 한 기준으로 맞추는 것이다.

## 일곱 단계

1. [타입과 데이터 구조](/memo/refactor-step1-types) — 응답 타입을 `@macfolio/contracts`로, `profile.ts` 나누기, 브랜드 타입
2. [폴더 구조와 의존](/memo/refactor-step2-structure) — 이름 규칙, 순환 의존 풀기, 큰 파일 나누기
3. [공통 기반 코드](/memo/refactor-step3-foundation) — API 클라이언트, 저장소, 화면 질문
4. [공통 컴포넌트 설계](/memo/refactor-step4-components) — Modal·Sheet·SearchField, 접근성 이름, 버튼 옮기기, Menu variant
5. [스타일](/memo/refactor-step5-styles) — 디자인 토큰, `Memo.css` 나누기, 중복·미사용 CSS
6. [서버](/memo/refactor-step6-server) — 분석 서비스 나누기, 검사를 공유 스키마로
7. [보안](/memo/refactor-step7-security) — 헤더, sandbox, 요청 제한, 의존성과 CI

마무리 단계에서 ESLint 경고 185개를 정리하고 네 패키지 모두 `--max-warnings 0`을 걸었다(#144).

## 전후

| 영역          | 계획을 세울 때                                                                                | 지금                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 타입          | 화면이 응답 타입을 손으로 다시 적음, DTO 없이 서비스마다 검사                                 | 여덟 도메인과 설정·데모 검사가 contracts의 zod 스키마 하나                                                     |
| 서버 요청     | 12개 파일이 각자 `fetch`, `credentials: 'include'` 26곳                                       | `shared/api/client.ts` 하나, 401 처리 한 곳                                                                    |
| 데이터        | `shared/profile.ts` 1,629줄                                                                   | 프로젝트마다 한 파일                                                                                           |
| 큰 파일       | `CreativeDemos.tsx` 1,861줄, `CreativeCms.tsx` 970줄 등                                       | 데모·도식마다 한 파일                                                                                          |
| 의존          | `Mail.tsx` ↔ `MailMobile.tsx` 순환                                                            | 순환 0, CI가 막음                                                                                              |
| 공통 UI       | `<button>` 앱 파일 53개 중 공통 버튼 15개, 시트·모달 각자                                     | 버튼 75곳 옮김, `Sheet`·`Modal`·`SearchField`                                                                  |
| 스타일        | `z-index` 23가지, `Memo.css` 4,166줄                                                          | 토큰 여섯 갈래(`--z-*`·`--radius-*`·`--text-*`·`--space-*`·`--shadow-*`·`--color-*`), `Memo.css`는 열다섯 파일 |
| 반응형·저장소 | `matchMedia`·`innerWidth` 직접 25곳, `localStorage` 직접 11개 파일                            | `media.ts`·`useViewport`, `storage.ts`                                                                         |
| 린트          | ESLint 경고 185개                                                                             | 0개, `--max-warnings 0`                                                                                        |
| 보안          | 사이트 헤더 없음, iframe sandbox 없음, 요청 제한 세 갈래, 취약점 6건(high 3), Dependabot 없음 | CSP와 헤더, sandbox, `@RateLimit` 한 방식, 취약점 6건 고침, Dependabot·gitleaks·액션 SHA 고정                  |

## 돌아보며

- **먼저 세었다.** 공통 부품 후보 아홉은 세어 보니 셋이었고, 쓰지 않는 CSS 클래스는 처음 150개에서 9개가 되었다. 계획에 적은 숫자를 그대로 믿지 않은 것이 일을 줄였다.
- **같은지 확인했다.** 1~6단계는 동작을 바꾸지 않는 것이 규칙이었다. 빌드한 CSS를 바이트로, 화면을 계산된 스타일로 비교해 "그대로"를 증명했다.
- **보안은 따로 냈다.** 동작이 바뀌는 PR은 리팩터링과 섞지 않아서, 거절되는 요청이 생겨도 원인을 바로 알 수 있었다.

## 일부러 남긴 것

- 공통 부품 후보 여섯(`ListRow`, `SegmentedControl`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`)은 보류했다.
- 앱 CSS의 hex 색 225곳과 프로젝트 페이지의 브랜드 색은 이름을 붙이지 않았다.
- 같은 뜻의 `z-index` 값 합치기, `Memo.tsx` 나누기는 하지 않았다.

#MacFolio #리팩터링 #회고
