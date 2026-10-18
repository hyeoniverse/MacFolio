---
title: 리팩터링 2단계 — 폴더 구조와 의존
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 계획 2단계를 돌아본다. 앱 안의 파일은 폴더 대신 이름 규칙으로 맞추고, 순환 의존 둘을 풀어 CI가 다시 막게 하고, 1,861줄 데모 파일을 비롯한 큰 파일들을 조각으로 나눴다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 2단계는 파일이 어디에 있고 무엇을 import하는지를 정리하는 일이었다.

## 왜

- `Mail.tsx`와 `MailMobile.tsx`가 서로를 import했다.
- 큰 파일이 여럿이었다: `CreativeDemos.tsx` 1,861줄, `CreativeCms.tsx` 970줄, `Memo.tsx` 830줄, `FolderSidebar.tsx` 675줄, `PhotosMobile.tsx` 662줄.
- 앱 폴더마다 파일을 두는 방식이 달랐다.

## 무엇을 바꿨나

| 항목                                   | PR   | 글                                                                                 |
| -------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| 순환 의존 풀기와 `pnpm cycles`         | #188 | [서로 import하는 파일 둘을 풀고, 다시 생기면 CI가 막게](/memo/break-import-cycles) |
| `CreativeDemos.tsx` 나누기             | #189 | [1,861줄짜리 데모 파일을 데모마다 한 파일로](/memo/split-creative-demos)           |
| `FolderSidebar.tsx`·`PhotosMobile.tsx` | #190 | [폴더 사이드바와 휴대폰 사진 앱을 조각으로](/memo/split-sidebar-photos)            |
| 앱 안의 파일 이름 규칙                 | #191 | [폴더 대신 이름으로](/memo/app-file-naming)                                        |
| `CreativeCms.tsx` 나누기               | #193 | (데모 글의 끝에서 함께 다룸)                                                       |

순환은 둘이었다. 메일의 공통 타입·함수는 셋째 파일 `mail/model.ts`로, registry↔Finder는 `manifest.ts`의 `WINDOW_APP_NAMES`로 풀었다. 루트의 `pnpm cycles`(madge, react·api·desktop-core)가 `check`에 들어가 다시 생기면 CI가 실패한다.

파일 규칙은 폴더 대신 이름으로 정했다. 서버 호출은 `*Api.ts`, 순수 계산은 `model.ts`, 훅은 `use*.ts`, 화면 조각은 `PascalCase.tsx`이고, 셋 이상이면 `components/`로 묶는다. 어긋난 파일 아홉 개의 이름을 맞췄다.

## 전후

|                         | 전      | 후                                 |
| ----------------------- | ------- | ---------------------------------- |
| 순환 의존               | 2개     | 0개, CI가 막음                     |
| `CreativeDemos.tsx`     | 1,861줄 | `creative/`에 데모마다 한 파일     |
| `CreativeCms.tsx`       | 970줄   | `creative/cms/`에 도식마다 한 파일 |
| 이름 규칙에 어긋난 파일 | 9개     | 0개                                |

## 일부러 남긴 것

`Memo.tsx`(830줄)는 이미 `useMemoLibrary`·`useNoteView`·`useNoteDrag`·`useTrash` 같은 훅으로 나뉘어 있어서 손대지 않았다. 대신 4,166줄이던 `Memo.css`는 5단계에서 나눴다.

이전 단계: [1단계 — 타입과 데이터 구조](/memo/refactor-step1-types) · 다음 단계: [3단계 — 공통 기반 코드](/memo/refactor-step3-foundation)

#MacFolio #리팩터링 #의존성 #React
