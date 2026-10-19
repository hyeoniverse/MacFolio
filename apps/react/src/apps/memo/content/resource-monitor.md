---
title: 무료 서버가 회수되기 전에 - 사용률을 재고 위험하면 메일로
date: 2026-10-10
category: 개발기/MacFolio/백엔드
summary: Oracle Always Free 서버는 7일 동안 놀면 회수될 수 있다. 컨테이너 안에서 /proc를 1분마다 읽어 CPU·메모리·네트워크를 남기고, 한 시간마다 회수 위험을 계산해 위험하면 3일에 한 번까지 메일을 보낸다. 그래프 선이 63%에서 끊기던 버그도 함께 고쳤다.
---

API 서버는 Oracle Cloud의 Always Free 인스턴스(E2.1.Micro, 1GB)에서 돈다. 무료인 대신 조건이 하나 있다. 7일 동안 사용률이 모두 낮으면 Oracle이 "놀고 있는 서버"로 보고 회수할 수 있다.

| 기준 (7일)      | 회수 대상       |
| --------------- | --------------- |
| CPU 95퍼센타일  | 20% 미만        |
| 네트워크 사용률 | 20% 미만        |
| 메모리 사용률   | 20% 미만 (A1만) |

개인 포트폴리오의 API는 방문이 많지 않아 CPU를 거의 쓰지 않을 가능성이 크다. 회수되면 다시 만들 수는 있지만(서버 구성 문서와 R2 백업), 그동안 로그인·메시지·댓글이 멈춘다. 그래서 위험을 미리 보고 알림을 받게 했다.

## 고른 방법과 버린 방법

사용률을 얻는 길은 셋이었다.

| 방법                                           | 좋은 점                                      | 걸린 점                                                                                     |
| ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Oracle Monitoring API로 Oracle이 잰 값 읽기    | Oracle이 회수 판단에 쓰는 바로 그 값         | API 키와 정책을 만들어야 하고, 요청마다 서명해야 한다. 코드가 기본으로 켜져 있기에는 무겁다 |
| node-exporter + Prometheus를 붙이기            | 그래프와 알림이 이미 다 있다                 | RAM 1GB 서버에 컨테이너 둘이 늘고, 보는 화면이 사이트 밖에 생긴다                           |
| API 컨테이너 안에서 `/proc`를 직접 읽기 (고름) | 새 키·새 컨테이너가 없다. 사이트 안에서 본다 | Oracle이 잰 값과 같다는 보장이 없다. 그래서 일찍 알리는 쪽으로 계산한다                     |

Oracle API는 나중에 종량제 요금과 예산을 보여 줄 때 결국 붙였다. 요청 서명을 직접 구현했고, 그 이야기는 따로 적었다([종량제 요금과 예산 한도](/memo/oci-billing)). 사용률만큼은 `/proc`로 충분했다.

## 무엇을 재나

API 컨테이너 안에서 `/proc`를 1분마다 읽는다.

| 값       | 읽는 곳         | 계산                                               |
| -------- | --------------- | -------------------------------------------------- |
| CPU      | `/proc/stat`    | 두 번 읽은 사이에 쉬지 않은 시간의 비율            |
| 메모리   | `/proc/meminfo` | `MemTotal`에서 `MemAvailable`을 뺀 비율            |
| 네트워크 | `/proc/net/dev` | 두 번 읽은 사이에 주고받은 바이트 → Mbps (lo 제외) |

Docker 컨테이너 안에서도 `/proc/stat`과 `/proc/meminfo`는 VM 전체 값을 보여 준다(lxcfs 같은 것을 쓰지 않는 한). 그래서 compose에 호스트의 `/proc`를 붙이지 않아도 된다. 네트워크는 컨테이너마다 따로라서 API 컨테이너가 주고받은 양만 보이는데, 방문 트래픽은 모두 Cloudflare Tunnel을 거쳐 API로 오므로 흐름은 비슷하다.

읽는 코드는 바깥 호출 없이 시험할 수 있게 순수 함수로 두었다(`apps/api/src/resources/rules.ts`). CPU는 `/proc/stat`의 `cpu` 줄에서 쓴 시간과 쉰 시간을 나눈다.

```ts
export function parseCpuTimes(stat: string): CpuTimes | null {
	const line = stat.split('\n').find((row) => row.startsWith('cpu '));
	if (!line) return null;
	// user nice system idle iowait irq softirq steal (guest·guest_nice는 user에 이미 들어 있다)
	const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = line
		.trim()
		.split(/\s+/)
		.slice(1)
		.map(Number);
	if ([user, nice, system, idle].some((value) => !Number.isFinite(value))) return null;
	return { busy: user + nice + system + irq + softirq + steal, idle: idle + iowait };
}

export function cpuPercent(before: CpuTimes, after: CpuTimes): number | null {
	const busy = after.busy - before.busy;
	const total = busy + (after.idle - before.idle);
	return total > 0 ? round((busy / total) * 100) : null;
}
```

