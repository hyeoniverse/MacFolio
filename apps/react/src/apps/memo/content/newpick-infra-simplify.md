---
title: Redis와 Chromium을 걷어 내고 compose 한 번으로
date: 2026-10-19
category: 개발기/NewPick/인프라
summary: 뉴픽 api에서 주입하는 곳이 없는 Redis, 정적 페이지만 읽는데 띄우던 Chromium, 네 개였던 Prisma 인스턴스를 정리하고 docker compose up 한 번으로 뜨게 했다. 그 과정에서 기사 18%가 날짜 없이 수집되던 원인과, healthy인데 DB에 접속하지 못하던 원인을 찾았다.
---

다시 배포할 서버는 작은 서버 한 대나 무료 플랜이 목표다. 그런데 v1 api는 Redis, Chromium(puppeteer), Elasticsearch·Bull 의존성까지 끌고 있었고, 로컬에서 띄우는 방법도 정리되어 있지 않았다. 리팩토링 2단계(PR #23, 36개 파일, +1,119 / −1,856줄)에서는 쓰지 않는 것을 걷어 내고 `docker compose up` 한 번으로 api + MySQL + MongoDB가 뜨게 했다.

![api 구성 전후](./images/newpick-infra-simplify-stack.svg '빨간 줄은 삭제한 것')

## 쓰이지 않던 것

| 항목                 | 상태                                                             | 처리                                  |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| Redis                | `RedisService`를 주입하는 곳 0개                                 | 모듈과 의존성 4개 삭제                |
| Elasticsearch · Bull | 의존성만 있고 코드 없음. README에는 "BullMQ retry"               | 0단계에서 의존성 삭제, README 수정    |
| puppeteer            | 크롤러는 정적 DOM만 읽음                                         | fetch + jsdom(이미 의존성에 있음)으로 |
| Prisma 인스턴스      | 모듈 세 곳이 각자 `MysqlPrismaService`를 provider로 등록         | 전역 `PrismaModule` 하나              |
| 메모리 모니터        | 10분마다 메모리를 재고 50~90% 구간을 넘으면 Sentry로 보내는 cron | 삭제 (Sentry는 선택 사항으로 바뀜)    |

중복도 많았다. `MailService`가 세 번 등록되어 있었고, `ScheduleModule.forRoot()`가 두 번, `CategoryModule`이 provider로 등록되어 있었다. AiSummary와 Crawling 모듈은 `forwardRef`로 서로를 참조했다. 크롤링 원문을 다루는 부분을 `CrawledNewsModule`로 분리해 순환을 끊었다.

MongoDB는 크롤링 원문 전용으로 남겼다. 30일 지난 원문을 코드로 지우던 작업은 `createdAt` TTL 인덱스(2,592,000초)로 바꿨다. 지우는 일을 DB가 하므로 스케줄러가 하나 줄었다.

## 로컬에서 띄우기까지

| 문제                                                                                   | 수정                                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `.gitignore`가 `/prisma/migrations`를 제외해 새 DB에 스키마가 생기지 않음              | init migration과 카테고리 migration 커밋              |
| Dockerfile이 `dist/main`을 실행 (실제 경로는 `dist/src/main`)                          | 경로, 포트 3001, `prisma generate`, `TZ` 수정         |
| compose가 선언되지 않은 네트워크를 쓰고 env 이름이 다름(`DATABASE_URL` vs `MYSQL_URL`) | 수정                                                  |
| 쿠키 domain `.newpick.site`가 다섯 곳에 하드코딩 (도메인 만료)                         | `COOKIE_DOMAIN`, `COOKIE_SAMESITE` 환경 변수로 공통화 |
| `enableCors`와 겹치는 수동 OPTIONS 핸들러                                              | 삭제                                                  |
| 필요한 환경 변수를 알 수 없음                                                          | `.env.example` 작성, CI에 이미지 빌드 추가            |

## 트러블슈팅 1: 기사 18%가 날짜 없이 수집됐다

puppeteer를 fetch로 바꾼 뒤 첫 크롤링에서 55건 중 10건의 `publishedAt`이 null이었다. 스키마상 필수라 저장에 실패하는 값이다. 처음에는 fetch로 받은 HTML이 브라우저와 달라서라고 생각했지만, 실패하는 기사에 규칙이 없었다.

크롤러는 요청마다 User-Agent 세 개(Windows, Mac, iPhone) 중 하나를 고른다. 같은 기사를 UA별로 받아 비교하자 원인이 보였다.

| User-Agent | 날짜 요소                                                                           |
| ---------- | ----------------------------------------------------------------------------------- |
| Windows    | 첫 번째 일치 요소에 `data-date-time` 있음                                           |
| Mac        | 첫 번째 일치 요소에 `data-date-time` 있음                                           |
| iPhone     | 같은 클래스의 **날짜 속성이 없는 요소가 먼저** 나옴 → `querySelector`가 그것을 반환 |

선택자를 `[data-date-time]` 속성이 있는 요소로 좁히자 누락이 0건이 됐다. 기존 puppeteer 코드도 같은 선택자와 같은 UA 목록을 쓰고 있었으므로, v1에서도 같은 비율로 날짜가 빠졌을 가능성이 높다.

## 트러블슈팅 2: MySQL은 healthy인데 접속하지 못했다

빈 볼륨으로 처음 `docker compose up`을 하면, MySQL이 healthy가 된 직후 api의 migration이 `P1001: Can't reach database server`로 실패했다. 두 번째 실행부터는 성공했다.

MySQL 이미지는 첫 실행 때 데이터 디렉터리를 초기화하는 동안 **소켓만 여는 임시 서버**를 띄운다. healthcheck인 `mysqladmin ping -h localhost`는 소켓으로 접속하므로 이 임시 서버에도 통과한다. 그 사이 api는 TCP로 접속하다 실패한 것이다.

```yaml
healthcheck:
  # 127.0.0.1(TCP)로 확인: 첫 실행 초기화 중 임시 서버는 소켓만 열어 localhost 확인이 너무 일찍 통과함
  test: ['CMD-SHELL', 'mysqladmin ping -h 127.0.0.1 -uroot -p$$MYSQL_ROOT_PASSWORD']
```

`-h 127.0.0.1`로 TCP 접속을 확인하게 바꾸고, api에는 `restart: on-failure`를 더했다.

## 확인

빈 볼륨에서 `docker compose up` → migration 2개 적용 → 서버 시작 → `GET /` 200까지 확인했다. 띄운 김에 1단계 보안 수정도 실제 요청으로 확인했다([인증 없이 열려 있던 API 다섯 개](/memo/newpick-security)의 표).

| 항목                    | 결과                                 |
| ----------------------- | ------------------------------------ |
| 관리자 수동 크롤링      | 55건이 MongoDB에 저장, 필드 누락 0건 |
| TTL 인덱스              | `createdAt`, 2,592,000초 생성        |
| 삭제한 라우트 5개       | 모두 404                             |
| 무료 체험 요약 6회 연속 | 5회 처리, 6번째 429                  |
| api 컨테이너 메모리     | 대기 약 157MB, 크롤링 직후 약 310MB  |
| 테스트                  | 12개 통과, typecheck·lint·build 통과 |

## 남은 것·배운 것

- 메모리는 수정 후 값만 쟀다. Chromium을 띄우던 이전 구성의 값을 0단계에서 같이 쟀어야 비교할 수 있었다.
- AI 요약과 메일 발송은 실제 키가 필요해 이 단계에서는 확인하지 못했다. 배포 이슈(#12)에서 확인한다.
- 날짜 누락은 "fetch로 바꿔서 생긴 문제"처럼 보였지만 실제로는 원래 있던 문제였다. 바꾼 직후 첫 실행 결과를 필드 단위로 세어 보지 않았다면 지나쳤을 것이다.
