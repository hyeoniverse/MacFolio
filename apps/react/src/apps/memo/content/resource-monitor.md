---
title: Oracle Always Free 회수를 막는 /proc 사용률 측정과 위험 메일 알림
date: 2026-10-10
category: 개발 기록/MacFolio/배포·운영
series: 서버 운영
seriesOrder: 4
summary: Oracle Always Free 서버는 7일 동안 유휴 상태면 회수될 수 있다. 컨테이너 안에서 /proc를 1분마다 읽어 CPU·메모리·네트워크를 기록하고, 한 시간마다 회수 위험을 계산해 위험하면 3일에 한 번까지 메일을 보낸다. 그래프 선이 63%에서 끊기던 버그도 함께 수정했다.
---

## 배경: Always Free 인스턴스의 유휴 회수

API 서버는 Oracle Cloud의 Always Free 인스턴스(`VM.Standard.E2.1.Micro`, 메모리 1GB)에서 실행된다. Always Free는 계정이 있는 동안 요금 없이 사용할 수 있는 자원 묶음인데, 조건이 하나 있다. ==7일 동안 사용률이 모두 낮으면 Oracle이 유휴(idle) 인스턴스로 판단해 회수할 수 있다==. 회수는 인스턴스를 중지하는 조치로, 사용하지 않는 무료 자원을 다른 사용자에게 돌리기 위한 규칙이다.

| 기준 (7일)      | 회수 대상       |
| --------------- | --------------- |
| CPU 95퍼센타일  | 20% 미만        |
| 네트워크 사용률 | 20% 미만        |
| 메모리 사용률   | 20% 미만 (A1만) |

세 기준은 "모두" 만족해야 회수 대상이다. 예를 들어 CPU가 7일 내내 5% 이하여도 네트워크 사용률이 25%라면 회수 대상이 아니다. E2.1.Micro는 AMD 기반 shape[^shape]라 메모리 기준이 적용되지 않으므로, 이 서버는 CPU와 네트워크 두 기준만 확인하면 된다.

개인 포트폴리오의 API는 방문이 적어 CPU 사용률이 낮게 유지될 가능성이 크다. 회수되면 서버 구성 문서와 R2 백업으로 다시 구축할 수 있지만, 그동안 로그인·메시지·댓글 기능이 중단된다. 그래서 회수 위험을 미리 확인하고 알림을 받도록 했다.

## 사용률을 얻는 방법 비교

| 방법                                           | 장점                                         | 단점                                                                                    |
| ---------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Oracle Monitoring API로 Oracle 측정값 조회     | Oracle이 회수 판단에 사용하는 값 그대로      | API 키와 정책을 생성해야 하고, 요청마다 서명해야 한다. 기본으로 켜 두기에는 설정이 많다 |
| node-exporter + Prometheus 도입                | 그래프와 알림 기능이 이미 갖춰져 있다        | RAM 1GB 서버에 컨테이너가 2개 추가되고, 조회 화면이 사이트 밖에 생긴다                  |
| API 컨테이너 안에서 `/proc`를 직접 읽기 (선택) | 새 키·새 컨테이너가 없다. 사이트 안에서 조회 | Oracle 측정값과 같다는 보장이 없다. 그래서 위험을 일찍 알리는 방향으로 계산한다         |

node-exporter는 Linux 서버의 CPU·메모리·디스크 지표를 HTTP로 노출하는 프로그램이고, Prometheus는 그 지표를 주기적으로 수집해 저장·조회하는 시계열 데이터베이스다. 둘 다 별도 컨테이너로 실행해야 하므로 메모리 1GB 서버에는 부담이 크다.

> [!NOTE] Oracle API는 이후 도입
> Oracle API는 이후 종량제 요금과 예산을 표시하는 기능에서 도입했다. 요청 서명을 직접 구현한 과정은 [node:crypto로 SDK 없이 Oracle API 요청 서명 만들고 문서 시험 값으로 검증하기](/memo/oci-billing)에 정리했다. 사용률 측정에는 `/proc`로 충분했다.

