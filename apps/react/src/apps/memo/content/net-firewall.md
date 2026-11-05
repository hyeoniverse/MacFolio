---
title: 방화벽의 종류와 iptables 규칙
date: 2021-11-29
category: CS/네트워크 보안
series: 네트워크 보안
seriesOrder: 10
summary: 패킷 필터·상태 기반·프록시 방화벽의 차이와 배치 위치를 정리하고, 리눅스 netfilter와 iptables로 체인·규칙·연결 추적 기반 방화벽을 만들고 SSH 터널링으로 우회하는 방법까지 다룬다.
---

## 들어가기 전에

인터넷에 연결된 내부망의 모든 호스트를 하나하나 안전하게 유지하기는 어렵다. 호스트마다 운영체제 버전과 설정이 다르고, 취약점이 발견될 때마다 전부 갱신하기도 번거롭다. 방화벽(firewall)은 신뢰하지 않는 외부와 내부 사이에 모든 트래픽이 지나는 단일 통로를 두고, 그 지점에서 접근을 제어해 시스템 전체에 기본 방어를 제공한다.

구체적인 예로 사내망에 공개 웹 서버 하나만 외부에 열고 나머지는 모두 막고 싶은 상황을 생각한다. 호스트마다 설정을 거는 대신 경계에 방화벽을 두고 "80번 포트로 들어오는 연결만 특정 서버에 허용하고 나머지는 버린다"는 규칙 하나로 정책을 집행한다. 트래픽이 지나는 지점이 한 곳이므로 로깅과 감사 추적도 이곳에 모을 수 있다.

이 글이 답하려는 질문은 세 가지다. 방화벽은 무엇을 근거로 트래픽을 통과시키거나 막는가, 동작 방식에 따라 어떤 종류가 있는가, 그리고 리눅스에서 방화벽을 직접 만들고 운용하려면 어떤 도구를 쓰는가.

| 순서 | 내용                                                 |
| ---- | ---------------------------------------------------- |
| 1    | 방화벽의 정의, 기능, 한계, 정책과 동작               |
| 2    | 종류: 패킷 필터, 상태 기반, 응용 프록시, 회선 프록시 |
| 3    | 배치: 배스천 호스트, DMZ, 가상 방화벽, IDS/IPS       |
| 4    | netfilter와 iptables로 방화벽 만들기                 |
| 5    | 상태 기반 규칙과 SSH 터널링 우회                     |

IP 헤더와 포트, TCP 연결 설정은 [UDP와 TCP의 헤더, 연결 설정과 종료, 상태 전이](/memo/net-udp-tcp)을, 방화벽이 막으려는 공격들은 [TCP 프로토콜을 겨냥한 공격과 방어](/memo/net-tcp-attacks)를 기준으로 한다. 터널 전체를 암호화하는 VPN은 [VPN과 터널링: IPsec과 TLS VPN](/memo/net-vpn)에서 이어서 다룬다.

> [!WARNING] 실습 환경
> 아래 iptables 규칙과 SSH 터널링 명령은 자신이 관리하는 호스트와 격리된 가상 머신에서만 실행한다. 타인의 네트워크 정책을 우회하는 용도로 쓰면 안 된다.

## 방화벽이란

방화벽은 두 네트워크 사이에 놓여 세 가지 설계 목표를 집합적으로 만족하는 구성 요소다.[^bell94] 첫째, 내부에서 외부로 또는 그 반대로 오가는 모든 트래픽은 반드시 방화벽을 지나야 한다. 둘째, 지역 보안 정책이 허용한 트래픽만 통과한다. 셋째, 방화벽 자신은 침투에 견뎌야 하며, 이는 보안 운영체제를 올린 견고한 시스템을 뜻한다.

==방화벽의 가장 기본이고 중요한 기능은 접근 제어(access control)다.== 관리자가 통과시킬 접근과 차단할 접근을 명시하면 방화벽이 집행한다. 구현 방식에 따라 패킷 필터링과 프록시로 나뉜다. 그 밖에 통과하는 연결 정보를 저장하는 로깅과 감사 추적, 메시지·사용자·클라이언트 인증, 그리고 방화벽 사이 데이터 암호화(보통 VPN) 기능을 제공한다.

