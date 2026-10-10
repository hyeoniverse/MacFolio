---
title: 글과 README가 스크립트가 되지 않는다는 것을 시험으로 고정하기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 메모 글, GitHub README, Finder 문서는 Markdown과 HTML을 그린다. 위험한 링크와 스크립트를 막는 설정은 이미 있었지만 그것을 확인하는 시험이 없었다. 설정을 바꾸면 깨지는 시험을 더했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목에 "HTML을 직접 넣는 곳 점검"과 "Markdown 링크의 `javascript:` 주소 막기"가 있었다. 코드를 하나씩 확인해 보니 막는 설정은 이미 다 있었다.

| 그리는 곳                  | 내용의 출처            | 막는 방법                                                        |
| -------------------------- | ---------------------- | ---------------------------------------------------------------- |
| 메모 글                    | 관리자가 쓴 글(서버)   | react-markdown은 HTML을 그리지 않고, 위험한 주소의 링크를 지운다 |
| GitHub README              | GitHub                 | HTML은 그리되 rehype-sanitize가 스크립트·이벤트 속성을 지운다    |
| Finder 문서                | 이 저장소의 문서 파일  | README와 같다                                                    |
| Finder 문서의 Mermaid 도식 | 이 저장소의 문서 파일  | Mermaid `securityLevel: 'strict'`가 라벨의 HTML을 거른다         |
| GitHub 홈페이지·웹사이트   | GitHub API             | `safeUrl`이 `http(s)`가 아닌 주소를 버린다 (시험 있음)           |
| 사진 캡션의 링크           | 관리자가 쓴 캡션(서버) | `captionParts`가 `http(s)`가 아닌 주소를 버린다 (시험 있음)      |

문제는 위 네 줄에 시험이 없었다는 것이다. 이번에는 바깥 내용이 가장 많이 들어오는 메모 글과 README에 시험을 더했다(Finder 문서와 Mermaid 도식은 이 저장소의 파일이라 뒤로 미뤘다). 예를 들어 메모 글에서 HTML(`<div align="center">`)을 쓰고 싶어서 `rehype-raw`를 더하면, 그 순간 글에 넣은 `<img onerror>`가 실행된다. 지금은 안전하지만 나중에 바꾸는 사람(나)이 이것을 모르고 바꿀 수 있다.

## 용어

- **XSS(크로스 사이트 스크립팅)**: 공격자가 넣은 스크립트가 다른 사람의 브라우저에서 이 사이트의 이름으로 실행되는 것. 관리자 브라우저에서 실행되면 관리자 권한으로 글을 지울 수 있다
- **`javascript:` 주소**: 링크를 누르면 주소 대신 뒤의 코드가 실행된다. `<a href="javascript:...">`
- **이벤트 속성**: `onerror`, `onclick`처럼 어떤 일이 일어날 때 코드를 실행하는 HTML 속성. `<img src="없는주소" onerror="...">`는 그림을 못 불러오는 순간 실행된다
- **sanitize**: HTML에서 허용 목록에 없는 태그와 속성을 지우는 것

## 시험

같은 공격 목록을 두 곳에 넣고, 그린 결과에 `<script>`, `<iframe>`, `on…` 속성, `javascript:`·`vbscript:`·`data:` 주소가 하나도 없는지 본다.

```text
[링크](javascript:alert(1))
[링크](JaVaScRiPt:alert(1))      ← 대소문자를 섞어 거르는 규칙을 피하려는 것
[링크](data:text/html,<script>…)
<script>…</script>
<img src="x" onerror="…">
<a href="javascript:alert(1)">링크</a>
<iframe src="https://evil.example">
```

- **README**: 단위 시험으로 `GithubReadme`를 HTML 문자열로 그려 본다. 안전한 HTML(`<p align="center"><b>…</b></p>`)은 남아야 한다
- **메모 글**: 메모 글은 사이트 안 링크를 여는 데 앱 상태가 필요해서 E2E로 본다. 가짜 서버에 이 본문의 글을 넣고 열어서 DOM을 직접 센다. 실제로 실행되었는지도 `window.__pwned`로 확인한다

시험이 제 역할을 하는지 보려고 일부러 막는 설정을 빼 봤다. README에서 `rehypeSanitize`를 빼면 단위 시험이, 메모에 `rehype-raw`를 더하고 주소 거르기를 끄면 E2E가 실패했다.

#MacFolio #보안 #XSS #Markdown #테스트