## /proc에서 읽는 세 값

`/proc`[^proc]는 Linux 커널이 CPU·메모리·네트워크 상태를 텍스트 파일 형태로 노출하는 가상 파일 시스템이다. 디스크에 저장된 파일이 아니라 읽을 때마다 커널이 현재 값을 생성한다. 예를 들어 `cat /proc/meminfo`를 실행하면 `MemTotal: 1004548 kB` 같은 줄이 출력된다. API 컨테이너 안에서 이 파일들을 1분마다 읽는다.

| 값       | 읽는 파일       | 계산                                             |
| -------- | --------------- | ------------------------------------------------ |
| CPU      | `/proc/stat`    | 두 번 읽은 사이 구간에서 유휴가 아닌 시간의 비율 |
| 메모리   | `/proc/meminfo` | `MemTotal`에서 `MemAvailable`을 뺀 비율          |
| 네트워크 | `/proc/net/dev` | 두 번 읽은 사이 송수신 바이트 → Mbps (`lo` 제외) |

Docker 컨테이너 안에서도 `/proc/stat`과 `/proc/meminfo`는 VM 전체 값을 보여 준다(lxcfs 같은 도구를 쓰지 않는 경우). 따라서 compose에서 호스트의 `/proc`를 마운트하지 않아도 된다. ==네트워크는 컨테이너마다 네임스페이스가 분리되어 API 컨테이너의 송수신량만 보인다==. 다만 방문 트래픽은 모두 Cloudflare Tunnel을 거쳐 API로 들어오므로 VM 전체와 추세가 비슷하다.

### CPU: 누적 시간의 차이

`/proc/stat`의 `cpu` 줄은 부팅 후 CPU가 각 상태에서 보낸 시간을 USER_HZ 단위(보통 1/100초)로 누적한 값이다. 누적값만으로는 "지금" 사용률을 알 수 없으므로, 1분 간격으로 두 번 읽어 그 사이에 늘어난 양을 비교한다.

![/proc/stat의 cpu 줄을 0초와 60초에 읽어 user·nice·system·irq·softirq·steal의 차이 460과 idle·iowait의 차이 11520으로 CPU 사용률 3.8%를 계산하는 예시](./images/resource-monitor-proc-stat.svg '사용 시간의 증가량을 전체 시간의 증가량으로 나눈 값이 그 1분의 CPU 사용률이다')

파싱 코드는 파일 접근 없이 시험할 수 있도록 순수 함수로 작성했다(`apps/api/src/resources/rules.ts`). CPU는 `/proc/stat`의 `cpu` 줄을 사용 시간(busy)과 유휴 시간(idle)으로 나눈다.

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

| 필드      | 뜻                                                    | 분류 |
| --------- | ----------------------------------------------------- | ---- |
| `user`    | 일반 프로그램(Node.js, PostgreSQL 등)의 코드 실행     | 사용 |
| `nice`    | 우선순위를 낮춘 프로그램의 코드 실행                  | 사용 |
| `system`  | 커널 코드 실행(시스템 호출 처리 등)                   | 사용 |
| `idle`    | 할 일이 없어 대기                                     | 유휴 |
| `iowait`  | 디스크 I/O 완료를 기다리며 대기                       | 유휴 |
| `irq`     | 하드웨어 인터럽트 처리                                | 사용 |
| `softirq` | 네트워크 패킷 처리 같은 지연 인터럽트 처리            | 사용 |
| `steal`   | 하이퍼바이저가 같은 물리 서버의 다른 VM에 할당한 시간 | 사용 |

`iowait`는 CPU가 실제로 일하지 않는 시간이므로 유휴에 포함한다. `steal`은 이 VM이 CPU를 쓰려 했지만 다른 VM이 사용한 시간이라 사용 시간에 포함한다.

### 메모리와 네트워크

