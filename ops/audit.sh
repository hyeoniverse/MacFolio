#!/usr/bin/env bash
# 서버 하드닝 점검: SSH는 키로만, 열린 포트는 22뿐, 컨테이너는 root가 아닌 사용자로, 자동 보안 업데이트 (#150).
# 서버(ubuntu)에서 돌린다: ~/macfolio/ops/audit.sh
# 바꾸는 것은 없다. 항목마다 OK / 확인 을 찍고, 확인이 하나라도 있으면 1로 끝난다 (docs/deployment.md '서버 하드닝 점검').
#
# 설정 (생략 가능)
#   DEPLOY_DIR   compose.yml이 있는 곳 (기본 ~/deploy)
#   SSH_PORT     SSH 포트 (기본 22)
set -uo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/deploy}"
SSH_PORT="${SSH_PORT:-22}"
failed=0

ok()   { printf '  OK    %s\n' "$1"; }
warn() { printf '  확인  %s\n' "$1"; failed=1; }

# sshd의 실제 설정값 (sshd_config.d/*.conf까지 합친 결과). sudo가 없으면 빈 값
sshd_value() { sudo sshd -T 2>/dev/null | awk -v key="$1" '$1 == key { print $2; exit }'; }

echo "[SSH] 키로만 접속"
pw="$(sshd_value passwordauthentication)"
[[ "$pw" == "no" ]] && ok "PasswordAuthentication no" || warn "PasswordAuthentication=${pw:-?} (no여야 한다)"
root_login="$(sshd_value permitrootlogin)"
case "$root_login" in
	no | prohibit-password | without-password) ok "PermitRootLogin $root_login" ;;
	*) warn "PermitRootLogin=${root_login:-?} (no 또는 prohibit-password여야 한다)" ;;
esac
kb="$(sshd_value kbdinteractiveauthentication)"
[[ "$kb" == "no" ]] && ok "KbdInteractiveAuthentication no" || warn "KbdInteractiveAuthentication=${kb:-?} (no여야 한다: 비밀번호 질문의 다른 경로)"
# 비밀번호가 잠긴 계정만 (passwd -S: L=잠김, P=비밀번호 있음, NP=없음)
unlocked="$(sudo passwd -Sa 2>/dev/null | awk '$2 == "P" { print $1 }' | tr '\n' ' ')"
[[ -z "$unlocked" ]] && ok "비밀번호가 설정된 계정 없음" || warn "비밀번호로 들어올 수 있는 계정: $unlocked"

echo "[포트] 바깥에서 듣는 것"
# 0.0.0.0 / [::] / 공인 IP로 듣는 TCP·UDP. 루프백(127.x, ::1: systemd-resolved의 53 등)과 docker 내부 주소는 제외
listening="$(ss -Hlntu 2>/dev/null | awk '{ print $1, $5 }' | grep -Ev '(^| )(127\.|\[::1\]|172\.(1[6-9]|2[0-9]|3[01])\.)' | sort -u)"
# SSH, DHCP 클라이언트(68/546)는 정상. 그 밖의 것(예: 111 rpcbind)은 확인
others="$(printf '%s\n' "$listening" | grep -Ev ":${SSH_PORT}\$" | grep -Ev '^udp .*:(68|546)$' || true)"
[[ -n "$listening" ]] && printf '%s\n' "$listening" | sed 's/^/        /'
[[ -z "$others" ]] && ok "SSH(${SSH_PORT}) 말고 바깥에서 듣는 포트 없음" || warn "SSH 말고 바깥에서 듣는 포트가 있다 (위 목록. 111은 rpcbind: sudo systemctl disable --now rpcbind.socket rpcbind.service)"
# docker가 호스트 포트를 연 컨테이너
published="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '0\.0\.0\.0|:::' || true)"
[[ -z "$published" ]] && ok "호스트 포트를 연 컨테이너 없음 (api·db는 compose 네트워크 안에서만)" || warn "호스트 포트를 연 컨테이너: $published"
# 호스트 방화벽: Oracle Ubuntu 이미지는 iptables로 22만 허용. ufw를 쓰면 ufw 상태를 본다
if command -v ufw >/dev/null && sudo ufw status 2>/dev/null | grep -q '^Status: active'; then
	ok "ufw 활성 ($(sudo ufw status | grep -c ALLOW)개 허용 규칙)"
