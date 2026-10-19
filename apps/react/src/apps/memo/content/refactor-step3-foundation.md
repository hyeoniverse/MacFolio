---
title: 리팩터링 3단계 — 공통 기반 코드
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 계획 3단계를 돌아본다. 서버 요청, 브라우저 저장소, 화면 크기·matchMedia 질문을 파일마다 따로 하던 것을 shared/api/client.ts, shared/lib/storage.ts, shared/lib/media.ts 세 모듈로 모았다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 3단계는 앱마다 되풀이하던 기반 코드 세 가지를 한 곳으로 모으는 일이었다.

## 왜

- 서버 요청: 12개 파일이 각자 `fetch`를 쓰고 `credentials: 'include'`가 26곳이었다. 오류와 401 처리가 파일마다 달랐다.
- 저장소: `localStorage`를 직접 쓰는 파일이 11개였다.
- 화면 크기: `useIsMobile`·`useViewport`가 있는데도 `matchMedia`·`innerWidth`를 직접 쓰는 곳이 25곳이었다.

## 무엇을 바꿨나

| 항목                 | PR   | 글                                                       |
| -------------------- | ---- | -------------------------------------------------------- |
| 공통 API 클라이언트  | #196 | [fetch 33곳을 client.ts 하나로](/memo/shared-api-client) |
| 브라우저 저장소 모듈 | #198 | [try/catch 열두 개를 하나로](/memo/shared-storage)       |
| 화면 질문 모듈       | #199 | [matchMedia 네 가지 표기를 하나로](/memo/shared-media)   |

- `api()`는 JSON을 주고받고 실패하면 `ApiError`를 던진다. 401은 한 곳에서 받아 관리자 상태를 바로 로그아웃으로 바꾸고, 429·401 문구는 서버가 적은 이유를 먼저 쓴다.
- `STORAGE_KEYS`에 키 이름을 모으고 `readJson`·`writeJson` 등이 파싱 실패를 삼킨다. 휴지통의 '내 브라우저 데이터'도 같은 키 목록을 읽는다.
- 움직임 줄이기·어두운 화면·손가락 입력 질문은 `shared/lib/media.ts`로, 화면 크기는 `useViewport`의 `getViewport()`로 모았다.

## 전후

|                                     | 전                                      | 후                                        |
| ----------------------------------- | --------------------------------------- | ----------------------------------------- |
| 서버 요청 코드                      | 346줄                                   | 179줄, 사용처 19곳이 `api()`·`apiFetch()` |
| 저장소 코드                         | 134줄                                   | 53줄, 사용처 7곳                          |
| `matchMedia`·`innerWidth` 직접 사용 | 25곳, 네 가지 표기, 모바일 기준 두 가지 | 25곳을 `media.ts`·`getViewport()`로       |

![서버 요청 코드와 저장소 코드의 줄 수 전후 막대 그래프](./images/refactor-step3-foundation-lines.svg '기반 코드는 절반 아래로 줄고, 사용처는 한 함수를 부른다')

## 일부러 남긴 것

부르는 쪽의 응답 모양 검사는 남겼다. 저장소 모듈은 읽기·쓰기 실패만 맡고, 읽은 값이 맞는 모양인지는 쓰는 쪽이 안다.

이전 단계: [2단계 — 폴더 구조와 의존](/memo/refactor-step2-structure) · 다음 단계: [4단계 — 공통 컴포넌트 설계](/memo/refactor-step4-components)

#MacFolio #리팩터링 #React #TypeScript