메모리는 한 번 읽은 값으로 계산한다. `MemAvailable`은 새 프로그램이 스왑 없이 사용할 수 있는 메모리 추정치로, 비어 있는 메모리(`MemFree`)에 즉시 비울 수 있는 캐시까지 더한 값이다. 예를 들어 `MemTotal`이 1,000,000kB, `MemAvailable`이 580,000kB이면 사용률은 (1,000,000 − 580,000) ÷ 1,000,000 = 42%다.

네트워크는 `/proc/net/dev`의 인터페이스별 수신·송신 바이트 누적값을 CPU처럼 두 번 읽어 차이를 구한다. 컨테이너 내부 통신용 루프백(`lo`)은 제외한다. 예를 들어 1분 동안 송수신 합계가 2,250,000바이트 늘었다면 다음과 같다.

```math
\frac{2{,}250{,}000 \times 8\ \text{bit}}{60\ \text{s}} = 300{,}000\ \text{bps} = 0.3\ \text{Mbps},\qquad \frac{0.3}{50} = 0.6\%
```

사용률은 두 번 읽은 값의 차이로 계산하므로, 처음 읽은 값은 기준값으로만 쓰고 저장하지 않는다. 컨테이너가 재시작되면 네트워크 카운터가 0부터 다시 증가하는데, 이때는 차이가 음수가 되므로 그 표본 하나를 버린다.

## 위험 계산

### 95퍼센타일과 평균

Oracle 문서는 CPU를 95퍼센타일[^p95]로 판단한다고 명시한다. 95퍼센타일은 값을 작은 순서로 정렬했을 때 95% 위치에 있는 값이다. 코드는 표본 n개를 정렬해 ⌈0.95 × n⌉번째 값을 사용한다(nearest-rank 방식). 7일 동안 1분 표본을 모으면 10,080개이고, 그중 상위 504개(약 8.4시간 분량)는 결과에 들어가지 않는다. 짧은 순간의 급등보다 "대부분의 시간 동안 이 값 이하였다"를 나타낸다.

![CPU 표본 20개를 정렬한 막대에서 19번째 값 9%가 95퍼센타일이고, 마지막 60% 급등은 결과에 들어가지 않으며, 평균 7.4%와 회수 기준 20%가 함께 표시된 예시](./images/resource-monitor-p95.svg '한 번의 급등은 95퍼센타일을 올리지 못한다. 회수를 피하려면 사용률이 오래 높아야 한다')

```ts
export function percentile(values: number[], p: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
```

네트워크와 메모리는 Oracle이 집계 방식을 밝히지 않는다. 이 두 값은 평균으로 계산한다. 평균은 대부분의 경우 95퍼센타일보다 낮게 나오므로, 실제보다 위험을 크게 판정한다. ==위험을 놓치기보다 일찍 알리는 방향==이다.

### 세 단계

| 단계          | 조건                                         |
| ------------- | -------------------------------------------- |
| **회수 위험** | 모든 기준이 20% 미만                         |
| **주의**      | 모든 기준이 30% 미만 (`WARNING_MARGIN` = 10) |
| **안전**      | 그 외                                        |

예를 들어 CPU 95퍼센타일이 5.6%, 네트워크 평균이 0.6%이면 둘 다 20% 미만이라 회수 위험이다. CPU가 25%였다면 20% 이상이라 회수 위험은 아니지만, 네트워크와 함께 둘 다 30% 미만이므로 주의 단계다.

7일치 표본이 쌓이기 전에는 그때까지의 값으로 예측하고, 화면에 "2일치로 미리 본 값"처럼 표시한다.

![기준마다 7일 값을 20%와 30%에 대 보는 세 단계](./images/resource-monitor-levels.svg '모두 20% 미만이면 회수 위험, 모두 30% 미만이면 주의')

네트워크 사용률은 shape 대역폭에 대한 비율이다. E2.1.Micro는 50Mbps로 설정하고(`RESOURCE_NETWORK_MBPS`), 메모리 조건은 A1 shape에만 적용되므로 shape 이름이 `/\.A1\./`에 일치할 때만 검사한다.

