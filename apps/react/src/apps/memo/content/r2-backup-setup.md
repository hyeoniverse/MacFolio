---
title: R2에 DB 백업 걸기 - 대시보드부터 cron까지
date: 2026-10-05
category: 개발기/MacFolio
summary: 백업 스크립트를 실제 서버에 거는 순서. R2 버킷과 키, 실패를 알려 줄 주소, rclone 버전, 연결 확인, cron, 되살리기 시험까지. 단계마다 그렇게 하는 까닭을 함께 적었다.
---

[백업 스크립트](/memo/db-backup)는 저장소에 들어갔지만, 서버에 걸기 전까지는 아무 일도 하지 않는다. 걸 때 고를 것이 생각보다 많았다. 순서와 까닭을 같이 적어 둔다. 명령만 필요하면 `docs/deployment.md`의 '백업'을 보면 된다.

비밀 값(키)은 처음부터 끝까지 **서버의 `~/deploy/backup.env`에만** 둔다. 저장소에도, 채팅에도, 스크린샷에도 남기지 않는다.

## 1. 버킷: Standard, 비공개

Cloudflare 대시보드의 R2에서 `macfolio-backups` 버킷을 만든다.

- **저장 클래스는 Standard.** 백업은 거의 꺼내 보지 않으니 Infrequent Access가 맞아 보이지만, R2의 무료 한도(매달 저장 10GB, 쓰기 100만 번, 읽기 1000만 번)는 Standard에만 있다
- **공개하지 않는다.** 기본값이 비공개다. 공개하면 누구나 파일을 내려받으며 읽기 작업 수를 늘릴 수 있다

R2를 처음 켤 때 결제 수단 등록을 요구할 수 있다. 무료 한도 안이면 청구되지 않는다.

## 2. 키: 이 버킷 하나에만

R2 API 토큰을 만들 때 권한은 **Object Read & Write**, 범위는 **이 버킷만**으로 고른다. 백업 스크립트는 올리기·목록 보기·지우기만 하니 이것으로 충분하다. 키가 새어도 다른 버킷이나 Cloudflare의 다른 서비스는 건드릴 수 없다.

만들면 Access Key ID, Secret Access Key, S3 엔드포인트가 나온다. 비밀 키는 이 화면에서만 보여서, 서버 설정을 마칠 때까지만 잠깐 적어 둔다.

## 3. 실패를 알려 줄 주소

cron은 실패해도 아무 말이 없다. 디스크가 찼든, 키가 만료됐든, 서버가 꺼졌든 몇 주 동안 백업이 없어도 모른다.

[healthchecks.io](https://healthchecks.io)에 Check를 하나 만들고(주기 하루, 유예 1시간), Ping URL을 `BACKUP_PING_URL`에 넣는다. 스크립트는 성공하면 이 주소를, 실패하면 `주소/fail`을 부른다. 하루가 지나도 아무 소식이 없으면 healthchecks.io가 먼저 메일을 보낸다. "실패했다"뿐 아니라 "아예 돌지 않았다"도 알 수 있는 것이 핵심이다.

## 4. rclone은 1.59 이상

처음 문서에는 `sudo apt-get install rclone`이라고 적었다. 그런데 rclone이 R2를 `provider=Cloudflare`로 알아보는 것은 1.59부터이고, Ubuntu 22.04의 apt에 있는 rclone은 1.53이다. 그래서 공식 설치 스크립트로 받고 `rclone version`으로 버전을 확인하게 고쳤다.

rclone 설정은 `rclone config` 파일 대신 `RCLONE_CONFIG_R2_*` 환경 변수로 넣는다. `backup.env` 한 파일에 키가 모이고, 권한을 `600`으로 잠그면 서버의 다른 사용자도 읽을 수 없다.

## 5. 백업 전에 연결부터

스크립트를 바로 돌리기 전에 rclone만으로 R2에 닿는지 본다.

```bash
set -a; source ~/deploy/backup.env; set +a
rclone lsd r2:                  # macfolio-backups가 보이면 된다
rclone size r2:macfolio-backups
```

`AccessDenied`면 토큰 권한이나 범위, `no such host`면 엔드포인트 주소가 틀린 것이다. 여기서 문제를 찾으면 덤프·압축과 섞이지 않아 원인이 바로 보인다.

## 6. 한 번 돌려 보고, 크기를 본다

```bash
~/macfolio/ops/backup.sh
```

"백업 완료"와 "올림: … (저장소 …MB / 상한 8GB)"가 나오면 된다. 이때 `ls -lh ~/backups`로 **백업 파일 하나의 크기**를 본다. R2에는 30일치를 남기니, 이 크기 × 30이 저장소 상한(8GB)보다 넉넉히 작아야 한다. 블로그 이미지가 DB에 들어 있어서 글과 이미지가 늘수록 커진다.

R2에는 청구되기 전에 멈추는 설정이 없다. 그래서 스크립트가 올리기 전에 버킷 크기를 재고, 오늘 백업을 더해 상한을 넘으면 올리지 않고 실패로 알린다. 무료 한도인 10GB보다 낮은 8GB에서 먼저 멈춘다.

## 7. cron은 UTC

```bash
30 3 * * * /home/ubuntu/macfolio/ops/backup.sh >> /home/ubuntu/deploy/backup.log 2>&1
```

서버 시간은 보통 UTC라서 03:30은 한국 시간 12:30이다. `date`로 시간대를 먼저 확인한다. 출력은 `backup.log`에 쌓여서, 알림이 오면 여기서 무엇이 실패했는지 본다.

## 8. 되살려 보기

백업이 있다는 것과 되살릴 수 있다는 것은 다르다. 실제 DB는 건드리지 않고 다른 이름의 DB에 되살려, 글 수가 실제 DB와 같은지 본다.

```bash
DB_NAME=restoretest ~/macfolio/ops/restore.sh ~/backups/<파일>
docker compose exec -T db psql -U macfolio -d restoretest -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d macfolio -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d postgres -c 'drop database restoretest'
```

처음 한 번, 그리고 한 달에 한 번쯤 해 본다. R2에 있는 백업도 `r2:macfolio-backups/<파일>`처럼 넘기면 받아 와서 되살린다.

## 정리

| 고른 것                    | 까닭                                  |
| -------------------------- | ------------------------------------- |
| Standard 클래스            | 무료 한도는 Standard에만 있다         |
| 비공개 버킷                | 남이 읽어서 작업 수를 늘리지 못하게   |
| 버킷 하나에만 읽기·쓰기 키 | 키가 새도 피해가 이 버킷에 그친다     |
| 알림 주소                  | 실패뿐 아니라 "돌지 않음"도 알게      |
| rclone 1.59 이상           | 그 전에는 R2 공급자가 없다            |
| 연결부터 확인              | 문제를 덤프와 섞지 않고 찾는다        |
| 저장소 상한 8GB            | R2에는 청구 전에 멈추는 설정이 없다   |
| 다른 DB에 되살리기         | 되살려 보지 않은 백업은 백업이 아니다 |
