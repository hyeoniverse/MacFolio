# 콘텐츠 라이선스 (Content License)

[LICENSE](LICENSE)의 MIT 라이선스는 이 저장소의 **소스 코드**에만 적용된다. 아래 경로의 콘텐츠에는 MIT 라이선스가 적용되지 않는다.

The MIT License in [LICENSE](LICENSE) covers the **source code** only. It does not apply to the content listed below.

## 작성자 콘텐츠 (Author's content)

© 2024-2026 Kim Jeong Hyeon. All rights reserved. 작성자의 사전 허락 없이 복제·수정·배포·재게시할 수 없다. 글의 일부를 출처(글 주소)와 함께 인용하는 것은 허용한다.

All rights reserved. Do not copy, modify, redistribute or republish without prior permission. Short quotations with a link to the original post are allowed.

| 경로                                                                                                                | 내용                                          |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `apps/react/src/apps/memo/content/`                                                                                 | 블로그 글(Markdown)과 `images/`의 캡처·도식   |
| `apps/react/src/shared/profile/`의 `resume.md`, `resume.en.md`와 `profile.ts`, `skills.ts`, `projects/`의 글 데이터 | 이력서, 프로필, 기술 목록, 프로젝트 설명 문구 |
| `apps/react/public/imgs/me.png`                                                                                     | 프로필 사진                                   |
| `apps/react/public/imgs/projects/`                                                                                  | 프로젝트 아이콘·화면 캡처·스프라이트          |
| `apps/react/public/imgs/tips/`                                                                                      | 팁 앱의 화면 캡처                             |
| `apps/react/public/og-image.jpg`                                                                                    | 공유 미리보기 이미지                          |
| `docs/` (본문과 `images/`)                                                                                          | 설계·운영 문서와 도식                         |
| `pr-screenshots/`                                                                                                   | PR 본문에 첨부한 캡처와 도식                  |

## 제3자 자산 (Third-party assets)

아래 파일의 권리는 각 권리자에게 있다. 이 저장소의 MIT 라이선스와 작성자 콘텐츠 조건 어느 쪽도 적용되지 않는다. macOS·iOS 화면을 재현하기 위해 포함했으며, 이 저장소를 사용하는 사람은 각 권리자의 조건을 직접 확인해야 한다.

Rights to the files below belong to their respective owners. Neither the MIT License nor the author's content terms apply to them.

| 경로                                                                                                             | 내용                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/react/public/musics/` (`1.mp3`\~`7.mp3`)                                                                   | 음악 앱의 곡: Joe Hisaishi, Youmi Kimura, Yiruma, dai, Kaoru Wada의 곡 (`apps/react/src/apps/music/library.ts`)                            |
| `apps/react/public/imgs/Album_*.png`, `Album_*.webp`                                                             | 위 곡의 앨범 아트                                                                                                                          |
| `apps/react/public/imgs/wallpapers/`                                                                             | macOS·iOS 배경화면 (Big Sur, Sequoia, Sonoma, Tahoe, iOS 18 등)                                                                            |
| `apps/react/public/sounds/`                                                                                      | Mac 시동음(`mac-startup.mp3`)과 클릭 효과음                                                                                                |
| `apps/react/public/imgs/`의 앱 아이콘 PNG·WebP (`finder`, `safari`, `photos`, `messages`, `github`, `notion` 등) | macOS 앱 아이콘과 외부 서비스의 로고·상표                                                                                                  |
| `apps/react/src/apps/memo/content/images/vscode-extensions-web-*.jpg`                                            | VS Code 확장 보기의 상세 화면 캡처. 화면 속 확장 아이콘·이름·설명·README 내용은 각 확장 게시자의 것이고, VS Code 화면은 Microsoft의 것이다 |

## 오픈 라이선스 글꼴 (Open-licensed fonts)

사이트 글꼴은 모두 [SIL Open Font License 1.1](https://openfontlicense.org)로 배포되는 글꼴이다. 이 조건에 따라 웹 글꼴로 함께 배포하며, 각 글꼴의 저작권과 라이선스 전문은 원본에 있다. 이 저장소의 MIT 라이선스나 작성자 콘텐츠 조건은 적용되지 않는다.

All site fonts are distributed under the SIL Open Font License 1.1. Neither the MIT License nor the author's content terms apply to them.

| 글꼴                   | 쓰는 곳                                             | 파일                                                                                               | 저작권·라이선스                                                              |
| ---------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Pretendard (가변·정적) | 본문 전체, PDF 이력서, 공유 카드                    | npm `pretendard` (빌드가 `assets/`에 내보냄), `apps/react/public/fonts/Pretendard-*.otf`, `*.woff` | © 2021 Kil Hyung-jin, OFL 1.1 (`apps/react/public/fonts/Pretendard-OFL.txt`) |
| JetBrains Mono (가변)  | 코드·고정폭                                         | npm `@fontsource-variable/jetbrains-mono`                                                          | OFL 1.1 (패키지의 `LICENSE`)                                                 |
| Noto Serif KR (가변)   | 따옴표 등 serif 기호, Safari 프로젝트 페이지의 명조 | npm `@fontsource-variable/noto-serif-kr`                                                           | OFL 1.1 (패키지의 `LICENSE`)                                                 |
