---
title: R2에 DB 백업 걸기 - 대시보드부터 cron까지
date: 2026-10-05
category: 개발기/MacFolio/인프라
summary: DB 백업 스크립트를 실제 서버에 적용하는 순서를 이유와 함께 정리했다. R2 Standard 비공개 버킷, 버킷 하나로 범위를 제한한 키, healthchecks 알림, rclone 1.59, 연결 확인, UTC cron, 8GB 상한, 다른 DB로의 복원 시험까지.
---

[백업 스크립트](/memo/db-backup)는 저장소에 병합되었지만, 서버에 설정하기 전까지는 실행되지 않는다. 설정 단계마다 선택할 항목이 8가지 있어 순서와 이유를 함께 정리한다. 명령만 필요하면 `docs/deployment.md`의 '백업' 절을 참고한다.

## 배경

API 서버는 Oracle Cloud의 무료 VM 한 대이고, PostgreSQL도 그 안의 Docker 컨테이너로 실행된다. 서버 디스크에만 백업을 보관하면, 서버가 회수되거나 디스크에 장애가 생길 때 백업도 함께 유실된다. 그래서 서버 외부 저장소 한 곳에 하루 1회 업로드하기로 했다.

| 서버 외부 저장소      | 장점                                                                                 | 단점                                                      |
| --------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Oracle Object Storage | 같은 클라우드라 전송이 빠르다                                                        | 같은 계정이 회수되거나 잠기면 함께 접근할 수 없다         |
| GitHub Actions 산출물 | 이미 사용 중이다                                                                     | 보관 기간이 짧고, 서버가 GitHub 쓰기 토큰을 보유해야 한다 |
| Cloudflare R2 (선택)  | 프론트엔드 배포로 이미 사용 중인 계정. 무료 한도 10GB. 외부 전송(egress) 요금이 없다 | 한도 초과 전에 차단하는 설정이 없다 (아래 6번)            |

비밀 값(키)은 모든 단계에서 **서버의 `~/deploy/backup.env`에만** 저장한다. 저장소, 채팅, 스크린샷 어디에도 남기지 않는다.

![backup.sh가 pg_dump부터 R2 업로드, healthchecks 알림까지 실행하는 순서](./images/r2-backup-setup-pipeline.svg '아래 1~8단계는 이 그림의 각 단계가 실제 서버에서 실행되도록 하는 준비 작업이다')

## 1. 버킷: Standard, 비공개