방화벽의 한계도 분명하다. 패킷의 데이터 내용 자체를 검사하지 않는 방식은 바이러스를 막지 못한다. 경계 정책만 집행하므로 내부 공격자나 외부에서 감염된 뒤 내부에서 쓰이는 노트북은 막지 못한다. 방화벽을 지나지 않는 통신, 예측하지 못한 새로운 형태의 공격, 방화벽을 우회하는 경로도 방어할 수 없다.

정책은 세 축으로 세운다. 사용자 제어(user control)는 접근하려는 사용자의 역할로, 서비스 제어(service control)는 제공되는 서비스의 종류(주소·프로토콜·포트)로, 방향 제어(direction control)는 요청이 시작되는 방향으로 트래픽을 제어한다. 트래픽이 외부에서 내부로 들어오면 인바운드(inbound), 반대면 아웃바운드(outbound)다.

동작은 세 가지다. 통과(accepted)는 방화벽 너머로 들여보내고, 거부(denied)는 들여보내지 않으며, 반려(rejected)는 거부와 같되 ICMP 패킷으로 출발지에 그 결정을 알린다.

![진입 필터링: ISP D와 말단 네트워크 경계에서 방향별로 진입·송출 트래픽이 갈리고, ISP D가 허용된 출발지 IP 목록(ACL)으로 말단 네트워크 안 공격자의 IP 스푸핑 패킷을 폐기하는 구조](./images/net-firewall-ingress.svg '들어오는 트래픽을 거르는 진입 필터와 나가는 트래픽을 거르는 송출 필터')

진입 필터링(ingress filtering)은 들어오는 트래픽을 검사해 내부망을 지키고 외부 공격을 막는다. 송출 필터링(egress filtering)은 나가는 트래픽을 검사해 내부 사용자가 특정 외부망에 닿지 못하게 한다. 출발지 주소를 위조한 패킷을 경계에서 떨어뜨리는 진입 필터링은 [TCP 프로토콜을 겨냥한 공격과 방어](/memo/net-tcp-attacks)에서 본 위조 기반 공격의 공통 방어이기도 하다.

## 방화벽의 종류

동작 방식에 따라 방화벽은 패킷 필터, 상태 기반, 응용 프록시, 회선 수준 프록시 네 가지로 나뉜다.

![방화벽 모델: 일반 모델과 패킷 필터·상태 검사·응용 프록시·회선 수준 프록시가 처리하는 계층 비교](./images/net-firewall-models.svg '프록시 방화벽은 상위 계층까지 올라가 검사한다')

### 패킷 필터링 방화벽

패킷 필터링 방화벽은 응용 데이터를 담은 페이로드는 보지 않고 패킷 헤더의 정보로 트래픽을 제어한다. 출발지·목적지 IP와 포트, IP 프로토콜, 인터페이스 등을 필드로 삼아 규칙 목록과 대조하고, 일치하는 규칙이 전달과 폐기 중 무엇을 지시하는지에 따라 처리한다. 패킷이 기존 흐름의 일부인지 신경 쓰지 않고 상태를 보관하지 않으므로 무상태 방화벽(stateless firewall)이라 부른다.

규칙은 접근 제어 목록(ACL, access control list)으로 정리한다. 다음은 내부망을 `222.22/16{:bash}`으로 둔 예다. 위에서 아래로 적용하고, 어느 규칙에도 맞지 않으면 마지막 거부 규칙이 모두 막는다.

| 동작 | 출발지    | 목적지    | 프로토콜 | 출발 포트 | 목적 포트 | 플래그 |
| ---- | --------- | --------- | -------- | --------- | --------- | ------ |
| 허용 | 222.22/16 | 외부      | TCP      | > 1023    | 80        | any    |
| 허용 | 외부      | 222.22/16 | TCP      | 80        | > 1023    | ACK    |
| 허용 | 222.22/16 | 외부      | UDP      | > 1023    | 53        | ---    |
| 허용 | 외부      | 222.22/16 | UDP      | 53        | > 1023    | ---    |
| 거부 | all       | all       | all      | all       | all       | all    |