elif command -v iptables >/dev/null && sudo iptables -S INPUT 2>/dev/null | grep -qE -- "--dport ${SSH_PORT} .*-j ACCEPT"; then
	ok "iptables INPUT에 ${SSH_PORT} 허용 규칙이 있다 (Oracle 기본). 클라우드 Security List도 22만 여는지 콘솔에서 확인한다"
elif command -v nft >/dev/null && sudo nft list ruleset 2>/dev/null | grep -qE "dport ${SSH_PORT} .*accept"; then
	ok "nftables에 ${SSH_PORT} 허용 규칙이 있다. 클라우드 Security List도 22만 여는지 콘솔에서 확인한다"
elif ! command -v iptables >/dev/null && ! command -v nft >/dev/null; then
	ok "호스트 방화벽 도구(iptables/nft)가 없다: 바깥은 클라우드 Security List가 거른다. 22만 여는지 콘솔에서 확인한다"
else
	warn "호스트 방화벽(iptables/nft/ufw) 규칙을 읽지 못했다"
fi

echo "[컨테이너] root가 아닌 사용자"
if [[ -f "$DEPLOY_DIR/compose.yml" ]]; then
	for service in api db tunnel; do
		cid="$(docker compose -f "$DEPLOY_DIR/compose.yml" ps -q "$service" 2>/dev/null)"
		if [[ -z "$cid" ]]; then warn "$service 컨테이너가 떠 있지 않다"; continue; fi
		# 이미지가 정한 사용자 (cloudflared처럼 sh·id가 없는 distroless 이미지도 읽힌다). 비어 있으면 root
		user="$(docker inspect --format '{{.Config.User}}' "$cid" 2>/dev/null)"
		user="${user%%:*}"
		[[ -z "$user" ]] && user="$(docker exec "$cid" id -un 2>/dev/null || echo root)"
		[[ "$user" == "65532" ]] && user=nonroot
		case "$service:$user" in
			api:node | tunnel:nonroot | db:postgres | db:root) ok "$service → $user" ;;
			*:root | *:0 | *:\?) warn "$service → ${user} (api는 node, tunnel은 nonroot여야 한다)" ;;
			*) ok "$service → $user" ;;
		esac
		priv="$(docker inspect --format '{{.HostConfig.Privileged}}' "$cid")"
		[[ "$priv" == "false" ]] && ok "$service privileged 아님" || warn "$service 가 privileged로 떠 있다"
	done
else
	warn "$DEPLOY_DIR/compose.yml 이 없다 (DEPLOY_DIR 확인)"
fi
sock="$(docker ps --format '{{.Names}}: {{.Mounts}}' 2>/dev/null | grep docker.sock || true)"
[[ -z "$sock" ]] && ok "docker.sock을 마운트한 컨테이너 없음" || warn "docker.sock을 마운트한 컨테이너: $sock (호스트 root와 같다)"

echo "[업데이트] 자동 보안 업데이트"
if dpkg -s unattended-upgrades >/dev/null 2>&1 && grep -qsE '^APT::Periodic::Unattended-Upgrade "1";' /etc/apt/apt.conf.d/20auto-upgrades; then
	ok "unattended-upgrades 켜짐"
else
	warn "unattended-upgrades가 꺼져 있다 (sudo dpkg-reconfigure -plow unattended-upgrades)"
fi
if [[ -f /var/run/reboot-required ]]; then
	warn "커널 업데이트 뒤 재부팅이 필요하다 (sudo reboot; 터널과 컨테이너는 restart: unless-stopped로 다시 뜬다)"
else
	ok "재부팅 대기 없음"
fi

echo
if [[ $failed -eq 0 ]]; then echo "모두 OK"; else echo "확인 항목이 있다 (docs/deployment.md '서버 하드닝 점검')"; fi
exit $failed