`iowait`(디스크를 기다린 시간)는 쉰 시간에, `steal`(하이퍼바이저가 다른 VM에 내준 시간)은 쓴 시간에 넣는다.

사용률은 두 번 읽은 차이로 구하므로 처음 읽은 값은 기준으로만 쓰고 남기지 않는다. 컨테이너가 다시 뜨면 네트워크 카운터가 0부터 다시 세는데, 이때는 값이 거꾸로 가서 그 한 번을 버린다.

## 위험 계산

Oracle은 CPU를 95퍼센타일로 본다고 적어 두었지만, 네트워크와 메모리는 어떻게 세는지 적혀 있지 않다. 평균으로 잰다. 95퍼센타일보다 낮게 나오므로, 위험을 놓치기보다 일찍 알리는 쪽이다.

- **회수 위험:** 모든 기준이 20% 미만
- **주의:** 모든 기준이 30% 미만
- **안전:** 그 밖

7일치가 쌓이기 전에는 그동안의 값으로 미리 보고, 화면에 "2일치로 미리 본 값"처럼 적는다.

![기준마다 7일 값을 20%와 30%에 대 보는 세 단계](./images/resource-monitor-levels.svg '모두 20% 아래면 회수 위험, 모두 30% 아래면 주의')

네트워크 사용률은 shape의 대역폭에 대한 비율이다. E2.1.Micro는 50Mbps로 두고(`RESOURCE_NETWORK_MBPS`), 메모리 조건은 A1 shape에만 있어서 `/\.A1\./`로 shape 이름을 보고 켠다.

```ts
const level = conditions.every((condition) => condition.below)
	? 'danger'
	: conditions.every((condition) => condition.value < condition.threshold + WARNING_MARGIN)
		? 'warning'
		: 'safe';
```

표본은 `ResourceSample` 테이블에 1분에 한 줄씩 남고, 14일이 지나면 지운다. 하루 1,440줄, 14일이면 2만 줄 남짓이라 1GB 서버의 Postgres에도 부담이 없다.

![/proc를 1분마다 읽어 표본을 남기고 1시간마다 위험을 계산해 3일에 한 번까지 메일을 보내는 흐름](./images/resource-monitor-flow.svg '재기, 판정하기, 알리기의 주기가 다르다')

## 알림 메일

한 시간마다 위험을 다시 계산해 '회수 위험'이면 메일을 보낸다. 메일은 연락 메일과 같은 Resend로 보낸다. 이 기회에 연락 메일 서비스 안에 있던 Resend 호출을 `common/resend.ts`로 꺼내 둘이 함께 쓰게 했다.

위험이 며칠씩 이어질 수 있어서, 같은 알림은 **3일에 한 번**까지만 보낸다. 마지막으로 보낸 때는 메모리가 아니라 DB(`ResourceAlert`)에 남긴다. 배포할 때마다 컨테이너가 다시 뜨는데, 메모리에 두면 배포할 때마다 같은 메일이 다시 간다.

```ts
// apps/api/src/resources/resources.service.ts
const last = await this.prisma.resourceAlert.findUnique({ where: { kind: 'reclaim' } });
if (last && now.getTime() - last.sentAt.getTime() < REALERT_MS) return false; // 3일
```

메일 본문에는 기준마다 지금 값과 기준, 그리고 "계정을 Pay As You Go로 올리면 회수 대상에서 빠진다"는 해결 방법을 함께 적는다. 메일만 보고도 무엇을 해야 할지 알 수 있게 했다.

## 켜고 끄기

이 저장소를 가져다 다른 서버에 올리는 사람도 있을 수 있고, 계정을 종량제로 올리면 회수 걱정이 없어진다. 그래서 환경 변수 하나로 정한다.

```bash
RESOURCE_MONITOR=off    # 기본: 재지 않는다
RESOURCE_MONITOR=free   # Always Free: 재고, 위험을 계산하고, 알린다
RESOURCE_MONITOR=payg   # 종량제: 재고 보여 주기만 한다
```

## 서버 탭

'활동 상태 보기'에 관리자만 보는 **서버** 탭을 더했다. 요금제와 shape, 회수 위험, 알림 메일 상태, 기준마다 지금 값, 최근 7일 CPU·메모리·네트워크 그래프가 나온다. 그래프에는 회수 기준(20%)을 점선으로 그어, 선이 그 아래에 붙어 있으면 위험하다는 것이 한눈에 보이게 했다.

