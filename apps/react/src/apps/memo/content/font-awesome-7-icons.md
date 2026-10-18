---
title: 구조도 아이콘이 깨진 까닭 - Font Awesome 7의 글꼴 이름
date: 2026-10-19
category: 개발기/MacFolio/프론트엔드
summary: HYEONIVERSE 구조도의 아이콘이 네모로 깨졌다. Font Awesome을 7로 올리면서 글꼴 이름이 바뀌었는데, SVG 글자로 그리는 아이콘은 CSS에 6의 이름을 적어 두고 있었다.
---

Safari의 HYEONIVERSE 페이지에서 구조도(방문자 → Next.js → Supabase…)의 아이콘이 깨져 보였다.

## 원인

- 구조도는 SVG라 `<i class="fa-solid …">`를 쓸 수 없다. 아이콘 글꼴의 글자(예: 지구 `\f0ac`)를 SVG `<text>`에 넣고, CSS로 글꼴을 고른다
- 그 CSS가 `font-family: 'Font Awesome 6 Free'`였다. 패키지는 이미 Font Awesome 7(`@fortawesome/fontawesome-free` 7.x)이고, 7의 글꼴 이름은 `Font Awesome 7 Free` / `Font Awesome 7 Brands`다
- 없는 글꼴 이름이라 브라우저가 기본 글꼴로 그렸고, 그 글꼴에는 이 글자가 없어 네모가 나왔다. `<i>` 아이콘은 Font Awesome의 CSS가 이름을 정하므로 멀쩡했다

## 고친 것

- 같은 방식으로 글꼴 이름을 직접 적은 곳 다섯 곳을 모두 7로: 구조도, MacFolio 페이지, 친근한·종이 템플릿, 메모 편집기의 블록
- 글자 자리(코드 포인트)는 6과 7이 같아 그대로 쓴다

#MacFolio #CSS #FontAwesome