```ts
const level = conditions.every((condition) => condition.below)
	? 'danger'
	: conditions.every((condition) => condition.value < condition.threshold + WARNING_MARGIN)
		? 'warning'
		: 'safe';
```

표본은 `ResourceSample` 테이블에 1분마다 한 행씩 저장하고, 14일이 지나면 삭제한다. 하루 1,440행, 14일이면 20,160행이므로 1GB 서버의 PostgreSQL에도 부담이 적다.

![/proc를 1분마다 읽어 표본을 남기고 1시간마다 위험을 계산해 3일에 한 번까지 메일을 보내는 흐름](./images/resource-monitor-flow.svg '측정, 판정, 알림의 주기가 각각 다르다')

## 알림 메일

한 시간마다 위험을 다시 계산해 '회수 위험'이면 메일을 보낸다. 메일은 연락 메일과 같은 Resend(메일 발송 API 서비스)로 발송한다. 이때 연락 메일 서비스 안에 있던 Resend 호출을 `common/resend.ts`로 분리해 두 기능이 공유하게 했다.

위험 상태가 며칠씩 이어질 수 있으므로, 같은 알림은 **3일에 한 번**까지만 보낸다. 마지막 발송 시각은 메모리가 아니라 DB(`ResourceAlert`)에 저장한다. 배포할 때마다 컨테이너가 재시작되므로, ==메모리에 보관하면 배포마다 같은 메일이 다시 발송된다==.

```ts
// apps/api/src/resources/resources.service.ts
const last = await this.prisma.resourceAlert.findUnique({ where: { kind: 'reclaim' } });
if (last && now.getTime() - last.sentAt.getTime() < REALERT_MS) return false; // 3일
```

예를 들어 10월 10일 09:00에 메일을 보냈다면, 위험 상태가 계속되어도 한 시간마다의 판정은 10월 13일 09:00 전까지 메일을 보내지 않는다. 그 사이 배포로 컨테이너가 다시 시작되어도 DB의 `sentAt`은 그대로라 같은 판단을 한다.

메일 본문에는 기준별 현재 값과 기준값, 그리고 "계정을 Pay As You Go로 전환하면 회수 대상에서 제외된다"는 조치 방법을 함께 적는다. 메일만으로 필요한 조치를 판단할 수 있게 했다.

## 켜고 끄기

이 저장소를 다른 서버에 배포하는 경우도 있고, 계정을 종량제(Pay As You Go)로 전환하면 회수 대상이 아니다. 그래서 동작 모드를 환경 변수 하나로 정한다.

```bash
RESOURCE_MONITOR=off    # 기본: 측정하지 않는다
RESOURCE_MONITOR=free   # Always Free: 측정, 위험 계산, 메일 알림
RESOURCE_MONITOR=payg   # 종량제: 측정하고 표시만 한다
```

## 서버 탭

'활동 상태 보기'에 관리자 전용 **서버** 탭을 추가했다. 요금제와 shape, 회수 위험, 알림 메일 상태, 기준별 현재 값, 최근 7일 CPU·메모리·네트워크 그래프를 표시한다. 그래프에는 회수 기준(20%)을 점선으로 표시해, 선이 그 아래에 머물러 있으면 위험 상태임을 바로 알 수 있게 했다.

![활동 상태 보기의 서버 탭. 요금제 Always Free, 회수 위험, 알림 메일 켜짐 카드 아래에 CPU 95퍼센타일 5.6%와 네트워크 평균 0.6%가 20% 미만으로 걸림 표시되고, CPU와 메모리 그래프에 20% 점선이 그려져 있다](./images/resource-monitor-server-tab.jpg '가짜 API의 예시 값으로 렌더링한 서버 탭. CPU 선이 20% 점선 아래에 머문다')

메뉴 막대의 배터리 아이콘도 이 값을 사용한다. 관리자에게는 회수 기준에서 멀수록 배터리가 차오르고, 클릭하면 사용률·위험 단계와 서버 탭 바로가기가 표시된다([Always Free 유휴 회수 기준을 충전량으로 환산한 메뉴 막대 배터리](/memo/battery-server-resources)).

