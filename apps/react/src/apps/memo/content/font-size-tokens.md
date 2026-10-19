---
title: 글자 크기에 이름 붙이기 — Apple 글자 스타일 이름을 빌려 645곳을 여덟 이름으로
date: 2026-10-16
category: 개발기/MacFolio/프론트엔드
summary: CSS의 font-size 958곳 중 자주 쓰는 여덟 값(11·12·13·15·16·17·20·22px)에 Apple HIG의 글자 스타일 이름(caption2·caption·footnote·subhead·callout·body·title3·title2)을 붙이고, 그 값을 그대로 쓰던 645곳을 이름으로 바꿨다. 값은 그대로라 화면은 바뀌지 않는다.
---

z-index, 모서리 둥글기에 이어 글자 크기에도 이름을 붙였다.

## 세어 보기

`src` 아래 CSS에서 `font-size`는 958곳이었다. 자주 나온 값은 이렇다.

| 값   | 곳  |
| ---- | --- |
| 12px | 156 |
| 13px | 130 |
| 15px | 99  |
| 11px | 88  |
| 14px | 85  |
| 17px | 60  |
| 16px | 57  |
| 20px | 39  |
| 18px | 32  |
| 22px | 15  |

MacFolio는 macOS와 iOS 화면을 흉내 내는 사이트라, 이 값들은 대부분 Apple이 정한 글자 크기에서 왔다. 그래서 숫자보다 Apple의 이름이 더 많은 것을 알려 준다.

## Apple HIG의 글자 스타일

HIG(Human Interface Guidelines)는 Apple이 앱 화면을 만드는 방법을 적어 둔 안내서다. 여기에는 글자 쓰임새마다 이름과 크기가 정해져 있다. iOS 기준으로 본문(Body)은 17pt, 보조 문구(Footnote)는 13pt, 가장 작은 설명(Caption 2)은 11pt다.

| 이름              | 크기 | 쓰임                                 |
| ----------------- | ---- | ------------------------------------ |
| `--text-caption2` | 11px | 가장 작은 설명, 배지                 |
| `--text-caption`  | 12px | 날짜, 작은 설명                      |
| `--text-footnote` | 13px | 보조 문구 (macOS 앱에서는 본문 크기) |
| `--text-subhead`  | 15px | 휴대폰 목록의 둘째 줄                |
| `--text-callout`  | 16px | 강조한 설명                          |
| `--text-body`     | 17px | 휴대폰 본문                          |
| `--text-title3`   | 20px | 작은 제목                            |
| `--text-title2`   | 22px | 중간 제목                            |

`styles/theme.css`에 이 여덟 이름을 두고, 45개 CSS 파일에서 `font-size`에 이 값 하나만 적힌 645곳을 `var(--text-*)`로 바꿨다. 값은 그대로라 글자 크기는 1px도 달라지지 않는다.

![여덟 글자 크기 이름과 실제 크기](./images/font-size-tokens-scale.svg '이름마다 실제 크기와, 바꾸기 전 그 값이 나온 곳 수')

## 이름을 붙이지 않은 값

- **14px(85곳)·18px(32곳)**: HIG에 딱 맞는 이름이 없다. 대부분 데스크톱 앱에서 눈대중으로 고른 크기라, 둘 중 가까운 이름으로 합칠지는 화면을 보며 하나씩 정한다.
- **em·rem**: 부모 글자 크기를 따라가라는 뜻이라 고정된 이름으로 바꾸면 안 된다.
- **10px 이하·26px 이상**: 쓰는 곳이 적고 앱마다 모양이 달라 그대로 두었다.

이름이 붙으니 "이 날짜 글자가 왜 12px이지?"라는 질문에 "caption이라서"라고 답할 수 있게 되었다.

#MacFolio #CSS #리팩터링