메뉴 막대의 배터리 아이콘도 이 값을 쓴다. 관리자에게는 회수에서 먼 만큼 차오르고, 누르면 사용률과 위험, 서버 탭으로 가는 길이 나온다([메뉴 막대의 배터리로 서버 자원과 방문 추이 보기](/memo/battery-server-resources)).

## 그래프를 그리다 찾은 버그

서버 탭 그래프의 선이 왼쪽 63%에서 끊겼다. 개요 탭의 방문 그래프도 그랬다. 아래를 칠한 영역은 끝까지 가는데 선만 끊겼다.

선이 왼쪽부터 그려지는 효과를 `pathLength="1"`과 `stroke-dasharray: 1`로 만들었는데, 선 두께가 늘어나지 않게 `vector-effect: non-scaling-stroke`도 함께 썼다. 이 둘을 같이 쓰면 점선 길이가 화면 기준으로 계산된다. 그래프 SVG는 600 폭으로 그린 것을 화면 폭(약 950px)에 맞게 가로로 늘리므로, 선 길이를 1로 본 점선이 600/950 ≈ 63%에서 끝났다.

같은 이유로 순방문자 선도 점선(`4 3`)이어야 하는데 실선으로 보였다. `pathLength="1"`이면 점선 간격 4가 선 전체 길이의 네 배가 된다.

![pathLength와 non-scaling-stroke가 겹쳐 선이 63%에서 끝나는 까닭](./images/resource-monitor-line-bug.svg '늘린 SVG에서는 점선 길이가 화면 기준으로 계산된다')

선을 그리는 효과를 점선이 아니라 왼쪽부터 드러내는 `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)`으로 바꾸고 `pathLength`를 뺐다. 이제 선이 끝까지 가고, 순방문자는 점선으로 보인다.

```css
/* apps/react/src/styles/motion.css */
@keyframes draw-line {
	from {
		clip-path: inset(0 100% 0 0);
	}
	to {
		clip-path: inset(0 0 0 0);
	}
}
```

이 효과는 공통 움직임 파일에 두어서, 개요 탭의 방문 그래프와 서버 탭 그래프가 함께 고쳐졌다.

## 시험

- 단위(`apps/api/src/resources/rules.test.ts`, 11개): `/proc` 글자 읽기, 95퍼센타일, 위험 단계 (E2·A1, 7일 밖 표본 버리기), 한 시간 단위로 묶기, 모드 읽기
- API e2e(`apps/api/test/resources.e2e.test.ts`): 꺼져 있으면 모드만, 관리자가 아니면 401, 가짜 `/proc`로 표본 남기기, 7일 동안 낮으면 위험·메일 한 통, 3일 안에는 다시 안 보내고 3일 뒤 다시, 넉넉하면 안 보냄, 14일 지난 표본 지우기
- 화면 E2E: 서버 탭의 위험·기준 표·그래프, 꺼져 있을 때 켜는 방법, 방문자에게는 잠김

종량제일 때 요금과 예산 한도를 보여 주는 것은 Oracle의 요금 API를 불러야 해서 다음 단계로 나눴다.

## 남은 것과 배운 것

- **잰 값은 Oracle의 값이 아니다.** 컨테이너의 네트워크는 API 컨테이너가 주고받은 양뿐이고, 네트워크·메모리는 평균으로 잰다. 그래서 일찍 알리는 쪽으로 계산했지만, 실제로 회수된 적이 없어 얼마나 일찍인지는 모른다.
- **배포 사이의 공백.** 컨테이너가 다시 뜨면 첫 표본은 기준으로만 쓰므로 배포마다 1분이 빈다. 하루 1,440개 중 몇 개라 위험 계산에는 영향이 없다.
- **상태는 DB에.** 배포할 때마다 다시 뜨는 서버에서 "마지막으로 한 때"는 메모리에 두면 안 된다. 업타임 감시나 다른 알림을 만들 때도 같은 기준을 쓴다.
- **효과는 실제 크기로 본다.** 그래프 버그는 SVG를 늘려 그리는 실제 화면에서만 났다. 같은 폭으로 그린 시험 화면에서는 보이지 않았다.

관련 글: [서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게](/memo/server-uptime-and-logs) · [종량제 요금과 예산 한도](/memo/oci-billing) · [메뉴 막대의 배터리로 서버 자원과 방문 추이 보기](/memo/battery-server-resources).

#MacFolio #백엔드 #Oracle #서버
