---
title: 글이 DB에만 있게 되어서 백업을 붙였다
date: 2026-10-05
category: 개발 기록/MacFolio/배포·운영
summary: 블로그 글·임시 저장·버전·업로드한 이미지가 모두 1GB 무료 서버의 DB에만 저장되었다. 매일 pg_dump로 덤프해 파일이 끝까지 기록되었는지 검사하고, 서버에 7일·R2에 30일 보관하며, R2 무료 한도에 닿기 전에 업로드를 중단하게 했다. 복원도 스크립트로 시험했다.
---

처음 블로그 글은 저장소의 Markdown 파일이었다. 서버 데이터가 유실되어도 글은 git에 남았다. 지금은 관리자 편집기로 작성한 글, 임시 저장본, 게시할 때마다 생성되는 버전(`PostRevision`), 업로드한 이미지와 첨부 파일이 **모두 서버의 PostgreSQL DB에만** 저장된다.

그 서버는 Oracle Cloud의 메모리 1GB 무료 VM이다. 디스크 장애가 생기거나, 사용량이 낮은 상태가 오래 이어지면 Oracle이 인스턴스를 회수할 수 있다.[^idle] 그런데 백업 수단은 문서에 적힌 수동 명령 한 줄뿐이었다. 그래서 기능 추가보다 백업 자동화를 먼저 진행했다. 스크립트는 [#94](https://github.com/hyeoniverse/MacFolio/pull/94), 저장 크기 상한은 [#98](https://github.com/hyeoniverse/MacFolio/pull/98)에서 추가했다.

## 백업 방식 선택

| 방법                                  | 장점                             | 단점                                                                         |
| ------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| VM 디스크 스냅숏 (클라우드 기능)      | 서버 전체를 복원한다             | 같은 클라우드 계정 안에 저장된다. 계정이나 VM이 회수되면 함께 삭제될 수 있다 |
| `pg_basebackup` + WAL[^wal] 보관      | 원하는 시각으로 복원한다(PITR)   | 1GB 서버에서 WAL을 계속 외부로 전송하는 부하가 크다. 이 규모에는 과하다      |
| **`pg_dump` → gzip → 서버 밖 저장소** | SQL 파일 하나. 어디서든 복원한다 | 하루 1회라 마지막 백업 이후 작성한 글은 유실될 수 있다                       |

글을 하루에 몇 편 작성하는 블로그라, 최대 하루치 유실을 감수하고 구성이 단순한 세 번째 방식을 선택했다. 덤프 파일은 SQL 텍스트라 다른 PostgreSQL 어디에나 복원할 수 있고, 클라우드 계정과 무관하게 보존된다([PostgreSQL 문서: SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)).

## 백업 스크립트의 동작

서버의 cron이 `ops/backup.sh`를 매일 실행한다.

1. `pg_dump`로 DB를 덤프해 gzip으로 압축한다. `--clean --if-exists` 옵션을 지정해, 복원 시각에 기존 테이블을 먼저 삭제하고 다시 생성한다
2. 압축 파일 무결성(`gzip -t`)과 덤프가 **끝까지** 기록되었는지(마지막 줄의 `PostgreSQL database dump complete`) 검사한다. 중간에 끊긴 파일은 백업으로 보관하지 않는다
3. 서버에 7일, 서버 밖(Cloudflare R2[^r2])에 30일 보관하고 기간이 지난 파일은 삭제한다. 도메인이 이미 Cloudflare에 있어 R2용 계정을 새로 만들 필요가 없었다
4. 끝나면 알림 주소(healthchecks.io 같은 서비스)에 요청을 보낸다. 실패하면 `/fail` 주소에 요청하고 종료 코드 1로 끝난다. cron은 작업이 실패해도 알리지 않으므로, 이 알림이 없으면 백업이 몇 주째 중단되어도 발견하지 못한다

핵심은 "끝까지 기록된 파일만 백업으로 인정한다"는 부분이다.

```bash
partial="$file.partial"
trap 'rm -f "$partial"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
	pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner |
	gzip -9 >"$partial" || fail "pg_dump"

gzip -t "$partial" || fail "압축 파일이 깨졌다"
gunzip -c "$partial" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || fail "덤프가 끝까지 쓰이지 않았다"
mv "$partial" "$file"
```

덤프는 먼저 `.partial` 이름으로 기록하고, 검사를 모두 통과한 뒤에 최종 이름으로 변경한다. 중간에 실패하면 `trap`이 `.partial` 파일을 삭제한다. 따라서 백업 폴더의 `.sql.gz`는 모두 검사를 통과한 파일이다. `set -euo pipefail`의 `pipefail` 옵션 때문에 파이프 앞쪽(`pg_dump`)이 실패하면 뒤쪽 `gzip`이 성공해도 파이프 전체가 실패로 처리된다.

![백업 스크립트의 단계](./images/db-backup-flow.svg '덤프 → 확인 → 서버 7일 → 용량 상한 확인 → R2 30일 → 알림')

### R2 요금이 발생하지 않게

R2는 매달 저장 10GB, 쓰기 작업 100만 회, 읽기 작업 1,000만 회까지 무료이고, 외부 전송(egress) 요금은 없다. 하루 1회 업로드하고 30일치를 보관하므로 작업 횟수는 한 달에 수백 회로 한도와 거리가 멀다. 제약은 저장 크기다. 블로그 이미지가 DB에 저장되어 있어 DB가 커지면 백업 30개의 합이 10GB를 넘을 수 있다.

R2에는 무료 한도를 넘기 전에 사용을 차단하는 설정이 없다. 그래서 스크립트가 직접 차단한다. 기간이 지난 백업을 삭제한 뒤 `rclone size`로 버킷 전체 크기를 측정하고, 오늘 백업 크기를 더한 값이 상한(`MAX_REMOTE_GB`, 기본 8GB)을 넘으면 업로드하지 않고 실패 알림을 보낸다. 이 경우에도 오늘 백업은 서버에 보관된다. 알림을 받으면 보관 일수를 줄이거나 상한을 조정한다.

버킷은 비공개로 두고, API 토큰에는 이 버킷 하나의 객체 읽기·쓰기 권한만 부여한다. 외부에서 파일을 읽어 작업 횟수를 늘릴 수 없고, 토큰이 유출되어도 다른 버킷이나 서비스에는 접근할 수 없다.

![서버에는 7일, R2에는 30일. R2 전체가 8GB를 넘게 되면 올리지 않고 알린다](./images/db-backup-retention.svg '보관 기간과 크기 상한. 상한은 R2 무료 10GB보다 낮게 설정했다')

```bash
limit_bytes=$((MAX_REMOTE_GB * 1024 * 1024 * 1024))
if ((remote_bytes + file_bytes > limit_bytes)); then
	fail "서버 밖 저장소가 상한(${MAX_REMOTE_GB}GB)을 넘게 된다 … 올리지 않았다"
fi
```

R2 키는 저장소 밖의 `~/deploy/backup.env`에만 저장한다. rclone 설정도 `RCLONE_CONFIG_R2_*` 환경 변수로 전달하므로 별도의 rclone 설정 파일이 없다([rclone 문서: 환경 변수로 설정하기](https://rclone.org/docs/#environment-variables)).

## 복원 시험

복원하지 않은 백업은 실제로 쓸 수 있는지 알 수 없다. `ops/restore.sh`는 백업 파일(또는 R2 경로)을 인자로 받아 복원한다.

- 실제 DB에 복원할 때는 확인 입력을 받고, 복원하는 동안 API 컨테이너를 중지했다가 다시 시작한다
- `DB_NAME`에 다른 이름을 지정하면 그 이름으로 DB를 새로 생성해 복원한다. 실제 DB를 변경하지 않고 백업을 시험할 수 있다

![restore.sh는 실제 DB면 확인 후 API를 멈추고, 다른 이름이면 새 DB를 만들어 복원한다](./images/db-backup-restore.svg 'DB_NAME에 따라 나뉘는 복원 경로와 trap 정리')

로컬 DB로 다음 항목을 확인했다.

- 백업을 다른 DB에 복원하고, 테이블마다 행 수가 원본과 같은지
- 올린 파일(바이너리)과 글 본문의 해시가 원본과 같은지
- 존재하지 않는 DB를 덤프하면 종료 코드 1로 끝나고, `.partial` 파일이 남지 않는지
- R2 업로드가 실패하면 종료 코드 1로 끝나고, 서버의 백업 파일은 보관되는지 (rclone을 대체하는 가짜 명령으로 시험)
- 저장 크기가 상한을 넘게 되면 업로드하지 않고 종료 코드 1로 끝나며 알림 주소의 `/fail`에 요청하는지, 상한 값이 숫자가 아니면 중단하는지 (같은 방법으로 시험)

`restore.sh`도 `trap`으로 정리 작업을 실행한다. R2에서 내려받은 임시 파일을 삭제하고, 중지한 API를 성공·실패와 관계없이 다시 시작한다. 복원이 실패해도 API가 중지된 상태로 남지 않는다.

## 수치

| 항목                      | 값                                                 |
| ------------------------- | -------------------------------------------------- |
| `ops/backup.sh`           | 94줄 (현재. 첫 PR 이후 상한·배포 전 백업이 추가됨) |
| `ops/restore.sh`          | 62줄                                               |
| 서버에서 처음 실행한 백업 | 1007KB (글과 업로드 이미지를 gzip -9)              |
| 30일치 R2                 | 30MB 남짓 (상한 8GB, 무료 10GB)                    |
| 보관 기간                 | 서버 7일, R2 30일                                  |

## 배포 전 백업에 재사용

백업 스크립트는 매일 실행하는 cron 외에 한 곳에서 더 사용한다. 서버 배포 스크립트 `ops/deploy.sh`가 새 API 이미지로 교체하기 직전에 `BACKUP_LOCAL_ONLY=1`로 실행한다. 마이그레이션이 DB를 손상시켜도 직전 상태로 복원하기 위해서다. 이 모드에서는 R2 업로드와 알림 요청을 하지 않는다. 배포 전 백업이 R2 용량 상한을 차지하지 않게 하기 위해서다.

첫 배포에서는 compose에 `API_TAG` 환경 변수가 전달되지 않아 배포 전 백업이 실패했다([#107](https://github.com/hyeoniverse/MacFolio/pull/107)). 백업이 실패하면 배포도 중단하도록 구성했기 때문에 이 문제가 배포 단계에서 드러났다.

## 남은 과제와 정리

- 하루 1회 백업이라 마지막 백업 이후 작성한 글은 유실될 수 있다. 현재 작성량에서는 감수할 수 있는 범위다.
- 복원 시험은 수동으로 실행한다. R2의 최신 백업을 다른 DB 이름으로 복원해 행 수를 비교하는 작업을 cron으로 자동화할 수 있다.
- 업로드한 이미지가 DB 안에 `bytea`로 저장되어 있어 백업 크기는 이미지 용량에 비례해 증가한다. 이미지를 R2 같은 객체 저장소로 옮기면 백업 크기도 줄어든다.

백업에서 가장 위험한 상태는 실패를 아무도 인지하지 못하는 상태다. cron은 실패를 알리지 않고, 중간에 끊긴 덤프도 파일로는 남는다. 그래서 덤프 완료 검사와 실패 알림 요청이 스크립트의 절반을 차지한다.

서버에 적용하는 순서(R2 버킷과 키, rclone, cron)는 `docs/deployment.md`의 '백업' 절에, 단계별 이유는 [R2에 DB 백업 걸기 - 대시보드부터 cron까지](/memo/r2-backup-setup)에 정리했다. 서버를 처음 구축한 과정은 [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)에 있다.

## 자동화 이전의 수동 백업 실패 사례

자동 백업을 만들기 전, DB 백업 수단은 문서에 적힌 명령 한 줄(`cd ~/deploy && docker compose exec -T db pg_dump -U macfolio macfolio > ~/backup-$(date +%F).sql`)뿐이었다. 이 명령으로 두 번 실패했다.

| 날짜     | 실행한 곳       | 출력                                             | 원인                                                                                             |
| -------- | --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 10월 2일 | 로컬 Mac 터미널 | `cd: no such file or directory: /Users/…/deploy` | 서버가 아닌 로컬 터미널에서 실행했다                                                             |
| 10월 3일 | 서버            | `pg_dump` 명령을 찾을 수 없다는 오류             | PostgreSQL은 컨테이너 안에만 설치되어 있어 `docker compose exec`로 컨테이너 안에서 실행해야 한다 |

두 실패 모두 명령을 실행할 위치를 사람이 기억해야 해서 발생했다. 그래서 `ops/backup.sh`는 compose 파일 위치(`~/deploy/compose.yml`)를 기본값으로 갖고, 컨테이너 안의 `pg_dump`를 실행하며, 실행 자체를 cron이 담당한다.

## 적용 방법

준비물: Cloudflare R2 버킷과 그 버킷 하나에만 권한을 준 API 토큰, 서버의 [rclone](https://rclone.org/s3/#cloudflare-r2) 1.59 이상. 전체 순서(10단계)는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '백업'에 있다.

```bash
# 서버에서 한 번 실행해 확인
~/macfolio/ops/backup.sh
# … 백업 완료: /home/ubuntu/backups/macfolio-…sql.gz
# … 올림: r2:macfolio-backups/macfolio-…sql.gz (저장소 …MB / 상한 8GB)

# 매일 03:30 UTC (12:30 KST)
crontab -e
30 3 * * * /home/ubuntu/macfolio/ops/backup.sh >> /home/ubuntu/deploy/backup.log 2>&1
```

복원 시험은 실제 DB를 변경하지 않도록 다른 DB 이름으로 진행한다.

```bash
cd ~/deploy
latest=$(ls -t ~/backups/macfolio-*.sql.gz | head -1)
DB_NAME=restoretest ~/macfolio/ops/restore.sh "$latest"
docker compose exec -T db psql -U macfolio -d restoretest -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d macfolio    -c 'select count(*) from "Post"'   # 같아야 한다
docker compose exec -T db psql -U macfolio -d postgres    -c 'drop database restoretest'
```

실제 DB를 복원할 때는 `~/macfolio/ops/restore.sh <파일 또는 r2:경로>`를 실행한다. 확인 입력을 받고, 복원하는 동안 API를 중지했다가 다시 시작한다. 스크립트: [ops/backup.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/backup.sh), [ops/restore.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/restore.sh). `pg_dump` 옵션은 [PostgreSQL 문서: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), R2 무료 한도는 [Cloudflare 문서: R2 pricing](https://developers.cloudflare.com/r2/pricing/)을 참고했다.

## 관련 글

- [R2에 DB 백업 걸기 - 대시보드부터 cron까지](/memo/r2-backup-setup)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)
- [되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올렸다](/memo/rollback-drill)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)

[^idle]: Oracle Cloud Always Free 인스턴스는 7일 동안 CPU·네트워크·메모리 사용률이 낮으면 유휴 인스턴스로 판단해 회수할 수 있다. [Oracle 문서: Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

[^wal]: Write-Ahead Log. PostgreSQL이 데이터 파일을 변경하기 전에 변경 내용을 먼저 기록하는 로그. 기본 백업과 WAL을 함께 보관하면 특정 시각으로 복원(PITR)할 수 있다. [PostgreSQL 문서: Continuous Archiving](https://www.postgresql.org/docs/current/continuous-archiving.html)

[^r2]: Cloudflare의 S3 호환 객체 저장소. S3 API를 그대로 사용하므로 rclone의 S3 백엔드로 접근한다. [Cloudflare 문서: R2](https://developers.cloudflare.com/r2/)

#MacFolio #서버 #백업