Cloudflare 대시보드의 R2에서 `macfolio-backups` 버킷을 생성한다([Cloudflare 문서: R2 시작하기](https://developers.cloudflare.com/r2/get-started/)).

- **저장 클래스는 Standard.** 백업은 조회 빈도가 낮아 Infrequent Access가 적합해 보이지만, R2의 무료 한도(매달 저장 10GB, 쓰기 작업 100만 회, 읽기 작업 1,000만 회)는 Standard에만 적용된다([Cloudflare 문서: R2 pricing](https://developers.cloudflare.com/r2/pricing/))
- **비공개로 유지한다.** 기본값이 비공개다. 공개하면 누구나 파일을 내려받아 읽기 작업 수를 늘릴 수 있다

R2를 처음 활성화할 때 결제 수단 등록을 요구할 수 있다. 무료 한도 안이면 청구되지 않는다.

## 2. 키: 이 버킷 하나로 범위 제한

R2 API 토큰을 생성할 때 권한은 **Object Read & Write**, 범위는 **이 버킷만**으로 선택한다([Cloudflare 문서: R2 API 토큰](https://developers.cloudflare.com/r2/api/tokens/)). 백업 스크립트는 업로드·목록 조회·삭제만 수행하므로 이 권한으로 충분하다. 키가 유출되어도 다른 버킷이나 Cloudflare의 다른 서비스에는 접근할 수 없다.

생성하면 Access Key ID, Secret Access Key, S3 엔드포인트가 표시된다. Secret Access Key는 이 화면에서만 표시되므로, 서버 설정을 마칠 때까지만 임시로 보관한다.

## 3. 실패 알림 주소

cron은 작업이 실패해도 알리지 않는다. 디스크가 가득 차거나, 키가 만료되거나, 서버가 중지되어 몇 주 동안 백업이 생성되지 않아도 알 수 없다.

[healthchecks.io](https://healthchecks.io)에 Check를 하나 생성하고(주기 1일, 유예 1시간), Ping URL을 `BACKUP_PING_URL`에 지정한다. 스크립트는 성공하면 이 주소를, 실패하면 `주소/fail`을 요청한다. 주기와 유예 시간이 지나도 요청이 없으면 healthchecks.io가 메일을 보낸다. 실패뿐 아니라 "실행되지 않음"도 검출하는 것이 핵심이다.

![healthchecks.io가 알림을 보내는 세 경우](./images/r2-backup-setup-healthchecks.svg '성공은 알림 없음, 실패는 즉시, 실행되지 않으면 1일 + 1시간 후 알림')

## 4. rclone 1.59 이상

처음 문서에는 `sudo apt-get install rclone`으로 기록했다. 그런데 rclone이 R2를 `provider=Cloudflare`로 지원하는 것은 1.59부터이고, Ubuntu 22.04의 apt 저장소에 있는 rclone은 1.53이다. 그래서 공식 설치 스크립트로 설치하고 `rclone version`으로 버전을 확인하도록 수정했다([rclone 문서: Cloudflare R2](https://rclone.org/s3/#cloudflare-r2)).

rclone 설정은 `rclone config` 파일 대신 `RCLONE_CONFIG_R2_*` 환경 변수로 전달한다. 키가 `backup.env` 한 파일에 모이고, 파일 권한을 `600`으로 지정하면 서버의 다른 사용자도 읽을 수 없다.

## 5. 백업 전에 연결 확인

스크립트를 실행하기 전에 rclone만으로 R2에 접근되는지 확인한다.

```bash
set -a; source ~/deploy/backup.env; set +a
rclone size r2:macfolio-backups   # 처음에는 Total objects: 0
echo test | rclone rcat r2:macfolio-backups/connection-test.txt   # 쓰기도 되는지
rclone deletefile r2:macfolio-backups/connection-test.txt
```

| 출력           | 원인                          |
| -------------- | ----------------------------- |
| `AccessDenied` | 토큰 권한 또는 범위 설정 오류 |
| `no such host` | 엔드포인트 주소 오류          |

이 단계에서 문제를 찾으면 덤프·압축 단계의 오류와 섞이지 않아 원인을 바로 특정할 수 있다.

처음에는 연결 확인 명령으로 `rclone lsd r2:`(버킷 목록)를 기록했다. 서버에서 실행하자 이 명령만 `403 AccessDenied`를 반환하고, 바로 다음의 `rclone size r2:macfolio-backups`는 0을 반환했다. 버킷 목록 조회는 계정 전체 범위의 요청인데, 키 범위를 이 버킷 하나로 제한했으므로 거부되는 것이 정상이다. 오류가 아니라 2단계의 범위 제한이 의도대로 적용되었다는 뜻이다. 그래서 연결 확인은 버킷을 직접 지정하는 명령으로만 한다.

## 6. 1회 실행 후 크기 확인

```bash
~/macfolio/ops/backup.sh
```

"백업 완료"와 "올림: … (저장소 …MB / 상한 8GB)"가 출력되면 성공이다. 이때 `ls -lh ~/backups`로 **백업 파일 하나의 크기**를 확인한다. R2에는 30일치를 보관하므로, 이 크기 × 30이 저장소 상한(8GB)보다 충분히 작아야 한다. 블로그 이미지가 DB에 저장되어 있어 글과 이미지가 늘수록 커진다.

R2에는 한도 초과 전에 사용을 차단하는 설정이 없다. 그래서 스크립트가 업로드 전에 버킷 크기를 측정하고, 오늘 백업 크기를 더한 값이 상한을 넘으면 업로드하지 않고 실패 알림을 보낸다. 무료 한도 10GB보다 낮은 8GB에서 먼저 중단한다.

```bash
remote_bytes="$(rclone size --json "$BACKUP_REMOTE" | grep -o '"bytes":[0-9]*' | cut -d: -f2)" ||
	fail "서버 밖 저장소의 크기를 재지 못했다 ($BACKUP_REMOTE)"
file_bytes="$(wc -c <"$file" | tr -d ' ')"
limit_bytes=$((MAX_REMOTE_GB * 1024 * 1024 * 1024))
if ((remote_bytes + file_bytes > limit_bytes)); then
	fail "서버 밖 저장소가 상한(${MAX_REMOTE_GB}GB)을 넘게 된다 … 올리지 않았다"
fi
```

![백업 보관 위치와 기간](./images/r2-backup-setup-retention.svg '서버에는 7일, R2에는 30일을 보관하고, R2 전체가 8GB를 넘게 되면 업로드하지 않는다')

## 7. cron 시각은 UTC 기준

```bash
30 3 * * * /home/ubuntu/macfolio/ops/backup.sh >> /home/ubuntu/deploy/backup.log 2>&1
```

서버 시간대는 보통 UTC이므로 03:30은 한국 시간 12:30이다. `date`로 시간대를 먼저 확인한다. 출력은 `backup.log`에 누적되므로, 알림을 받으면 이 로그에서 실패 단계를 확인한다.

## 8. 복원 시험

백업 파일의 존재와 복원 가능 여부는 별개다. 실제 DB는 변경하지 않고 다른 이름의 DB에 복원해, 글 수가 실제 DB와 같은지 확인한다.

```bash
latest=$(ls -t ~/backups/macfolio-*.sql.gz | head -1)   # 가장 최근 백업
DB_NAME=restoretest ~/macfolio/ops/restore.sh "$latest"
docker compose exec -T db psql -U macfolio -d restoretest -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d macfolio -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d postgres -c 'drop database restoretest'
```

최초 1회, 이후 월 1회 정도 실행한다. R2의 백업도 `r2:macfolio-backups/<파일>` 형식으로 지정하면 내려받아 복원한다.

서버에서 처음 실행한 결과는 다음과 같다.

- 백업 파일 하나: 1007KB (글과 업로드 이미지가 모두 포함된 DB를 gzip으로 압축한 크기). 30일치를 합쳐도 약 30MB로 상한 8GB의 0.4% 수준이다
- 다른 DB(`restoretest`)에 복원한 글 수 4개, 실제 DB도 4개

한 번은 복원 명령에 `~/backups/<파일>`을 그대로 붙여 넣었다. bash는 `<`와 `>`를 리다이렉션 기호로 해석해 문법 오류를 출력하고 복원을 실행하지 않았으며, 이어진 확인 명령은 "그런 DB가 없다"로 실패했다. 그래서 문서의 명령은 파일 이름을 직접 입력하지 않고 가장 최근 백업을 `ls -t`로 선택해 전달하도록 변경했다.

## 정리

| 선택                       | 이유                                  |
| -------------------------- | ------------------------------------- |
| Standard 클래스            | 무료 한도는 Standard에만 있다         |
| 비공개 버킷                | 외부에서 읽어 작업 수를 늘리지 못하게 |
| 버킷 하나에만 읽기·쓰기 키 | 키가 유출되어도 피해가 이 버킷에 한정 |
| 알림 주소                  | 실패와 "실행되지 않음"을 모두 검출    |
| rclone 1.59 이상           | 이전 버전에는 R2 공급자가 없다        |
| 연결 먼저 확인             | 연결 문제를 덤프 오류와 분리해 찾는다 |
| 저장소 상한 8GB            | R2에는 한도 초과 전 차단 설정이 없다  |
| 다른 DB에 복원             | 복원 가능 여부를 실제로 검증한다      |

## 이후 작업

- 같은 날 서버 배포 스크립트(`ops/deploy.sh`)가 새 버전으로 교체하기 전에 이 백업 스크립트를 먼저 실행하게 했다(`BACKUP_LOCAL_ONLY=1`, 서버에만 보관). 첫 배포에서 compose에 `API_TAG`가 전달되지 않아 이 백업 단계가 실패했고, 즉시 수정했다([PR #107](https://github.com/hyeoniverse/MacFolio/pull/107)).
- 이후 [되돌리기 훈련](/memo/rollback-drill)에서 의도적으로 실패하는 이미지를 배포할 때도, 배포 직전 백업이 정상적으로 하나 생성되었다.

이 글과 스크립트는 [PR #94](https://github.com/hyeoniverse/MacFolio/pull/94)(스크립트), [PR #98](https://github.com/hyeoniverse/MacFolio/pull/98)(8GB 상한), [PR #99](https://github.com/hyeoniverse/MacFolio/pull/99)(연결 확인과 첫 결과)로 나뉘어 병합되었다.

## 남은 과제와 정리

- 백업은 하루 1회이므로 최대 하루치 데이터가 유실될 수 있다. 일부 글은 저장소의 Markdown에도 있지만, 서버에서 수정한 글·댓글·메시지는 DB에만 있다.
- 복원 시험은 "월 1회 정도"로 기록했을 뿐, 자동으로 실행되지 않는다.
- 연결 확인에서 `rclone lsd`가 403을 반환한 것처럼, 권한을 제한한 키에는 실패가 정상인 명령이 있다. 문서의 확인 명령은 그 키로 성공해야 하는 명령만 기록해야 한다.
- 문서에 `<파일>` 같은 플레이스홀더를 두면 그대로 붙여 넣는 실수가 생긴다. 명령이 값을 직접 선택하게(`ls -t | head -1`) 하는 편이 안전하다.

## 이 절차를 만든 이유

처음 서버를 업데이트할 때는 기록해 둔 명령을 그대로 붙여 넣었다.

| 날짜     | 실행 위치   | 명령                                                 | 결과                          |
| -------- | ----------- | ---------------------------------------------------- | ----------------------------- |
| 10월 2일 | 로컬 Mac    | `cd ~/deploy && docker compose exec -T db pg_dump …` | `no such file or directory`   |
| 10월 3일 | 서버 호스트 | `pg_dump ... > backup.sql`                           | `Command 'pg_dump' not found` |

DB는 컨테이너 안에 있으므로 `docker compose exec`로 컨테이너의 `pg_dump`를 실행해야 했다. 수동 백업은 이처럼 오류가 생기기 쉬워, 명령을 `ops/backup.sh` 하나로 묶고 cron이 실행하게 했다.

## 문서와 스크립트

- 절차 원문: [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '백업' (8. cron, 9. 되살리기 시험, 10. 사용량 알림)
- 스크립트: [ops/backup.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/backup.sh), [ops/restore.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/restore.sh)

참고 문서: [Cloudflare R2 시작하기](https://developers.cloudflare.com/r2/get-started/), [R2 API 토큰](https://developers.cloudflare.com/r2/api/tokens/), [rclone S3(R2) 설정](https://rclone.org/s3/#cloudflare-r2), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [Healthchecks.io 문서](https://healthchecks.io/docs/).

## 관련 글

- [글이 DB에만 있게 되어서 백업을 붙였다](/memo/db-backup)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)
- [되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올렸다](/memo/rollback-drill)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)

#MacFolio #서버 #백업 #Cloudflare