정책을 규칙으로 옮기는 예를 몇 가지 든다. 외부 웹 접근을 막으려면 목적 포트 80으로 나가는 패킷을 모두 버린다. 공개 웹 서버로 오는 연결만 허용하려면 그 서버를 뺀 모든 목적지의 인바운드 TCP SYN을 버린다. 스머프(smurf) DoS에 악용되지 않으려면 브로드캐스트 주소로 가는 ICMP를 버린다. 내부망이 traceroute에 드러나지 않으려면 나가는 ICMP TTL 만료 패킷을 버린다.

패킷 필터링은 헤더만 보므로 처리 속도가 빠르고 기존 응용에 쉽게 연동되며 구축 비용이 저렴하다. 반면 데이터에 대한 공격을 막지 못하고, 헤더 조작·IP 주소 위조·소스 라우팅·작은 조각(tiny fragment) 공격에 약하며, 로깅과 사용자 인증을 제공하지 않고, 설정 오류가 곧 취약점이 된다.

### 상태 기반 방화벽

무상태 필터는 "말이 안 되는" 패킷도 통과시킨다. 예를 들어 열린 TCP 연결이 없는데도 목적 포트 80에 ACK 비트가 켜진 패킷을 규칙만 보고 허용한다. 상태 기반 방화벽(stateful firewall)은 연결이 닫힐 때까지 상호작용을 추적해 패킷의 문맥을 이해한다.

![무상태 필터와 상태 기반 필터의 차이: 열린 연결이 없는 ACK 패킷을 무상태는 통과, 상태 기반은 차단](./images/net-firewall-stateful.svg '상태 기반 필터는 연결 상태 표를 조회해 문맥에 맞지 않는 패킷을 막는다')

상태 기반 필터는 연결 설정(SYN)과 종료(FIN)를 추적해 들어오고 나가는 패킷이 문맥에 맞는지 판단하고, 활동이 없는 연결은 시간 초과로 더는 받아들이지 않는다. 이를 위해 연결 상태 표(connection state table)에 출발지·목적지 주소와 포트, 연결 상태를 보관한다.

![상태 기반 방화벽: 보호망과 외부망 사이에서 여러 패킷이 이루는 상태 정보로 결정](./images/net-firewall-state-decision.svg '서로 관련된 여러 패킷이 이루는 상태로 판단한다')

ACL은 연결 상태를 확인할지 표시하는 열을 더해 확장한다. 아래에서 표시된 규칙은 패킷을 허용하기 전에 연결 상태 표를 먼저 조회한다.

| 동작 | 출발지    | 목적지    | 프로토콜 | 출발 포트 | 목적 포트 | 플래그 | 상태 확인 |
| ---- | --------- | --------- | -------- | --------- | --------- | ------ | --------- |
| 허용 | 222.22/16 | 외부      | TCP      | > 1023    | 80        | any    |           |
| 허용 | 외부      | 222.22/16 | TCP      | 80        | > 1023    | ACK    | 확인      |
| 허용 | 222.22/16 | 외부      | UDP      | > 1023    | 53        | ---    |           |
| 허용 | 외부      | 222.22/16 | UDP      | 53        | > 1023    | ---    | 확인      |
| 거부 | all       | all       | all      | all       | all       | all    |           |

상태 기반 방화벽은 보안성이 우수하고 새 서비스 적용이 쉽지만, 보안에 비례해 구축이 복잡하고 비용이 높으며 관리가 필요하다.

### 응용 프록시와 회선 수준 프록시

응용 프록시 방화벽(application-proxy firewall; ALG, application layer gateway)은 클라이언트의 연결이 프록시에서 끝나고, 프록시가 목적지 호스트로 별도의 연결을 새로 연다. 연결 위의 데이터를 응용 계층까지 분석해 허용할지 반려할지 정한다. 의도된 수신자인 척하는 중개자로 동작하므로 방화벽 안에 응용별 소프트웨어가 필요하다.

