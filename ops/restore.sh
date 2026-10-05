#!/usr/bin/env bash
# 백업 되살리기: ops/restore.sh <백업.sql.gz> [--yes]
#   rclone 경로도 된다 (예: r2:macfolio-backups/macfolio-2026-10-05T033000Z.sql.gz). 받아 와서 되살린다.
#
# 실제 DB(기본 macfolio)에 되살릴 때는 확인을 받고, 그동안 API를 멈췄다가 다시 띄운다.
# DB_NAME에 다른 이름을 주면 그 DB를 새로 만들어 되살린다 (실제 DB를 건드리지 않고 백업을 시험할 때).
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
API_SERVICE="${API_SERVICE:-api}"
DB_USER="${DB_USER:-macfolio}"
LIVE_DB="${LIVE_DB:-macfolio}"
DB_NAME="${DB_NAME:-$LIVE_DB}"

source_file="${1:-}"
[[ -n "$source_file" ]] || { echo "쓰는 법: $0 <백업.sql.gz | rclone 경로> [--yes]" >&2; exit 2; }
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# 끝날 때 (성공이든 실패든): 받아 온 파일을 지우고, 멈춘 API를 다시 띄운다
work=""
stopped_api=""
cleanup() {
	[[ -n "$work" ]] && rm -rf "$work"
	[[ -n "$stopped_api" ]] && compose start "$API_SERVICE"
	return 0
}
trap cleanup EXIT
psql_in() { compose exec -T "$DB_SERVICE" psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" "$@"; }

# rclone 경로면 받아 온다
if [[ "$source_file" == *:* && ! -f "$source_file" ]]; then
	work="$(mktemp -d)"
	rclone copy "$source_file" "$work"
	source_file="$work/$(basename "$source_file")"
fi
gzip -t "$source_file"

if [[ "$DB_NAME" == "$LIVE_DB" ]]; then
	if [[ "${2:-}" != "--yes" ]]; then
		read -r -p "실제 DB '$LIVE_DB'를 '$(basename "$source_file")'의 내용으로 바꿉니다. 계속할까요? (yes) " answer
		[[ "$answer" == "yes" ]] || { echo "그만둠"; exit 1; }
	fi
	# 되살리는 동안 API가 쓰지 않게 멈춘다 (없는 서비스면 건너뛴다)
	if compose ps --services | grep -qx "$API_SERVICE"; then
		compose stop "$API_SERVICE"
		stopped_api=1
	fi
else
	psql_in -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\"" -c "CREATE DATABASE \"$DB_NAME\""
fi

# 덤프 안의 SELECT 결과(set_config 등)는 버리고, 오류만 보인다
gunzip -c "$source_file" | psql_in -d "$DB_NAME" --single-transaction >/dev/null
echo "되살림: $(basename "$source_file") → $DB_NAME"
