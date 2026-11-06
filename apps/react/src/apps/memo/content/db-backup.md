---
title: pg_dump와 R2로 하는 DB 백업과 복원 시험
date: 2026-10-05
category: 개발 기록/MacFolio/배포·운영
series: 서버 운영
seriesOrder: 2
summary: 글·이미지가 모두 1GB 무료 서버의 DB에만 있었다. 매일 pg_dump로 덤프해 완결성을 검사하고 서버에 7일, R2에 30일 보관한다. 범위를 제한한 R2 키, 8GB 업로드 상한, healthchecks 알림, 다른 DB로 복원해 행 수를 비교하는 시험까지 정리했다.
---

처음 블로그 글은 저장소의 Markdown 파일이었다. 서버 데이터가 유실되어도 글은 git에 남았다. 지금은 관리자 편집기로 작성한 글, 임시 저장본, 게시할 때마다 생성되는 버전(`PostRevision`), 업로드한 이미지와 첨부 파일, 댓글과 메시지가 **모두 서버의 PostgreSQL DB에만** 저장된다.

## 배경: 왜 서버 밖 백업이 필요한가

그 서버는 Oracle Cloud의 메모리 1GB 무료 VM이고, PostgreSQL도 그 안의 Docker 컨테이너로 실행된다. 디스크 장애가 생기거나, 사용량이 낮은 상태가 오래 이어지면 Oracle이 인스턴스를 회수할 수 있다.[^idle] 회수되면 VM의 디스크가 통째로 삭제되므로, 서버 디스크에만 백업을 보관하면 그 시각에 백업도 함께 유실된다.

**백업**은 데이터의 사본을 원본과 다른 장애 범위에 보관하는 작업이고, **복원**은 그 사본으로 데이터를 되살리는 작업이다. 같은 디스크에 있는 사본은 디스크 장애에, 같은 클라우드 계정에 있는 사본은 계정 회수에 함께 영향을 받는다. 그래서 이 글의 목표는 "다른 회사의 저장소에, 자동으로, 검증된 사본을 보관하는 것"이다.

그런데 백업 수단은 문서에 적힌 수동 명령 한 줄뿐이었고, 그 명령으로 두 번 실패했다.

| 날짜     | 실행한 곳       | 출력                                             | 원인                                                                                             |
| -------- | --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 10월 2일 | 로컬 Mac 터미널 | `cd: no such file or directory: /Users/…/deploy` | 서버가 아닌 로컬 터미널에서 실행했다                                                             |
| 10월 3일 | 서버            | `Command 'pg_dump' not found`                    | PostgreSQL은 컨테이너 안에만 설치되어 있어 `docker compose exec`로 컨테이너 안에서 실행해야 한다 |