![응용 프록시 방화벽: 이중 홈 프록시 방화벽 안에서 프록시 서버가 실제 클라이언트의 요청을 받아 응용 프로토콜을 분석한 뒤 프록시 클라이언트로 실제 서버에 전달](./images/net-firewall-app-proxy.svg '클라이언트의 연결이 프록시에서 끝나고 프록시가 새 연결을 연다')

데이터까지 검사하므로 보안성이 높고, OTP 같은 인증과 강화된 로깅·감사, 서비스별 접근 제한 같은 부가 기능을 쓰기 쉽다. 반면 처리 속도가 느리고, 새 서비스마다 프록시를 추가해야 해 유연성이 떨어진다.

회선 수준 프록시 방화벽(circuit-level proxy firewall)은 응용 계층이 아니라 세션 계층 이하의 상태로 필터링한다. 대표 예가 SOCKS(socket secure)로, RFC 1928에 정의된 SOCKS v5는 TCP·UDP 응용이 방화벽을 쓰게 한다. 클라이언트 응용이 SOCKS 서버에 접속해 인증한 뒤 중계 요청을 보내면, 서버가 평가해 중계 연결을 세운다. HTTP 프록시와 달리 전송되는 데이터를 이해하지 않는다.

![SOCKS 회선 수준 게이트웨이: 브라우저(ex. Chrome)·P2P 클라이언트(ex. uTorrent)·메신저(ex. Skype) 같은 클라이언트 응용과 SOCKS 프록시 서버가 협상·인증·요청을 거친 뒤 목적지 서버와 데이터를 중계](./images/net-firewall-socks.svg 'SOCKS 프록시는 데이터를 이해하지 않고 연결만 중계한다')

회선 수준 프록시는 단순하면서 서비스 유연성이 높고 서비스별 프록시가 필요 없다. 다만 클라이언트에 SOCKS 프로토콜 처리 프로그램이 필요하고, 응용 계층으로 들어가지 않아 응용 서비스의 접근 통제 로그는 남기지 않는다. 프록시 기술은 송출 필터링을 우회하는 데도 쓰이는데, 목적지가 프록시 서버로 바뀌고 실제 출발지 IP를 숨길 수 있어 익명 프록시(anonymizing proxy)가 된다.

## 방화벽의 위치

방화벽은 보통 UNIX나 리눅스 같은 운영체제를 올린 독립 장비에 둔다. 배치 방식은 배스천 호스트, 호스트 기반, 네트워크 장비, 가상 방화벽으로 나뉜다.

배스천 호스트(bastion host)는 네트워크의 중요한 거점으로, 여러 응용·회선 수준 게이트웨이를 올린다. 각 프록시는 접근 가능한 기능과 호스트를 제한하고 독립적이며 비특권으로 동작한다. 보안 운영체제와 필수 서비스만 올리고, 프록시나 호스트 접근에 사용자 인증을 요구한다.

![배스천 호스트: 외부와 내부 사이에서 FTP·텔넷·DNS·SMTP·HTTP 서버의 프록시 거점 역할](./images/net-firewall-bastion.svg '여러 게이트웨이를 올린 단일 거점이 내부와 외부를 중개한다')

호스트 기반 방화벽(host-based firewall)은 개별 호스트에서 패킷 흐름을 거른다. 호스트에 맞춘 규칙을 쓰고, 내부·외부 공격 모두에 대비하며, 조직 방화벽 위에 보호 계층을 더한다. 윈도우와 macOS의 방화벽이 예다. 네트워크 장비 방화벽(또는 스크리닝 라우터)은 라우터·스위치에 패킷 필터링과 상태 검사 기능을 담아 장비를 지나는 흐름을 거른다. 속도가 빠르지만 라우터 펌웨어만으로는 접근 제어가 어려워 배스천 호스트와 함께 쓴다. 가상 방화벽(virtual firewall)은 가상화 환경에서 물리 장비 대신 가상화된 서버·스위치·방화벽을 공용 하드웨어 위에 올린다.

