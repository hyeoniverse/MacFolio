#!/usr/bin/env bash
# DB 백업: pg_dump → gzip → 검사 → 서버에 KEEP_LOCAL_DAYS일 보관 → (설정하면) rclone으로 서버 밖(R2)에 올리고 오래된 것 삭제.
# 서버의 cron이 매일 부른다 (docs/deployment.md '백업'). 블로그 글·임시 저장·버전·올린 파일이 모두 DB에 있다.
#
# 설정 (모두 생략 가능, ~/deploy/backup.env가 있으면 먼저 읽는다)
#   COMPOSE_FILE      compose 파일 (기본 ~/deploy/compose.yml)
#   DB_SERVICE        DB 서비스 이름 (기본 db), DB_USER·DB_NAME (기본 macfolio)
#   BACKUP_DIR        서버에 남길 곳 (기본 ~/backups), KEEP_LOCAL_DAYS (기본 7)
#   BACKUP_REMOTE     rclone 대상 (예: r2:macfolio-backups). 비우면 올리지 않는다
#   KEEP_REMOTE_DAYS  서버 밖에 남길 날 수 (기본 30)
#   MAX_REMOTE_GB     서버 밖 저장소에 둘 최대 크기 (기본 8). 오늘 백업을 더하면 넘을 때는 올리지 않고 실패로 알린다
#                     (R2 무료 한도 10GB에 닿기 전에 멈춰서 요금이 생기지 않게. R2에는 청구 전에 멈추는 설정이 없다)
#   BACKUP_PING_URL   성공하면 이 주소를, 실패하면 주소/fail을 부른다 (healthchecks.io 등. 백업이 조용히 멈추지 않게)
#   BACKUP_LOCAL_ONLY 1이면 서버에만 남기고 올리지도 알리지도 않는다 (배포 직전 백업: ops/deploy.sh. 매일 백업은 cron이 한다)
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/deploy}"
if [[ -f "$DEPLOY_DIR/backup.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "$DEPLOY_DIR/backup.env"
	set +a
fi

COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-macfolio}"
DB_NAME="${DB_NAME:-macfolio}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
KEEP_REMOTE_DAYS="${KEEP_REMOTE_DAYS:-30}"
MAX_REMOTE_GB="${MAX_REMOTE_GB:-8}"
BACKUP_PING_URL="${BACKUP_PING_URL:-}"
if [[ "${BACKUP_LOCAL_ONLY:-}" == 1 ]]; then
	BACKUP_REMOTE=""
	BACKUP_PING_URL=""
fi

log() { echo "$(date -u +%FT%TZ) $*"; }

ping_url() {
	[[ -n "$BACKUP_PING_URL" ]] || return 0
	curl -fsS -m 10 --retry 3 "$BACKUP_PING_URL$1" >/dev/null || log "알림 주소를 부르지 못함 (백업 결과와 상관없음)"
}

fail() {
	log "백업 실패: $1" >&2
	ping_url /fail
	exit 1
}

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
file="$BACKUP_DIR/$DB_NAME-$stamp.sql.gz"
partial="$file.partial"
mkdir -p "$BACKUP_DIR"
trap 'rm -f "$partial"' EXIT

# --clean --if-exists: 되살릴 때 있던 표를 먼저 지운다. --no-owner: 다른 사용자 이름으로도 되살린다
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
	pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner |
	gzip -9 >"$partial" || fail "pg_dump"

# 압축이 온전하고, 덤프가 끝까지 쓰였는지 (중간에 끊긴 파일을 백업으로 남기지 않는다)
gzip -t "$partial" || fail "압축 파일이 깨졌다"
gunzip -c "$partial" | tail -n 5 | grep -q 'PostgreSQL database dump complete' || fail "덤프가 끝까지 쓰이지 않았다"
mv "$partial" "$file"
log "백업 완료: $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name "$DB_NAME-*.sql.gz" -mtime +"$KEEP_LOCAL_DAYS" -print -delete | sed 's/^/지움: /'

if [[ -n "$BACKUP_REMOTE" ]]; then
	# 오래된 것부터 지우고 나서 크기를 잰다 (지울 수 있는 자리는 먼저 비운다)
	rclone delete "$BACKUP_REMOTE" --min-age "${KEEP_REMOTE_DAYS}d" --include "$DB_NAME-*.sql.gz" ||
		fail "서버 밖의 오래된 백업을 지우지 못했다"

	# 저장소 전체 크기 + 오늘 백업이 상한을 넘으면 올리지 않는다. 오늘 백업은 서버에는 남아 있다
	[[ "$MAX_REMOTE_GB" =~ ^[0-9]+$ ]] || fail "MAX_REMOTE_GB는 GB 단위 정수여야 한다: $MAX_REMOTE_GB"
	remote_bytes="$(rclone size --json "$BACKUP_REMOTE" | grep -o '"bytes":[0-9]*' | cut -d: -f2)" ||
		fail "서버 밖 저장소의 크기를 재지 못했다 ($BACKUP_REMOTE)"
	[[ -n "$remote_bytes" ]] || fail "서버 밖 저장소의 크기를 읽지 못했다 ($BACKUP_REMOTE)"
	file_bytes="$(wc -c <"$file" | tr -d ' ')"
	limit_bytes=$((MAX_REMOTE_GB * 1024 * 1024 * 1024))
	if ((remote_bytes + file_bytes > limit_bytes)); then
		fail "서버 밖 저장소가 상한(${MAX_REMOTE_GB}GB)을 넘게 된다: 지금 $((remote_bytes / 1024 / 1024))MB + 오늘 $((file_bytes / 1024 / 1024))MB. 올리지 않았다 (KEEP_REMOTE_DAYS를 줄이거나 MAX_REMOTE_GB를 늘린다)"
	fi

	rclone copy "$file" "$BACKUP_REMOTE" || fail "서버 밖으로 올리지 못했다 ($BACKUP_REMOTE)"
	log "올림: $BACKUP_REMOTE/$(basename "$file") (저장소 $(((remote_bytes + file_bytes) / 1024 / 1024))MB / 상한 ${MAX_REMOTE_GB}GB)"
else
	log "BACKUP_REMOTE가 없어 서버에만 남겼다"
fi

ping_url ""