## 그래프 선이 63%에서 끊기던 버그

서버 탭 그래프의 선이 왼쪽에서 63% 지점에서 끊겼다. 개요 탭의 방문 그래프도 같았다. 선 아래 채움 영역은 오른쪽 끝까지 렌더링되는데 선만 중간에서 끝났다.

선이 왼쪽부터 그려지는 애니메이션을 `pathLength="1"`[^pathlength]과 `stroke-dasharray: 1`로 구현했고, 선 두께가 확대되지 않도록 `vector-effect: non-scaling-stroke`[^nss]도 함께 지정했다. 두 속성을 함께 쓰면 대시 길이가 화면 좌표 기준으로 계산된다. 그래프 SVG는 폭 600으로 그린 뒤 화면 폭(약 950px)에 맞게 가로로 늘리므로, ==길이 1로 지정한 대시가 600/950 ≈ 63% 지점에서 끝났다==.

같은 원인으로 순방문자 선도 점선(`4 3`)이어야 하는데 실선으로 표시됐다. `pathLength="1"`이면 대시 길이 4가 선 전체 길이의 네 배가 된다.

![pathLength와 non-scaling-stroke가 겹쳐 선이 63%에서 끝나는 까닭](./images/resource-monitor-line-bug.svg '가로로 늘린 SVG에서는 대시 길이가 화면 좌표 기준으로 계산된다')

애니메이션을 대시 방식에서 왼쪽부터 노출하는 `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` 방식으로 바꾸고 `pathLength`를 제거했다. `inset(0 100% 0 0)`은 요소의 오른쪽에서 100%를 잘라 낸 사각형, 즉 아무것도 보이지 않는 상태이고, 키프레임이 진행되면서 잘라 내는 폭이 0으로 줄어 선이 왼쪽부터 드러난다. 선의 길이나 좌표계와 무관하게 요소의 크기를 기준으로 동작한다.

|             | 수정 전                                  | 수정 후                       |
| ----------- | ---------------------------------------- | ----------------------------- |
| 애니메이션  | `pathLength="1"` + `stroke-dasharray: 1` | `clip-path: inset()` 키프레임 |
| 총방문 선   | 63% 지점에서 끊김                        | 끝까지 표시                   |
| 순방문자 선 | 실선으로 표시 (`4 3` 무시)               | 점선 `4 3`                    |

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

이 키프레임은 공통 애니메이션 파일에 있으므로, 개요 탭의 방문 그래프와 서버 탭 그래프가 함께 수정됐다.

> [!TIP] 애니메이션은 실제 렌더링 크기로 확인한다
> 그래프 버그는 SVG를 가로로 늘려 렌더링하는 실제 화면에서만 발생했다. viewBox와 같은 폭으로 렌더링한 시험 화면에서는 재현되지 않았다.

## 시험

| 종류     | 파일                                          | 확인 항목                                                                                                                                                                       |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위     | `apps/api/src/resources/rules.test.ts` (11개) | `/proc` 텍스트 파싱, 95퍼센타일, 위험 단계(E2·A1, 7일 밖 표본 제외), 시간 단위 집계, 모드 파싱                                                                                  |
| API e2e  | `apps/api/test/resources.e2e.test.ts`         | 꺼짐이면 모드만 응답, 관리자가 아니면 401, 가짜 `/proc`로 표본 저장, 7일 동안 낮으면 위험·메일 1통, 3일 이내 재발송 없음·3일 뒤 재발송, 여유 있으면 미발송, 14일 지난 표본 삭제 |
| 화면 E2E | Playwright                                    | 서버 탭의 위험·기준 표·그래프, 꺼짐 상태의 설정 안내, 방문자에게는 잠김                                                                                                         |

종량제 계정의 요금과 예산 한도 표시는 Oracle 요금 API 호출이 필요해 다음 단계로 분리했다.