DMZ(demilitarized zone, 비무장 지대)는 외부에 공개해야 하는 서버를 내부망과 분리해 두는 구간이다. 외부 방화벽과 내부 방화벽 사이에 웹·메일·DNS 서버를 두어, 외부에서 닿을 수 있게 하되 내부 보호망과는 격리한다.

![DMZ 네트워크: 경계 라우터와 외부·내부 방화벽 사이의 내부 DMZ 네트워크에 웹·메일·DNS 서버를 배치하고, 응용·데이터베이스 서버와 워크스테이션은 내부 방화벽 뒤 내부 보호망에 배치](./images/net-firewall-dmz.svg '공개 서버는 DMZ에, 내부 자원은 내부 방화벽 뒤에 둔다')

침입 탐지 시스템(IDS, intrusion detection system)은 방화벽을 보완한다. 심층 패킷 검사(deep packet inspection)로 패킷 내용을 알려진 공격 문자열과 대조하고, 여러 패킷의 상관을 분석해 포트 스캔·네트워크 매핑·DoS를 탐지한다. 침입 방지 시스템(IPS, intrusion prevention system)은 IDS 알고리즘으로 탐지하되 방화벽처럼 트래픽을 막기까지 한다. Snort, Suricata, Zeek이 대표적이다.

![IDS 센서 배치: 내부 네트워크 안, 내부망과 방화벽 사이, 방화벽과 DMZ 사이에 센서를 두어 트래픽을 감시](./images/net-firewall-ids.svg 'IDS 센서는 경계와 내부, DMZ 여러 지점에서 트래픽을 본다')

> [!NOTE] IDS와 IPS의 차이
> IDS는 탐지해 경보를 울리고, IPS는 탐지한 트래픽을 차단한다. 여러 보안 기능을 한 장비에 통합한 제품을 통합 위협 관리(UTM, unified threat management)라 부른다.

## netfilter로 방화벽 만들기

리눅스 커널은 트래픽의 운명을 결정하는 netfilter 하위 시스템을 담고 있다. 리눅스 방화벽 솔루션들은 패킷 필터링에 netfilter를 쓴다. 사용자가 직접 제어하기 어려우므로 그 위에 사용자 인터페이스를 둔다. iptables는 대부분의 리눅스에서 실제 쓰이는 방화벽 규칙 데이터베이스이고, nftables는 iptables를 대체하는 틀이며, UFW(uncomplicated firewall)는 우분투의 호스트 방화벽에 적합한 iptables 프런트엔드다.

커널 안에서 패킷을 거르려면 커널을 바꿔야 한다. 리눅스는 두 장치를 제공한다. netfilter는 커널 안 패킷 경로의 중요한 지점에 훅(hook)을 제공하고, 적재 가능 커널 모듈(LKM, loadable kernel module)은 커널 전체를 다시 컴파일하지 않고 모듈을 동적으로 더하고 뺀다. netfilter 훅에 콜백 함수를 등록하면, 패킷이 그 훅에 도착할 때 커널이 등록된 모듈을 호출하고 모듈이 패킷을 분석·조작한 뒤 판정을 돌려준다.

판정은 반환값으로 표현한다. `NF_ACCEPT{:c}`는 통과, `NF_DROP{:c}`은 폐기, `NF_QUEUE{:c}`는 사용자 공간으로 전달, `NF_STOLEN{:c}`은 모듈이 패킷을 가져가 더 처리, `NF_REPEAT{:c}`는 모듈 재호출 요청이다.

아래는 목적지 TCP 포트가 23(텔넷)이면 패킷을 버리는 콜백의 핵심이다. 필터 논리를 하드코딩한 부분을 바꾸면 다른 규칙이 된다.

