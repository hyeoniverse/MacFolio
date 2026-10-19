---
title: 리팩터링 6단계 — 서버
date: 2026-10-18
category: 개발기/MacFolio/백엔드
summary: 리팩터링 계획 6단계를 돌아본다. 341줄 AnalyticsService를 저장·집계·조회 셋으로 나누고, 관리자 설정과 데모 입력 검사를 1단계의 공유 스키마로 옮겨 화면과 서버가 같은 상한을 쓰게 했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 6단계는 API 서버였다. 경로·응답·거절 문구는 그대로 두었다.

## 무엇을 바꿨나

| 항목                | PR   | 글                                                                          |
| ------------------- | ---- | --------------------------------------------------------------------------- |
| 분석 서비스 나누기  | #233 | [트래픽 분석 서비스를 저장·집계·조회 셋으로](/memo/analytics-service-split) |
| 관리자 설정 세 몸통 | #235 | [손으로 쓴 입력 검사 세 개를 공유 스키마로](/memo/settings-schemas)         |
| 데모 네 몸통        | #236 | [데모 입력 검사 네 개도 공유 스키마로](/memo/demo-input-schemas)            |

`AnalyticsService` 하나가 이벤트 저장, 지난 날 모으기·오래된 값 지우기, 요약·조회수·최근 방문 조회를 모두 맡고 있었다. 저장(`AnalyticsRecorder`), 집계(`AnalyticsRollup`), 조회(`AnalyticsStats`)로 나누었다.

![AnalyticsService 341줄이 Recorder, Rollup, Stats로 나뉜 도식](./images/refactor-step6-server-split.svg '하는 일마다 한 클래스. 조회가 가장 크다')

검사는 1단계에서 정한 방식을 따랐다. 사진 캡션·사람 확인·GitHub 앱 저장소는 `packages/contracts/src/settings.ts`로, AI 커버·번역·요약·음성 데모는 `packages/contracts/src/demos.ts`로 옮겼다. 데모의 "글 한 칸" 규칙은 `demoText` 하나다.

## 전후

|                              | 전                      | 후                                      |
| ---------------------------- | ----------------------- | --------------------------------------- |
| `AnalyticsService`           | 341줄                   | Recorder 68줄, Rollup 80줄, Stats 203줄 |
| 설정 상한(200자, 6개)·정규식 | 서버 if문과 화면에 따로 | contracts 한 곳                         |
| 데모 상한(60·200·800·80자)   | 서버 함수와 화면에 따로 | contracts 한 곳                         |
| API e2e                      | —                       | 124개 통과                              |

음성 데모의 중복 검사와 `SpeechInputError`는 스키마로 옮기며 없어졌다. 거절 문구와 400 응답은 그대로다.

이전 단계: [5단계 — 스타일](/memo/refactor-step5-styles) · 다음 단계: [7단계 — 보안](/memo/refactor-step7-security)

#MacFolio #리팩터링 #NestJS #zod
