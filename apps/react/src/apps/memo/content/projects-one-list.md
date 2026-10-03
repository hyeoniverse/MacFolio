---
title: 프로젝트 목록은 한 곳에 - MacFolio를 프로젝트로 더하며
date: 2026-10-03
category: 개발기/MacFolio
summary: 이 사이트(MacFolio)를 프로젝트로 넣으려다 보니, 프로젝트 목록이 GitHub 앱에만 따로 적혀 있었다. GitHub 앱의 스냅샷이 Safari·Finder와 같은 목록을 읽게 바꾸고, MacFolio는 그 목록에 한 번만 더했다.
---

GitHub 앱의 고정 저장소에 MacFolio를 넣었더니, Safari 탭에도 Finder의 프로젝트 폴더에도 MacFolio가 없었다. 같은 프로젝트 이야기인데 한쪽에만 생긴 것이다.

![Safari와 GitHub 앱](./images/projects-one-list.jpg '왼쪽: Safari의 MacFolio 페이지 / 오른쪽: 같은 목록에서 만든 GitHub 앱의 고정 저장소')

## 목록이 두 개였다

프로젝트 정보는 `shared/profile.ts`의 `PROJECTS`에 모여 있다. Safari 탭, Finder의 프로젝트 폴더, 터미널의 `projects` 명령이 모두 이 목록을 읽는다. 그런데 GitHub 앱의 스냅샷(서버에 닿지 않을 때 보여 주는 값)은 이 목록을 읽지 않고, 저장소 이름과 설명을 따로 적어 두고 있었다. 처음에는 GitHub 화면을 그대로 옮겨 적은 값이라 따로 두는 게 맞아 보였지만, 결국 같은 프로젝트를 두 군데에 적은 셈이었다.

그래서 스냅샷의 고정 저장소를 `PROJECTS`에서 만들게 했다. 프로젝트의 GitHub 주소에서 `owner/이름`을 나누고, 설명은 프로젝트 소개 한 줄, 홈페이지는 데모 주소를 쓴다. 이제 프로젝트를 더하거나 빼는 곳은 `PROJECTS` 한 곳이고, 순서도 모든 화면에서 같다.

이 약속이 깨지지 않게 시험도 하나 두었다. 스냅샷의 저장소 주소 목록이 `PROJECTS`의 주소 목록과 같은 순서로 같아야 통과한다.

## 따로 두는 것도 있다

서버가 GitHub에서 받아 보여 주는 고정 저장소는 관리자가 시스템 설정에서 고른다. 이것은 화면 코드가 아니라 서버 DB에 저장되는 값이라 `PROJECTS`와 묶지 않았다. 묶으면 배포 없이 저장소를 바꾸는 기능이 사라진다. 스냅샷은 서버를 못 쓸 때의 대비책이니 코드 안의 목록을 따르고, 실제 화면은 관리자가 고른 값을 따른다.

## MacFolio 페이지

Safari의 프로젝트 페이지는 프로젝트마다 모양(look)이 다르다. 뉴스레터는 신문, 게임은 게임 화면처럼 꾸몄다. MacFolio는 macOS를 흉내 낸 사이트라서, 따로 꾸미지 않은 Apple 제품 페이지 모양(`product`)을 그대로 쓴다. 아이콘은 노을 진 바탕화면 위에 창 하나와 Dock을 올린 그림으로 새로 그렸다.

페이지에는 이 사이트의 기술 사양과 함께 서버 쪽 이야기(GitHub OAuth 관리자 로그인, 포트를 열지 않는 Cloudflare Tunnel, 시험을 통과해야 배포)를 실었다. 자세한 내용은 [MacFolio 백엔드 한 장으로 보기](/memo/backend-design)에 있다.