```c
unsigned int telnetFilter(void *priv, struct sk_buff *skb,
                          const struct nf_hook_state *state) {
    struct iphdr *iph = ip_hdr(skb);
    struct tcphdr *tcph = (void *)iph + iph->ihl * 4;
    if (iph->protocol == IPPROTO_TCP && ntohs(tcph->dest) == 23) {
        printk(KERN_INFO "Dropping telnet packet\n");  // dmesg로 조회
        return NF_DROP;
    }
    return NF_ACCEPT;
}
```

콜백을 훅에 등록할 때는 어떤 netfilter 훅을 쓸지와 어떤 콜백을 걸지 지정한다. 모듈은 `insmod{:bash}`로 넣고 `rmmod{:bash}`로 빼며, `printk(){:c}`가 커널 버퍼에 남긴 메시지는 `dmesg{:bash}`로 조회한다. 모듈을 넣은 뒤에는 텔넷 연결이 막히고, 빼면 다시 성공한다.

## iptables로 방화벽 운용하기

iptables는 netfilter 기반의 내장 방화벽이다. 커널 쪽은 Xtables, 사용자 공간 프로그램은 iptables이며, 보통 둘을 묶어 iptables라 부른다. 규칙은 테이블·체인·규칙의 계층 구조로 배치한다.

![iptables의 netfilter 파이프라인: PREROUTING·INPUT·FORWARD·OUTPUT·POSTROUTING 지점의 raw·conntrack·mangle·nat·filter 처리](./images/net-firewall-netfilter.svg '패킷이 네트워크 인터페이스에서 지역 프로세스까지 지나는 처리 지점들')

각 테이블은 여러 체인을 담고, 체인은 netfilter 훅 하나에 대응한다. 체인은 규칙이 집행되는 위치를 가리킨다. 예를 들어 `FORWARD{:bash}` 체인의 규칙은 `NF_IP_FORWARD{:bash}` 훅에서, `INPUT{:bash}` 체인의 규칙은 `NF_IP_LOCAL_IN{:bash}` 훅에서 집행된다. 사용자는 체인에 규칙을 더한다. 들어오는 텔넷을 모두 막으려면 filter 테이블의 INPUT 체인에 규칙을 더한다.

| 테이블 | 체인                                            | 기능                    |
| ------ | ----------------------------------------------- | ----------------------- |
| filter | INPUT, FORWARD, OUTPUT                          | 패킷 필터링             |
| nat    | PREROUTING, INPUT, OUTPUT, POSTROUTING          | 출발지·목적지 주소 변환 |
| mangle | PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING | 패킷 내용 수정          |

iptables를 호스트 방화벽으로 보면 체인의 역할이 분명하다. INPUT은 iptables 호스트로 들어오는 패킷, OUTPUT은 호스트에서 나가는 패킷, FORWARD는 호스트를 거쳐 지나가는 패킷을 다룬다.

![iptables 체인 종류: INPUT은 호스트로, OUTPUT은 호스트에서, FORWARD는 호스트를 지나는 트래픽](./images/net-firewall-chains.svg '체인마다 다루는 트래픽의 방향이 다르다')

패킷이 체인을 지나는 경로는 목적지에 따라 갈린다. 먼저 최종 목적지가 지역 머신인지 판단하고, 지역행이면 INPUT 체인을, 통과행이면 FORWARD 체인을 지난다. 나가는 패킷은 어느 인터페이스로 내보낼지 정한 뒤 OUTPUT 경로를 따른다. 각 체인에서 규칙과 대조해 일치하면 `ACCEPT{:bash}`, `DROP{:bash}`, 또는 사용자 정의 체인으로 분기한다.

![iptables 체인 순회: 라우팅 판단에 따라 PREROUTING에서 INPUT 또는 FORWARD로 갈리고, 지역 프로세스의 OUTPUT과 함께 POSTROUTING으로 모이는 흐름](./images/net-firewall-traversal.svg '라우팅 판단이 패킷을 INPUT 경로와 FORWARD 경로로 가른다')

