---
title: 프로젝트 앱의 iframe에 sandbox 걸기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 프로젝트 앱은 배포한 사이트를 iframe으로 띄우는데, 그 iframe에 아무 제한이 없었다. 안에 띄운 사이트의 링크 하나로 MacFolio 전체가 다른 주소로 바뀔 수 있었다. sandbox로 그 권한만 빼고, 빠뜨리면 실패하는 시험을 더했다.
---

프로젝트 앱([프로젝트를 앱으로](/memo/project-apps))은 NewPick, QRU 같은 배포한 사이트를 창 안의 iframe으로 띄운다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목을 보다가, 이 iframe에 `sandbox`가 없다는 것을 알았다.

## 무엇이 열려 있었나

`sandbox`가 없는 iframe 안의 페이지는 맨 위 창(MacFolio)을 다른 주소로 옮길 수 있다. 내가 만든 사이트들이라 일부러 그럴 일은 없지만, 그 사이트들도 바깥 라이브러리를 쓰고 언젠가 도메인이 넘어갈 수도 있다. 그러면 이 사이트를 보던 방문자가 엉뚱한 곳으로 옮겨진다.

먼저 맨 위 창을 옮기는 스크립트를 가짜 사이트에 넣고 시험을 짰는데, `sandbox`가 없어도 시험이 통과했다. Chrome은 사용자의 클릭 없이 다른 출처의 iframe이 맨 위 창을 옮기는 것을 이미 막는다. 막히지 않는 것은 **사용자가 클릭한 경우**였다. iframe 안의 `<a target="_top">`을 누르면 맨 위 창이 그 주소로 바뀐다. 시험을 이 경우로 바꾸자 `sandbox` 없이는 실패하고, 있으면 통과했다.

## 준 권한과 뺀 권한

`sandbox` 속성은 아무 값 없이 쓰면 모든 권한을 막고, 값으로 필요한 것만 하나씩 연다.

| 권한                               | 이유                                              |
| ---------------------------------- | ------------------------------------------------- |
| `allow-scripts`                    | 사이트가 동작하려면 필요하다                      |
| `allow-same-origin`                | 사이트가 자기 쿠키·저장소를 쓴다 (로그인 상태 등) |
| `allow-forms`                      | 로그인·검색 폼                                    |
| `allow-popups`, `…-escape-sandbox` | 새 탭으로 여는 링크. 새 탭은 sandbox 밖에서 연다  |
| `allow-downloads`, `allow-modals`  | 내려받기, `alert`·`confirm`                       |
| ~~`allow-top-navigation`~~         | **주지 않는다.** 맨 위 창을 옮기는 권한           |

`allow-scripts`와 `allow-same-origin`을 같이 주면, 같은 출처의 페이지는 스크립트로 자기 `sandbox`를 지울 수 있다. 하지만 프로젝트 사이트는 모두 다른 출처라 MacFolio의 DOM에 손댈 수 없어서 문제가 되지 않는다. 같은 출처인 API 문서 앱은 내 코드다.

새 탭으로 여는 링크와 게임의 전체 화면(`allow="fullscreen"`)은 그대로 된다. 안의 사이트가 바깥으로 보내고 싶으면 새 탭으로 열면 된다.

#MacFolio #보안 #iframe #sandbox
