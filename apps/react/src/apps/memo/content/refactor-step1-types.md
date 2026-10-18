---
title: 리팩터링 1단계 — 타입과 데이터 구조
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 계획 1단계를 돌아본다. API 응답 타입을 화면과 서버가 각자 적던 것을 @macfolio/contracts의 zod 스키마 하나로 모으고, 1,629줄 profile.ts를 폴더로 나누고, 글 주소와 폴더 경로에 브랜드 타입을 붙였다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 1단계는 "같은 모양을 두 번 적지 않기"였다. 이 글은 단계 전체를 요약하고, 자세한 내용은 PR마다 쓴 글로 넘긴다.

## 왜

계획을 세울 때의 상태는 이랬다.

- 화면이 API 응답 타입을 손으로 다시 적었다 (예: `commentsApi.ts`의 `Comment`).
- API는 전역 `ValidationPipe`(whitelist)를 켜 두었지만 DTO 클래스가 없어 실제로 걸러지는 값이 없었고, 서비스마다 직접 검사했다.
- `shared/profile.ts` 한 파일 1,629줄에 프로필·기술·`PROJECTS`·타입이 함께 있었다.

## 무엇을 바꿨나

| 항목                               | PR   | 글                                                        |
| ---------------------------------- | ---- | --------------------------------------------------------- |
| `packages/contracts`와 댓글·좋아요 | #200 | [응답 타입을 두 번 적지 않기](/memo/contracts-comments)   |
| 글                                 | #201 | [글 도메인 옮기기](/memo/contracts-posts)                 |
| 메시지                             | #202 | [메시지 도메인 옮기기](/memo/contracts-messages)          |
| 연락 메일                          | #203 | [연락 메일의 검사 규칙을 하나로](/memo/contracts-contact) |
| 배경화면                           | #204 | [배경화면 도메인 옮기기](/memo/contracts-wallpapers)      |
| 파일                               | #205 | [올린 파일 규칙을 둘로 나누기](/memo/contracts-files)     |
| 분석                               | #206 | [분석 이벤트의 모양을 하나로](/memo/contracts-analytics)  |
| 사이트 프로필                      | #207 | [사이트 프로필로 1단계 마무리](/memo/contracts-site)      |
| `profile.ts` 나누기                | #208 | [1,629줄 한 파일을 폴더로](/memo/profile-split)           |
| 브랜드 타입                        | #209 | [PostSlug·FolderPath 브랜드 타입](/memo/branded-ids)      |

방식은 하나다. 요청·응답의 모양은 `@macfolio/contracts`에 zod 스키마로 두고, 서버는 `parse()`로 검증하고, 화면은 `import type`으로 같은 타입을 쓴다. 타입과 순수 규칙은 `desktop-core`에 남는다. 여덟 도메인이 모두 이 자리로 옮겨 갔다.

## 전후

|                     | 전                    | 후                                                               |
| ------------------- | --------------------- | ---------------------------------------------------------------- |
| 응답 타입           | 화면·서버가 각자 적음 | 여덟 도메인이 contracts 한 곳                                    |
| `shared/profile.ts` | 1,629줄 한 파일       | 프로젝트마다 한 파일, 바깥 import 27곳은 그대로                  |
| `any`               | —                     | 0건                                                              |
| 글 주소·폴더 경로   | `string`              | `PostSlug`·`FolderPath`, `postSlug()`·`folderPath()`를 지나야 함 |

글 PR에서는 서버의 if문 스물한 줄이 스키마 하나가 됐고, 사이트 프로필에서는 if문 58줄을 zod로 옮기며 문구 열한 개와 순서를 시험으로 고정했다.

## 일부러 남긴 것

- 배경화면 올리기는 multipart라 스키마가 없고, 이름만 같은 함수를 거친다.
- 매직 바이트 확인·EXIF 지우기처럼 서버만 하는 일은 contracts로 옮기지 않았다. 기준은 "화면도 알아야 하는가"였다.
- 관리자 설정과 데모의 요청 검사는 6단계(서버)에서 같은 방식으로 옮겼다.

다음 단계: [2단계 — 폴더 구조와 의존](/memo/refactor-step2-structure). 전체 회고는 [리팩터링 회고](/memo/refactor-retrospective)에 있다.

#MacFolio #리팩터링 #TypeScript #zod