iptables 기능은 확장(extension) 모듈로 늘린다. `conntrack{:bash}`은 연결 기반 규칙으로 상태 기반 방화벽을 만들고, `owner{:bash}`는 사용자 ID 기반 규칙을 만든다. 예를 들어 사용자 `seed{:bash}`가 만든 프로그램의 패킷만 버리려면 OUTPUT 체인에 다음을 더한다. 다른 사용자는 영향을 받지 않는다.

```bash
sudo iptables -A OUTPUT -m owner --uid-owner seed -j DROP
```

mangle 테이블로 패킷 내용을 바꾸는 예로, 모든 패킷의 TTL을 5 늘리려면 PREROUTING 체인을 고른다. 현재 호스트행이든 통과행이든 모든 패킷에 적용되도록 하기 위해서다.

```bash
sudo iptables -t mangle -A PREROUTING -j TTL --ttl-inc 5
```

간단한 방화벽은 기본 정책을 ACCEPT로 두고 기존 규칙을 비운 뒤, 필요한 허용 규칙을 쌓고 마지막에 기본 정책을 DROP으로 바꾸는 순서로 만든다. 다음은 22(ssh)·80(http) 인바운드만 허용하고 나머지를 막는 예다.

```bash
# 기존 규칙 비우기 (기본 정책은 비우기 전에 ACCEPT로)
sudo iptables -P INPUT ACCEPT
sudo iptables -F
# 22, 80 인바운드 TCP 허용, 모든 아웃바운드 TCP 허용
sudo iptables -A INPUT  -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT  -p tcp --dport 80 -j ACCEPT
sudo iptables -A OUTPUT -p tcp -j ACCEPT
# 루프백과 DNS 질의·응답 허용
sudo iptables -A INPUT  -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A INPUT  -p udp --sport 53 -j ACCEPT
# 기본 정책을 DROP으로 바꿔 설정한 규칙만 통과
sudo iptables -P INPUT DROP
```

이 방화벽은 80(http)과 22(ssh)를 뺀 모든 패킷을 버린다. 다른 머신에서 23번 포트로 텔넷 연결을 시도하면 실패하고, 80번 포트로 `wget{:bash}` 연결은 성공한다.

## 상태 기반 방화벽과 우회

### 연결 추적으로 만드는 상태 기반 방화벽

리눅스 커널은 netfilter 위에 연결 추적 틀 `nf_conntrack{:bash}`을 둔다. 들어오는 패킷마다 연결 상태를 표시한다. `NEW{:bash}`는 유효한 순서로 시작하는 연결, `ESTABLISHED{:bash}`는 양방향 통신이 이뤄진 연결, `RELATED{:bash}`는 FTP 제어와 데이터처럼 서로 관련된 연결, `INVALID{:bash}`는 예상 동작을 따르지 않는 패킷이다. TCP뿐 아니라 UDP·ICMP에도 적용된다.

이미 성립한 연결에 속하는 아웃바운드 TCP만 허용하려면 연결 상태로 규칙을 세운다. 아래는 ssh·http 연결에 속한 아웃바운드만 허용하고 나머지 아웃바운드 TCP를 막는다.

```bash
sudo iptables -A OUTPUT -p tcp -m conntrack \
     --ctstate ESTABLISHED,RELATED -j ACCEPT
```

### SSH 터널링으로 우회

터널링(tunneling)은 데이터 스트림을 공용망 위의 가상 파이프로 전달하는 기술이다. 한 프로토콜이 다른 프로토콜을 캡슐화해 운반하며, 대부분 보안 채널 역할을 하므로 암호화를 적용한다. 방화벽은 지나는 트래픽의 겉모습만 보므로, 허용된 프로토콜 안에 막힌 트래픽을 숨기면 규칙을 우회할 수 있다.

예를 들어 집(`home{:bash}`)에서 회사 내부 머신(`work{:bash}`)에 텔넷하려는데 회사 방화벽이 인바운드를 모두 막고 ssh만 내부 머신 `apollo{:bash}`에 닿게 한다고 하자. `home{:bash}`과 `apollo{:bash}` 사이에 ssh 터널을 세우면, 터널이 텔넷 클라이언트의 TCP 데이터를 받아 `apollo{:bash}`로 보내고 거기서 다시 `work{:bash}`로 보낸다. 방화벽은 `home{:bash}`과 `apollo{:bash}` 사이의 암호화된 ssh 트래픽만 본다.