==두 실패 모두 명령을 실행할 위치를 사람이 기억해야 해서 발생했다.== 그래서 기능 추가보다 백업 자동화를 먼저 진행했다. `ops/backup.sh`는 compose 파일 위치(`~/deploy/compose.yml`)를 기본값으로 갖고, 컨테이너 안의 `pg_dump`를 실행하며, 실행 자체를 cron이 담당한다. cron은 리눅스에서 정해진 시각마다 명령을 실행하는 예약 작업 데몬이다. 스크립트는 [#94](https://github.com/hyeoniverse/MacFolio/pull/94), 저장 크기 상한은 [#98](https://github.com/hyeoniverse/MacFolio/pull/98), 연결 확인과 첫 결과는 [#99](https://github.com/hyeoniverse/MacFolio/pull/99)에서 추가했다.

## 백업 방식 선택

PostgreSQL 백업은 크게 두 종류다. **논리 백업**은 `pg_dump`처럼 DB 내용을 `CREATE TABLE …`, `COPY … FROM stdin` 같은 SQL 문으로 출력하는 방식이다. **물리 백업**은 `pg_basebackup`처럼 DB가 디스크에 저장한 데이터 파일 자체를 복사하는 방식이다. 논리 백업 파일의 앞부분은 다음과 같은 SQL 텍스트다.

```sql
DROP TABLE IF EXISTS public."Post";
CREATE TABLE public."Post" ( slug text NOT NULL, title text, date text, … );
COPY public."Post" (slug, title, date, …) FROM stdin;
```

| 방법                                  | 장점                             | 단점                                                                         |
| ------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| VM 디스크 스냅숏 (클라우드 기능)      | 서버 전체를 복원한다             | 같은 클라우드 계정 안에 저장된다. 계정이나 VM이 회수되면 함께 삭제될 수 있다 |
| `pg_basebackup` + WAL[^wal] 보관      | 원하는 시각으로 복원한다(PITR)   | 1GB 서버에서 WAL을 계속 외부로 전송하는 부하가 크다. 이 규모에는 과하다      |
| **`pg_dump` → gzip → 서버 밖 저장소** | SQL 파일 하나. 어디서든 복원한다 | 하루 1회라 마지막 백업 이후 작성한 글은 유실될 수 있다                       |

글을 하루에 몇 편 작성하는 블로그라, 최대 하루치 유실을 감수하고 구성이 단순한 세 번째 방식을 선택했다. 덤프 파일은 SQL 텍스트라 다른 PostgreSQL 어디에나 복원할 수 있고, 클라우드 계정과 무관하게 보존된다([PostgreSQL 문서: SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)). 예를 들어 10월 5일 03:30에 백업하고 같은 날 18:00에 서버가 회수되면, 03:30 이후 작성한 글과 댓글만 유실된다.

서버 밖 저장소는 세 곳을 비교했다. 세 곳 모두 **객체 저장소**다. 객체 저장소는 파일을 폴더 계층 대신 "버킷 이름 + 키(경로 문자열)"로 저장하고 HTTP API로 올리고 내려받는 저장 서비스이며, Amazon S3의 API가 사실상 표준이다.

| 서버 외부 저장소          | 장점                                                                                 | 단점                                                        |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Oracle Object Storage     | 같은 클라우드라 전송이 빠르다                                                        | 같은 계정이 회수되거나 잠기면 함께 접근할 수 없다           |
| GitHub Actions 산출물     | 이미 사용 중이다                                                                     | 보관 기간이 짧고, 서버가 GitHub 쓰기 토큰을 보유해야 한다   |
| Cloudflare R2[^r2] (선택) | 프론트엔드 배포로 이미 사용 중인 계정. 무료 한도 10GB. 외부 전송(egress) 요금이 없다 | 한도 초과 전에 차단하는 설정이 없다 (아래 '무료 한도 보호') |

## 백업 스크립트의 동작

서버의 cron이 `ops/backup.sh`를 매일 실행한다.

1. `pg_dump`로 DB를 덤프해 gzip으로 압축한다. `--clean --if-exists` 옵션을 지정해, 복원 시각에 기존 테이블을 먼저 삭제하고 다시 생성한다
2. 압축 파일 무결성(`gzip -t`)과 덤프가 **끝까지** 기록되었는지(마지막 줄의 `PostgreSQL database dump complete`) 검사한다. 중간에 끊긴 파일은 백업으로 보관하지 않는다
3. 서버에 7일, R2에 30일 보관하고 기간이 지난 파일은 삭제한다
4. 끝나면 알림 주소에 요청을 보낸다. 실패하면 `/fail` 주소에 요청하고 종료 코드 1로 끝난다

![backup.sh가 pg_dump부터 R2 업로드, healthchecks 알림까지 실행하는 순서](./images/r2-backup-setup-pipeline.svg '덤프 → 확인 → 서버 보관 → R2 업로드 → 알림')

### 끝까지 기록된 파일만 백업으로 인정한다

`pg_dump`는 출력 마지막에 `-- PostgreSQL database dump complete`라는 주석 줄을 기록한다. 디스크가 가득 차거나 컨테이너가 중간에 종료되면 이 줄이 없는 파일이 남는다. 이런 파일은 크기만 보면 정상 백업과 구별되지 않지만, 복원하면 일부 테이블이 빠진다.

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

덤프는 먼저 `.partial` 이름으로 기록하고, 검사를 모두 통과한 뒤에 최종 이름으로 변경한다. 중간에 실패하면 `trap`이 `.partial` 파일을 삭제한다. `trap '명령' EXIT`는 스크립트가 어떤 이유로 끝나든 종료 직전에 그 명령을 실행하게 하는 bash 문법이다. 따라서 백업 폴더의 `.sql.gz`는 모두 검사를 통과한 파일이다.

![덤프를 .partial로 쓰고 gzip -t와 끝 줄 검사를 통과하면 mv로 이름을 바꾼다. 실패하면 trap이 .partial을 삭제한다](./images/db-backup-partial-rename.svg '임시 이름으로 기록하고 검사 통과 후에만 최종 이름을 붙인다')

### pipefail: 파이프 앞쪽의 실패를 놓치지 않는다

`pg_dump … | gzip -9`는 두 명령을 파이프(`|`)로 연결한다. bash는 기본적으로 파이프 전체의 종료 코드를 **마지막 명령**의 종료 코드로 정한다. 그래서 `pg_dump`가 실패해도 `gzip`이 빈 입력을 압축하고 0으로 끝나면, 파이프는 성공으로 처리된다. 스크립트 맨 위의 `set -euo pipefail`에서 `pipefail` 옵션은 이 규칙을 "0이 아닌 종료 코드 중 가장 오른쪽 값"으로 바꾼다([Bash 매뉴얼: Pipelines](https://www.gnu.org/software/bash/manual/html_node/Pipelines.html)).

![pg_dump가 1, gzip이 0으로 끝날 때 pipefail 유무에 따른 파이프 결과](./images/db-backup-pipefail.svg 'pipefail이 없으면 실패한 덤프가 성공으로 처리된다')

아래 [로컬 시험](#로컬-시험)의 "존재하지 않는 DB를 덤프하면 종료 코드 1로 끝나는지" 항목이 이 경우를 확인한다.

![백업 스크립트의 단계](./images/db-backup-flow.svg '덤프 → 확인 → 서버 7일 → 용량 상한 확인 → R2 30일 → 알림')

## R2 설정

비밀 값(키)은 모든 단계에서 **서버의 `~/deploy/backup.env`에만** 저장한다. 저장소 밖의 파일이고, 권한을 `600`으로 지정해 서버의 다른 사용자도 읽을 수 없다. `600`은 소유자만 읽기·쓰기가 가능하고 그룹과 다른 사용자는 아무 권한도 없다는 뜻의 리눅스 파일 권한이다.

### 버킷: Standard, 비공개

Cloudflare 대시보드의 R2에서 `macfolio-backups` 버킷을 생성한다([Cloudflare 문서: R2 시작하기](https://developers.cloudflare.com/r2/get-started/)).

- **저장 클래스는 Standard.** 백업은 조회 빈도가 낮아 Infrequent Access가 적합해 보이지만, R2의 무료 한도(매달 저장 10GB, 쓰기 작업 100만 회, 읽기 작업 1,000만 회)는 Standard에만 적용된다([Cloudflare 문서: R2 pricing](https://developers.cloudflare.com/r2/pricing/))
- **비공개로 유지한다.** 기본값이 비공개다. 공개하면 누구나 파일을 내려받아 읽기 작업 수를 늘릴 수 있다

> [!NOTE] 결제 수단 등록
> R2를 처음 활성화할 때 결제 수단 등록을 요구할 수 있다. 무료 한도 안이면 청구되지 않는다.

### 키: 이 버킷 하나로 범위 제한

R2 API 토큰을 생성할 때 권한은 **Object Read & Write**, 범위는 **이 버킷만**으로 선택한다([Cloudflare 문서: R2 API 토큰](https://developers.cloudflare.com/r2/api/tokens/)). 백업 스크립트는 업로드·목록 조회·삭제만 수행하므로 이 권한으로 충분하다. 키가 유출되어도 다른 버킷이나 Cloudflare의 다른 서비스에는 접근할 수 없다. 필요한 권한만 부여하는 이 원칙을 **최소 권한 원칙**이라고 한다.

생성하면 Access Key ID, Secret Access Key, S3 엔드포인트가 표시된다.

> [!WARNING] 한 번만 표시되는 Secret Access Key
> Secret Access Key는 이 화면에서만 표시되므로, 서버 설정을 마칠 때까지만 임시로 보관한다.

### rclone 1.59 이상

rclone은 S3·R2·Google Drive 같은 여러 저장소에 같은 명령(`copy`, `size`, `delete`)으로 파일을 올리고 관리하는 명령줄 도구다. 처음 문서에는 `sudo apt-get install rclone`으로 기록했다.

> [!WARNING] apt 저장소의 rclone 버전
> 그런데 rclone이 R2를 `provider=Cloudflare`로 지원하는 것은 1.59부터이고, Ubuntu 22.04의 apt 저장소에 있는 rclone은 1.53이다. 그래서 공식 설치 스크립트로 설치하고 `rclone version`으로 버전을 확인하도록 수정했다([rclone 문서: Cloudflare R2](https://rclone.org/s3/#cloudflare-r2)).

rclone 설정은 `rclone config` 파일 대신 `RCLONE_CONFIG_R2_*` 환경 변수로 전달한다([rclone 문서: 환경 변수로 설정하기](https://rclone.org/docs/#environment-variables)). 예를 들어 `RCLONE_CONFIG_R2_TYPE=s3`, `RCLONE_CONFIG_R2_PROVIDER=Cloudflare`를 지정하면 `r2:`라는 이름의 저장소가 정의된다. 키가 `backup.env` 한 파일에 모이고, 별도의 rclone 설정 파일이 없다.

### 연결 확인과 `lsd`의 403

스크립트를 실행하기 전에 rclone만으로 R2에 접근되는지 확인한다. 이 단계에서 문제를 찾으면 덤프·압축 단계의 오류와 섞이지 않아 원인을 바로 특정할 수 있다.

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

처음에는 연결 확인 명령으로 `rclone lsd r2:`(버킷 목록)를 기록했다. 서버에서 실행하자 이 명령만 `403 AccessDenied`를 반환하고, 바로 다음의 `rclone size r2:macfolio-backups`는 0을 반환했다. 버킷 목록 조회는 계정 전체 범위의 요청인데, 키 범위를 이 버킷 하나로 제한했으므로 거부되는 것이 정상이다. ==오류가 아니라 범위 제한이 의도대로 적용되었다는 뜻이다.== 그래서 연결 확인은 버킷을 직접 지정하는 명령으로만 한다.

## 무료 한도 보호: 8GB 상한

R2는 Standard 클래스에서 매달 저장 10GB, 쓰기 작업 100만 회, 읽기 작업 1,000만 회까지 무료이고, 외부 전송 요금은 없다. 하루 1회 업로드하고 30일치를 보관하므로 작업 횟수는 한 달에 수백 회로 한도와 거리가 멀다. 제약은 저장 크기다. 블로그 이미지가 DB에 저장되어 있어 DB가 커지면 백업 30개의 합이 10GB를 넘을 수 있다. 예를 들어 백업 하나가 350MB로 커지면 30개의 합은 10.5GB가 된다.

==R2에는 무료 한도를 넘기 전에 사용을 차단하는 설정이 없다.== 그래서 스크립트가 직접 차단한다. 기간이 지난 백업을 삭제한 뒤 `rclone size`로 버킷 전체 크기를 측정하고, 오늘 백업 크기를 더한 값이 상한(`MAX_REMOTE_GB`, 기본 8GB)을 넘으면 업로드하지 않고 실패 알림을 보낸다. 이 경우에도 오늘 백업은 서버에 보관된다. 알림을 받으면 보관 일수를 줄이거나 상한을 조정한다.

```bash
remote_bytes="$(rclone size --json "$BACKUP_REMOTE" | grep -o '"bytes":[0-9]*' | cut -d: -f2)" ||
	fail "서버 밖 저장소의 크기를 재지 못했다 ($BACKUP_REMOTE)"
file_bytes="$(wc -c <"$file" | tr -d ' ')"
limit_bytes=$((MAX_REMOTE_GB * 1024 * 1024 * 1024))
if ((remote_bytes + file_bytes > limit_bytes)); then
	fail "서버 밖 저장소가 상한(${MAX_REMOTE_GB}GB)을 넘게 된다 … 올리지 않았다"
fi
```

![서버에는 7일, R2에는 30일. R2 전체가 8GB를 넘게 되면 올리지 않고 알린다](./images/db-backup-retention.svg '보관 기간과 크기 상한. 상한은 R2 무료 10GB보다 낮게 설정했다')

첫 실행 뒤에는 `ls -lh ~/backups`로 **백업 파일 하나의 크기**를 확인한다. R2에는 30일치를 보관하므로, 이 크기 × 30이 상한보다 충분히 작아야 한다. 글과 이미지가 늘수록 이 값이 커진다.

## 실패·미실행 알림

cron은 작업이 실패해도 알리지 않는다. 디스크가 가득 차거나, 키가 만료되거나, 서버가 중지되어 몇 주 동안 백업이 생성되지 않아도 알 수 없다.

[healthchecks.io](https://healthchecks.io)는 이 문제를 반대 방향으로 해결한다. 작업이 "정상 종료했다"는 요청(ping)을 주기적으로 보내게 하고, 정해진 시간 안에 요청이 오지 않으면 알린다. 이런 방식을 데드맨 스위치(dead man's switch)라고 한다. 실패한 작업은 실패를 보고할 수 있지만, 서버가 꺼져 실행되지 않은 작업은 아무것도 보고하지 못하기 때문이다.

healthchecks.io에 Check를 하나 생성하고(주기 1일, 유예 1시간), Ping URL을 `BACKUP_PING_URL`에 지정한다. 스크립트는 성공하면 이 주소를, 실패하면 `주소/fail`을 요청한다. 주기와 유예 시간이 지나도 요청이 없으면 healthchecks.io가 메일을 보낸다. ==실패뿐 아니라 "실행되지 않음"도 검출하는 것==이 핵심이다.

![healthchecks.io가 알림을 보내는 세 경우](./images/r2-backup-setup-healthchecks.svg '성공은 알림 없음, 실패는 즉시, 실행되지 않으면 1일 + 1시간 후 알림')

| 상황                          | 스크립트가 보내는 요청 | healthchecks.io 동작         |
| ----------------------------- | ---------------------- | ---------------------------- |
| 10월 5일 03:30 백업 성공      | `Ping URL`             | 알림 없음                    |
| R2 업로드 실패                | `Ping URL/fail`        | 즉시 메일                    |
| 서버 중지로 cron이 실행 안 됨 | 없음                   | 마지막 요청 후 25시간에 메일 |

## cron 시각은 UTC 기준

```bash
30 3 * * * /home/ubuntu/macfolio/ops/backup.sh >> /home/ubuntu/deploy/backup.log 2>&1
```

cron 표기의 다섯 칸은 차례로 분, 시, 일, 월, 요일이다. `30 3 * * *`는 "매일 3시 30분"이다. 서버 시간대는 보통 UTC이므로 03:30은 한국 시간 12:30이다. `date`로 시간대를 먼저 확인한다. 출력은 `backup.log`에 누적되므로(`>>`는 덧붙이기, `2>&1`은 오류 출력도 같은 파일로), 알림을 받으면 이 로그에서 실패 단계를 확인한다.

## 복원 시험

백업 파일의 존재와 복원 가능 여부는 별개다. 압축이 정상이고 마지막 줄이 있어도, 복원 명령이 다른 DB 버전에서 실패하거나 권한 문제로 일부 테이블이 생성되지 않을 수 있다. 그래서 실제로 복원해 본다. `ops/restore.sh`는 백업 파일(또는 `r2:macfolio-backups/…` 경로)을 인자로 받아 복원한다.

- 실제 DB에 복원할 때는 확인 입력을 받고, 복원하는 동안 API 컨테이너를 중지했다가 다시 시작한다
- `DB_NAME`에 다른 이름을 지정하면 그 이름으로 DB를 새로 생성해 복원한다. 실제 DB를 변경하지 않고 백업을 시험할 수 있다

![restore.sh는 실제 DB면 확인 후 API를 멈추고, 다른 이름이면 새 DB를 만들어 복원한다](./images/db-backup-restore.svg 'DB_NAME에 따라 나뉘는 복원 경로와 trap 정리')

`restore.sh`도 `trap`으로 정리 작업을 실행한다. R2에서 내려받은 임시 파일을 삭제하고, 중지한 API를 성공·실패와 관계없이 다시 시작한다. 복원이 실패해도 API가 중지된 상태로 남지 않는다.

### 로컬 시험

로컬 DB로 다음 항목을 확인했다.

- 백업을 다른 DB에 복원하고, 테이블마다 행 수가 원본과 같은지
- 올린 파일(바이너리)과 글 본문의 해시가 원본과 같은지
- 존재하지 않는 DB를 덤프하면 종료 코드 1로 끝나고, `.partial` 파일이 남지 않는지
- R2 업로드가 실패하면 종료 코드 1로 끝나고, 서버의 백업 파일은 보관되는지 (rclone을 대체하는 가짜 명령으로 시험)
- 저장 크기가 상한을 넘게 되면 업로드하지 않고 종료 코드 1로 끝나며 알림 주소의 `/fail`에 요청하는지, 상한 값이 숫자가 아니면 중단하는지 (같은 방법으로 시험)

해시 비교는 행 수 비교로 확인하지 못하는 내용 손상을 검출한다. 예를 들어 이미지 `bytea` 값이 1바이트만 바뀌어도 행 수는 같지만 SHA-256 해시는 완전히 달라진다.

### 서버에서 다른 DB로 복원

서버에서는 실제 DB를 변경하지 않도록 다른 이름의 DB에 복원해, 글 수가 실제 DB와 같은지 확인한다. 최초 1회, 이후 월 1회 정도 실행한다.

```bash
cd ~/deploy
latest=$(ls -t ~/backups/macfolio-*.sql.gz | head -1)   # 가장 최근 백업
DB_NAME=restoretest ~/macfolio/ops/restore.sh "$latest"
docker compose exec -T db psql -U macfolio -d restoretest -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d macfolio    -c 'select count(*) from "Post"'   # 같아야 한다
docker compose exec -T db psql -U macfolio -d postgres    -c 'drop database restoretest'
```

서버에서 처음 실행한 결과는 다음과 같다.

| 항목             | 값                                                     |
| ---------------- | ------------------------------------------------------ |
| 백업 파일 하나   | 1007KB (글과 업로드 이미지가 모두 포함된 DB를 gzip -9) |
| 30일치 R2        | 약 30MB, 상한 8GB의 0.4% (무료 10GB)                   |
| 복원한 글 수     | `restoretest` 4개, 실제 DB 4개                         |
| 보관 기간        | 서버 7일, R2 30일                                      |
| `ops/backup.sh`  | 94줄 (현재. 첫 PR 이후 상한·배포 전 백업이 추가됨)     |
| `ops/restore.sh` | 62줄                                                   |

한 번은 복원 명령에 `~/backups/<파일>`을 그대로 붙여 넣었다. bash는 `<`와 `>`를 리디렉션 기호(파일을 명령의 입력·출력으로 연결하는 기호)로 해석해 문법 오류를 출력하고 복원을 실행하지 않았으며, 이어진 확인 명령은 "그런 DB가 없다"로 실패했다. 그래서 문서의 명령은 파일 이름을 직접 입력하지 않고 가장 최근 백업을 `ls -t`로 선택해 전달한다.

## 배포 전 백업에 재사용

백업 스크립트는 매일 실행하는 cron 외에 한 곳에서 더 사용한다. 서버 배포 스크립트 `ops/deploy.sh`가 새 API 이미지로 교체하기 직전에 `BACKUP_LOCAL_ONLY=1`로 실행한다. 마이그레이션(DB 테이블 구조를 바꾸는 SQL)이 DB를 손상시켜도 직전 상태로 복원하기 위해서다. 이 모드에서는 R2 업로드와 알림 요청을 하지 않는다. 배포 전 백업이 R2 용량 상한을 차지하지 않게 하기 위해서다.

첫 배포에서는 compose에 `API_TAG` 환경 변수가 전달되지 않아 배포 전 백업이 실패했다([#107](https://github.com/hyeoniverse/MacFolio/pull/107)). 백업이 실패하면 배포도 중단하도록 구성했기 때문에 이 문제가 배포 단계에서 드러났다. 이후 [되돌리기 훈련](/memo/rollback-drill)에서 의도적으로 실패하는 이미지를 배포한 시각에도, 배포 직전 백업이 정상적으로 하나 생성되었다.

## 선택 요약

| 선택                       | 이유                                        |
| -------------------------- | ------------------------------------------- |
| `pg_dump` + gzip           | SQL 파일 하나로 어디서든 복원한다           |
| 끝까지 기록된 덤프만 보관  | 중간에 끊긴 파일을 백업으로 오인하지 않는다 |
| R2 Standard 클래스         | 무료 한도는 Standard에만 있다               |
| 비공개 버킷                | 외부에서 읽어 작업 수를 늘리지 못하게       |
| 버킷 하나에만 읽기·쓰기 키 | 키가 유출되어도 피해가 이 버킷에 한정       |
| rclone 1.59 이상           | 이전 버전에는 R2 공급자가 없다              |
| 연결 먼저 확인             | 연결 문제를 덤프 오류와 분리해 찾는다       |
| 저장소 상한 8GB            | R2에는 한도 초과 전 차단 설정이 없다        |
| healthchecks 알림          | 실패와 "실행되지 않음"을 모두 검출          |
| 다른 DB에 복원             | 복원 가능 여부를 실제로 검증한다            |

## 남은 과제와 정리

- 하루 1회 백업이라 마지막 백업 이후 작성한 글은 유실될 수 있다. 일부 글은 저장소의 Markdown에도 있지만, 서버에서 수정한 글·댓글·메시지는 DB에만 있다. 현재 작성량에서는 감수할 수 있는 범위다.
- 복원 시험은 수동으로 실행한다. R2의 최신 백업을 다른 DB 이름으로 복원해 행 수를 비교하는 작업을 cron으로 자동화할 수 있다.
- 업로드한 이미지가 DB 안에 `bytea`로 저장되어 있어 백업 크기는 이미지 용량에 비례해 증가한다. 이미지를 R2 같은 객체 저장소로 옮기면 백업 크기도 줄어든다.
- `rclone lsd`가 403을 반환한 것처럼, 권한을 제한한 키에는 실패가 정상인 명령이 있다. 문서의 확인 명령은 그 키로 성공해야 하는 명령만 기록해야 한다.
- 문서에 `<파일>` 같은 자리표시를 두면 그대로 붙여 넣는 실수가 생긴다. 명령이 값을 직접 선택하게(`ls -t | head -1`) 하는 편이 안전하다.

==백업에서 가장 위험한 상태는 실패를 아무도 인지하지 못하는 상태다.== cron은 실패를 알리지 않고, 중간에 끊긴 덤프도 파일로는 남는다. 그래서 덤프 완료 검사와 실패 알림 요청이 스크립트의 절반을 차지한다.

## 적용 방법

준비물: Cloudflare R2 버킷과 그 버킷 하나에만 권한을 준 API 토큰, 서버의 [rclone](https://rclone.org/s3/#cloudflare-r2) 1.59 이상, healthchecks.io Check 하나. 전체 순서(10단계)는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '백업'(8. cron, 9. 되살리기 시험, 10. 사용량 알림)에 있다.

```bash
# 서버에서 한 번 실행해 확인
~/macfolio/ops/backup.sh
# … 백업 완료: /home/ubuntu/backups/macfolio-…sql.gz
# … 올림: r2:macfolio-backups/macfolio-…sql.gz (저장소 …MB / 상한 8GB)

# 매일 03:30 UTC (12:30 KST)
crontab -e
30 3 * * * /home/ubuntu/macfolio/ops/backup.sh >> /home/ubuntu/deploy/backup.log 2>&1
```

실제 DB를 복원할 때는 `~/macfolio/ops/restore.sh`에 백업 파일 경로나 `r2:` 경로를 넘겨 실행한다. 확인 입력을 받고, 복원하는 동안 API를 중지했다가 다시 시작한다.

스크립트: [ops/backup.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/backup.sh), [ops/restore.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/restore.sh).

## 관련 글

- [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)
- [command= 제한 SSH 키와 GHCR 이미지로 하는 API 자동 배포와 롤백](/memo/api-auto-deploy)
- [HEALTHCHECK가 실패하는 이미지로 자동 배포 롤백 훈련하기](/memo/rollback-drill)

[^idle]: Oracle Cloud Always Free 인스턴스는 7일 동안 CPU·네트워크·메모리 사용률이 낮으면 유휴 인스턴스로 판단해 회수할 수 있다. [Oracle 문서: Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

[^wal]: Write-Ahead Log. PostgreSQL이 데이터 파일을 변경하기 전에 변경 내용을 먼저 기록하는 로그. 기본 백업과 WAL을 함께 보관하면 특정 시각으로 복원(PITR)할 수 있다. [PostgreSQL 문서: Continuous Archiving](https://www.postgresql.org/docs/current/continuous-archiving.html)

[^r2]: Cloudflare의 S3 호환 객체 저장소. S3 API를 그대로 사용하므로 rclone의 S3 백엔드로 접근한다. [Cloudflare 문서: R2](https://developers.cloudflare.com/r2/)

<details>
<summary>참고 문헌</summary>

- [PostgreSQL 문서: SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)
- [PostgreSQL 문서: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL 문서: Continuous Archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Bash 매뉴얼: Pipelines](https://www.gnu.org/software/bash/manual/html_node/Pipelines.html)
- [Bash 매뉴얼: Bourne Shell Builtins (trap)](https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html)
- [crontab(5) 매뉴얼](https://man7.org/linux/man-pages/man5/crontab.5.html)
- [Cloudflare 문서: R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare 문서: R2 API 토큰](https://developers.cloudflare.com/r2/api/tokens/)
- [rclone 문서: S3(Cloudflare R2) 설정](https://rclone.org/s3/#cloudflare-r2)
- [Healthchecks.io 문서](https://healthchecks.io/docs/)

</details>

#MacFolio #서버 #백업 #Cloudflare