## 적용 방법

서버 `api.env`에 다음 줄을 추가한다([apps/api/.env.example](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/.env.example)의 설명과 같다).

```bash
# ~/deploy/api.env
RESOURCE_MONITOR=free
OCI_SHAPE=VM.Standard.E2.1.Micro
RESOURCE_ALERT_TO=받을 메일 주소       # 비우면 CONTACT_TO. 발송에는 RESEND_API_KEY·CONTACT_FROM을 사용한다
```

```bash
cd ~/deploy && docker compose up -d api
```

관리자로 로그인해 활동 상태 앱의 서버 탭을 열고 CPU·메모리·네트워크 그래프와 위험 단계가 표시되는지 확인한다. 끄려면 `RESOURCE_MONITOR` 줄을 삭제하고 컨테이너를 재시작한다. 회수 규칙과 대응은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '유휴 회수', 계산은 [apps/api/src/resources/rules.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/resources/rules.ts)에 있다.

## 남은 과제

- **측정값은 Oracle의 값과 다르다.** 네트워크는 API 컨테이너의 송수신량만 포함하고, 네트워크·메모리는 평균으로 계산한다. 위험을 일찍 알리는 방향으로 계산했지만, 실제 회수 사례가 없어 얼마나 일찍 알리는지는 확인하지 못했다.
- **배포 시각의 공백.** 컨테이너가 재시작되면 첫 표본은 기준값으로만 쓰므로 배포마다 1분 표본이 하나 빠진다. 하루 1,440개 중 몇 개이므로 위험 계산에는 영향이 없다.
- **상태는 DB에 저장한다.** 배포마다 재시작되는 서버에서 "마지막 실행 시각"을 메모리에 보관하면 재시작 시 초기화된다. 업타임 감시 등 다른 알림에도 같은 기준을 적용한다.

## 관련 글

- [GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)
- [node:crypto로 SDK 없이 Oracle API 요청 서명 만들고 문서 시험 값으로 검증하기](/memo/oci-billing)
- [Always Free 유휴 회수 기준을 충전량으로 환산한 메뉴 막대 배터리](/memo/battery-server-resources)

<details>
<summary>참고 문헌</summary>

- Oracle Cloud Infrastructure Documentation, [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) (유휴 인스턴스 회수 조건)
- Oracle Cloud Infrastructure Documentation, [Compute Shapes](https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm)
- Linux man-pages, [proc_stat(5)](https://man7.org/linux/man-pages/man5/proc_stat.5.html), [proc_meminfo(5)](https://man7.org/linux/man-pages/man5/proc_meminfo.5.html), [proc(5)](https://man7.org/linux/man-pages/man5/proc.5.html)
- Resend, [Resend 문서](https://resend.com/docs)
- MDN, [clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path), [pathLength](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pathLength), [vector-effect](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/vector-effect)
- Prometheus, [Monitoring Linux host metrics with the Node Exporter](https://prometheus.io/docs/guides/node-exporter/)

</details>

[^proc]: Linux 커널이 프로세스·CPU·메모리·네트워크 상태를 파일 형태로 노출하는 가상 파일 시스템. 읽을 때마다 커널이 현재 값을 생성한다.

[^p95]: 값을 작은 순서로 정렬했을 때 95% 위치의 값. 짧은 순간의 최댓값은 제외하고 대부분 구간의 상한을 나타낸다.

[^shape]: Oracle Cloud에서 인스턴스의 CPU·메모리·네트워크 사양을 정한 유형. `VM.Standard.E2.1.Micro`, `VM.Standard.A1.Flex` 등이 있다.

[^pathlength]: SVG 경로의 전체 길이를 지정한 값으로 간주하게 하는 속성. 대시 길이를 비율로 쓸 때 사용한다([MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pathLength)).

[^nss]: 요소가 확대·축소되어도 선 두께를 화면 픽셀 기준으로 유지하는 값([MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/vector-effect)).

#MacFolio #백엔드 #Oracle #서버