![SSH 터널링 우회: 방화벽이 막는 텔넷 대신 home에서 apollo로 ssh 터널을 세워 work의 텔넷 서버에 접속](./images/net-firewall-ssh-tunnel.svg '방화벽은 암호화된 ssh 구간만 보고 내부 텔넷 트래픽을 보지 못한다')

지역 포트 포워딩(local port forwarding)은 `-L{:bash}` 옵션으로 지정한다. `home{:bash}`의 8000번 포트로 들어온 데이터를 `work{:bash}`의 23번으로 보내는 터널을 세우고, 8000번으로 텔넷하면 트래픽이 터널을 타고 `work{:bash}`로 전달된다.

```bash
# home에서 apollo를 거쳐 work:23으로 가는 터널
ssh -L 8000:work:23 apollo
# 터널을 통해 텔넷
telnet localhost 8000
```

동적 포트 포워딩(dynamic port forwarding)은 `-D{:bash}` 옵션으로 목적지를 고정하지 않고 SOCKS 프록시를 만든다. 브라우저가 `localhost:9000{:bash}`을 프록시로 쓰도록 설정하면 어떤 목적지든 터널을 타고 나간다.

```bash
ssh -D 9000 -C home
```

> [!CAUTION] 터널링은 양날의 칼
> 같은 터널링이 관리자에게는 안전한 원격 접속을, 공격자에게는 정책 우회를 제공한다. 그래서 송출 필터링만으로는 부족하고, 응용 계층 검사와 프록시, 아웃바운드 연결 감시가 함께 필요하다. 터널 전체를 암호화해 내부망을 확장하는 VPN은 [VPN과 터널링: IPsec과 TLS VPN](/memo/net-vpn)에서 이어서 다룬다.

## 정리

방화벽은 모든 트래픽이 지나는 단일 통로에서 정책을 집행한다. 패킷 필터는 헤더만 보아 빠르지만 문맥을 모르고, 상태 기반 필터는 연결 상태를 추적해 문맥에 맞지 않는 패킷을 막으며, 프록시는 응용 계층까지 올라가 검사하되 느리다.

| 종류        | 검사 계층          | 특징                             |
| ----------- | ------------------ | -------------------------------- |
| 패킷 필터   | 네트워크·전송 헤더 | 빠름, 무상태, 데이터 공격에 약함 |
| 상태 기반   | 헤더 + 연결 상태   | 문맥 판단, 복잡·고비용           |
| 응용 프록시 | 응용 계층          | 보안성 높음, 느림, 응용별 프록시 |
| 회선 프록시 | 세션 계층 이하     | 유연, 응용 로그 없음             |

리눅스에서는 netfilter 훅에 LKM으로 콜백을 걸거나, 그 위의 iptables로 테이블·체인·규칙을 구성한다. 연결 추적 확장으로 상태 기반 규칙을 세우고, SSH 터널링은 방화벽 규칙을 우회하는 대표적인 경로다. 방화벽이 보지 못하는 터널 안을 암호화로 통째로 보호하는 방식이 VPN이다.

## 참고 문헌

- S. M. Bellovin, W. R. Cheswick, "Network Firewalls," _IEEE Communications Magazine_, vol. 32, no. 9, 1994.
- M. Leech et al., "SOCKS Protocol Version 5," RFC 1928, 1996. <https://www.rfc-editor.org/rfc/rfc1928>
- James F. Kurose, Keith W. Ross, _Computer Networking: A Top-Down Approach_, 7th Ed., Pearson, 2016.
- Wenliang Du, _Computer & Internet Security: A Hands-on Approach_, 2nd Ed., 2019.

[^bell94]: S. M. Bellovin, W. R. Cheswick, "Network Firewalls," _IEEE Communications Magazine_, vol. 32, no. 9, pp. 50–57, 1994.
