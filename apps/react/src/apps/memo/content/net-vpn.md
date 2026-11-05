---
title: VPN과 터널링: IPsec과 TLS VPN
date: 2021-12-06
category: 학습/CS/네트워크 보안
series: 네트워크 보안
seriesOrder: 11
summary: 공용망 위에 사설망을 세우는 VPN의 원리를 IP 터널링과 캡슐화로 설명하고, TUN 가상 인터페이스로 TLS/SSL VPN을 만들고 라우팅으로 트래픽을 터널에 태워 방화벽을 우회하는 과정까지 다룬다.
---

## 들어가기 전에

사내 자원처럼 내부 사용만 염두에 둔 네트워크를 사설망(private network)이라 한다. 외부에서 사설망에 접근할 길을 열면 공격 표면이 크게 넓어지고, 자원 접근을 IP 주소로만 인가한다면 공격자가 IP를 바꿔 쉽게 뚫을 수 있다. 외부 노드를 마치 사설망 안에 있는 것처럼 만들면서도 이 위험을 줄이는 기술이 VPN이다.

구체적인 예로 집에서 회사 내부망의 서버에 안전하게 접근하려는 상황을 생각한다. 회사 서버를 그대로 외부에 공개하면 누구나 닿을 수 있어 위험하다. 대신 공용망인 인터넷 위에 암호화된 가상의 사설망을 깔면, 인증된 사용자만 그 통로로 내부망에 들어가고 트래픽은 도중에 보호된다. 이것이 가상 사설망(VPN, virtual private network)이다.

이 글이 답하려는 질문은 세 가지다. 공용망 위에 사설망을 세운다는 말은 구체적으로 무엇을 뜻하는가, 터널 안의 트래픽은 어떻게 보호되는가, 그리고 TLS/SSL VPN을 직접 만들려면 커널과 어떻게 주고받아야 하는가.

| 순서 | 내용                                     |
| ---- | ---------------------------------------- |
| 1    | VPN의 정의와 성질, 활용                  |
| 2    | IP 터널링과 캡슐화, IPsec과 TLS/SSL 방식 |
| 3    | TUN/TAP 가상 인터페이스                  |
| 4    | TUN으로 VPN 만들기와 라우팅 설정         |
| 5    | VPN으로 방화벽 우회하기                  |

IP 주소·라우팅은 [ICMP와 traceroute, IP 라우팅 테이블](/memo/net-traceroute-routing)을, TCP 헤더까지 암호화하는 IPsec과 전송 계층 암호화의 차이는 [TCP 프로토콜을 겨냥한 공격과 방어](/memo/net-tcp-attacks)를 기준으로 한다. 방화벽의 종류와 SSH 터널링 우회는 [방화벽의 종류와 iptables 규칙](/memo/net-firewall)에서 다뤘고, 이 글은 그 연장으로 VPN 우회를 다룬다.

> [!WARNING] 실습 환경
> 아래 VPN 구성과 라우팅 설정은 자신이 관리하는 호스트와 격리된 가상 머신에서만 실행한다. 타인의 네트워크 정책을 우회하는 용도로 쓰면 안 된다.

## VPN이란

VPN은 사용자가 인터넷 같은 공용망 위에 안전한 사설망을 만들게 한다. 네트워크에 지정된 호스트, 즉 VPN 서버를 두고, 외부 컴퓨터는 인증을 거쳐 VPN 서버를 통해서만 사설망 안의 호스트에 닿는다. VPN 서버만 외부에 노출되고 내부 컴퓨터는 방화벽이나 예약 주소로 여전히 보호된다.

![일반적인 VPN 구성: 클라이언트가 인터넷 너머 VPN 서버를 거쳐 사설망에 접속](./images/net-vpn-overview.svg '클라이언트는 VPN 서버로 인증받아 사설망에 들어간다')

==VPN은 세 가지 성질을 보장한다. 인증된 사용자만 쓸 수 있고(사용자 인증), 사설망 내 데이터는 외부에서 접근할 수 없으며(내용 보호), 외부인이 임의로 데이터를 삽입할 수 없다(무결성 보존).==

VPN 안의 트래픽은 지역망·광역망에 보낼 수 있는 무엇이든 될 수 있다. 활용 예로 ATM이 금융 시스템에 더 안전하게 연결하거나, 개방형 와이파이에서 도청을 막거나, 여러 사무실을 하나의 회사망으로 잇거나, 접속 지역을 우회하거나, 검열을 회피하는 경우가 있다.

## IP 터널링

VPN의 핵심은 IP 터널링(IP tunneling)이다. 클라이언트가 사설망의 머신에 접속할 때 VPN 서버를 거쳐 인증받고, 보호할 패킷은 터널로 운반된다.

![IP 터널링: 터널 양 끝 사이에 실제 패킷이 오가고, 페이로드가 보호할 또 다른 IP 패킷을 싣는다](./images/net-vpn-tunnel-concept.svg '터널을 지나는 패킷의 페이로드가 원래 IP 패킷을 담는다')

터널을 지나는 실제 패킷은 공용망을 거친다. 이 패킷의 페이로드가 보호할 또 다른 IP 패킷, 즉 사설망을 오가는 패킷을 담는다. 캡슐화 구조를 그림으로 보면 분명하다.

![IP 터널링의 캡슐화 구조: 원래 IP 패킷을 통째로 페이로드에 담고 새 IP 헤더를 붙여 보낸다](./images/net-vpn-encap.svg '방화벽은 바깥 헤더만 보고 안에 담긴 원래 패킷을 보지 못한다')

IP 터널링에는 두 방식이 있다. IPsec 터널링은 인터넷 프로토콜 보안(IPsec) 프로토콜을 쓰며, 터널링 모드에서 원래 IP 패킷을 캡슐화해 새 IP 패킷에 넣는다. TLS/SSL 터널링은 커널 밖 응용 수준에서 터널링을 하며, VPN 행 IP 패킷을 TCP 또는 UDP 패킷 안에 넣고, 반대편 터널 끝이 페이로드에서 IP 패킷을 꺼낸다. 패킷을 보호하려고 양쪽 끝이 TCP·UDP 위에 TLS/SSL 프로토콜을 쓴다.

![IPsec 터널링과 TLS/SSL 터널링의 캡슐화 비교: 커널 수준의 IPsec과 응용 수준의 TLS/SSL](./images/net-vpn-ipsec-tls.svg 'IPsec은 커널에서, TLS/SSL은 응용 수준에서 원래 패킷을 감싼다')

> [!NOTE] 두 방식의 암호화 위치
> IPsec은 네트워크 계층에서 동작해 TCP 헤더까지 보호하지만 커널 지원이 필요하다. TLS/SSL VPN은 응용 프로그램이 TCP·UDP 소켓 위에서 처리하므로 커널 변경 없이 구현할 수 있다. 이 글은 TLS/SSL 방식에 집중한다.

## TUN/TAP 가상 인터페이스

TLS/SSL VPN의 터널은 보통의 TCP 또는 UDP 기반 SSL 연결이다. 여기서 한 가지 질문이 생긴다. 응용인 터널 프로그램이 어떻게 IP 패킷을 얻는가. 응용은 보통 소켓으로 커널과 주고받는데, 소켓으로는 커널이 패킷의 데이터 부분만 넘겨준다. IP 패킷 전체를 다루려면 다른 통로가 필요하다.

![TLS/SSL VPN 개요: VPN 클라이언트와 서버가 새 헤더로 감싼 패킷을 주고받고 원래 패킷은 U에서 V로 향한다](./images/net-vpn-tls-overview.svg '바깥 패킷은 VPN 클라이언트에서 서버로, 안의 원래 패킷은 U에서 V로 향한다')

그 통로가 TUN/TAP 인터페이스(TUNnel/terminal access point interface)다. 대부분의 운영체제에는 물리 네트워크 카드(NIC)에 대응하는 물리 인터페이스와, NIC에 꼭 대응하지는 않는 가상 인터페이스(예: 루프백)가 있다. TUN 가상 인터페이스는 OSI 3계층(IP 수준)에서 동작하며, TUN에 보낸 패킷은 사용자 공간 프로그램에 전달된다. TAP 가상 인터페이스는 2계층(이더넷 수준)에서 동작하며 가상 네트워크 어댑터를 제공한다.

![TUN/TAP 인터페이스: 응용은 소켓으로, 사용자 공간 프로그램은 TUN/TAP 인터페이스로 커널과 주고받는다](./images/net-vpn-tuntap.svg 'TUN은 IP 수준, TAP은 이더넷 수준에서 사용자 공간 프로그램에 패킷을 넘긴다')

TUN 인터페이스는 `/dev/net/tun{:bash}` 장치를 열고 `ioctl(){:c}`에 `IFF_TUN{:c}` 플래그를 주어 만든다.

```c
int tunfd;
struct ifreq ifr;
memset(&ifr, 0, sizeof(ifr));
ifr.ifr_flags = IFF_TUN | IFF_NO_PI;        // TUN 인터페이스 생성
tunfd = open("/dev/net/tun", O_RDWR);
ioctl(tunfd, TUNSETIFF, &ifr);
```

만든 인터페이스는 `ifconfig{:bash}`로 찾고, IP 주소를 할당해 활성화한다.

```bash
# tun0 인터페이스에 IP를 주고 올린다
sudo ifconfig tun0 10.0.8.99/24 up
```

라우팅을 설정하면 특정 목적지로 가는 패킷이 `tun0{:bash}` 인터페이스로 향하고, 그 패킷은 터널을 지난다. 나머지 트래픽은 물리 인터페이스로 평소처럼 나간다.

![TUN 인터페이스 라우팅: 응용의 패킷이 라우팅을 거쳐 tun0으로 향하면 TUN 프로그램이 받아 소켓으로 보낸다](./images/net-vpn-tun-routing.svg '라우팅이 특정 목적지 패킷을 터널로 보낸다')

## TUN으로 VPN 만들기

터널은 두 응용(VPN 클라이언트와 서버)이 세우는 TLS/SSL 연결이고, 그 안의 트래픽은 TLS/SSL로 보호된다. 이 연결을 터널로 만드는 것은 페이로드가 IP 패킷이라는 점이다. 그래서 IP 터널이라 부른다.

![터널로 패킷을 보내고 받기: TUN 인터페이스에서 읽은 패킷을 암호화해 IP 터널로 보내고, 터널에서 받은 데이터를 복호화해 TUN 인터페이스에 쓴다](./images/net-vpn-tun-crypto.svg '보내기는 TUN→암호화→소켓, 받기는 소켓→복호화→TUN 순서다')

보내기는 TUN 인터페이스에서 IP 패킷을 얻어 암호화(와 MAC 부가)한 뒤 터널 반대편으로 페이로드로 보낸다. 받기는 터널에서 페이로드를 얻어 복호화하고 무결성을 검증해 원래 패킷을 복원한 뒤 TUN 인터페이스에 쓴다. 각 터널 응용은 소켓과 TUN 두 인터페이스를 가지므로 둘 다 감시하며 사이에서 패킷을 전달한다.

![두 인터페이스 감시 흐름도: TUN 생성, 터널 설정 뒤 TUN과 소켓 중 데이터가 온 쪽에서 반대쪽으로 패킷 전달](./images/net-vpn-loop.svg 'TUN과 소켓 중 준비된 쪽을 골라 반대쪽으로 패킷을 넘긴다')

TUN에서 소켓으로 보내는 쪽은 TUN을 읽어 소켓으로 보낸다. 반대쪽은 소켓을 읽어 TUN에 쓴다. 암호화·복호화 단계는 핵심 흐름을 보이려고 아래 코드에서 생략했다.

```c
// TUN에서 읽어 소켓으로 (암호화 생략)
void tunSelected(int tunfd, int sockfd) {
    char buff[BUFF_SIZE];
    int len = read(tunfd, buff, BUFF_SIZE);
    sendto(sockfd, buff, len, 0,
           (struct sockaddr *)&peerAddr, sizeof(peerAddr));
}
// 소켓에서 읽어 TUN으로 (복호화 생략)
void socketSelected(int tunfd, int sockfd) {
    char buff[BUFF_SIZE];
    int len = recvfrom(sockfd, buff, BUFF_SIZE, 0, NULL, NULL);
    write(tunfd, buff, len);
}
```

두 인터페이스를 동시에 감시하려면 `select(){:c}`를 쓴다. `select(){:c}`는 두 인터페이스 중 하나에 데이터가 올 때까지 멈춰 있다가, 준비된 쪽에 맞는 처리 함수를 호출한다.

```c
int main() {
    int tunfd  = createTunDevice();
    int sockfd = connectToUDPServer();
    while (1) {
        fd_set readFDSet;
        FD_ZERO(&readFDSet);
        FD_SET(sockfd, &readFDSet);
        FD_SET(tunfd, &readFDSet);
        select(FD_SETSIZE, &readFDSet, NULL, NULL, NULL);
        if (FD_ISSET(tunfd, &readFDSet))  tunSelected(tunfd, sockfd);
        if (FD_ISSET(sockfd, &readFDSet)) socketSelected(tunfd, sockfd);
    }
}
```

## VPN 설정과 테스트

구성은 클라이언트와 서버가 각각 `tun0{:bash}` 인터페이스를 두고, 사설망 쪽 호스트가 응답을 같은 터널로 돌려보내도록 라우팅을 맞추는 일이다.

![VPN 구성 사례: VPN 클라이언트(호스트 U, tun0 10.4.2.99)와 VPN 서버(tun0 10.4.2.5, 192.168.60.5)가 인터넷으로 이어지고, 서버 뒤 192.168.60.0/24 내부망에 호스트 V(192.168.60.6)가 있는 구성](./images/net-vpn-setup.svg 'tun0 인터페이스는 10.4.2.0/24, 보호할 내부망은 192.168.60.0/24다')

VPN 서버는 서버 프로그램을 실행한 뒤 `tun0{:bash}`을 설정한다. TUN 인터페이스의 IP 접두사로 `10.4.2.0/24{:bash}`를 쓴다. IP를 할당해 올리고 해당 경로를 라우팅 표에 더한다.

```bash
sudo ifconfig tun0 10.4.2.5/24 up
sudo route add -net 10.4.2.0/24 tun0
```

VPN 클라이언트는 클라이언트 프로그램을 실행하고 `10.4.2.0/24{:bash}` 경로를 더한 뒤, 보호할 내부망 `192.168.60.0/24{:bash}`로 가는 모든 패킷을 `tun0{:bash}`으로 보내도록 경로를 더한다.

```bash
sudo ifconfig tun0 10.4.2.99/24 up
sudo route add -net 10.4.2.0/24 tun0
sudo route add -net 192.168.60.0/24 tun0
```

응답 패킷이 같은 터널로 돌아오게 하려면, 사설망의 호스트도 `10.4.2.0/24{:bash}` 행 패킷을 VPN 서버로 라우팅하도록 경로를 더한다. 그래야 응답도 터널 안에서 보호된다.

구성을 마치면 사설망의 호스트에 ping과 telnet으로 접속해 확인한다. 터널을 끊고 관찰하면 흥미로운 점이 드러난다. telnet 연결은 끊기지 않는다. TCP가 패킷을 계속 재전송하지만 터널이 끊겨 전달되지 못할 뿐이다. 입력한 내용은 TCP 버퍼에 쌓여 있다가, 터널을 다시 연결하면 그동안 입력한 내용이 한꺼번에 나타난다.

> [!TIP] 터널이 끊겨도 데이터는 잃지 않는다
> telnet 위의 TCP는 터널 장애를 네트워크 지연으로 받아들여 재전송을 계속한다. 터널이 복구되면 버퍼에 쌓인 세그먼트가 전달되므로 데이터 손실 없이 세션이 이어진다. VPN 터널과 그 위의 TCP가 독립적으로 동작하기 때문이다.

## VPN으로 방화벽 우회

방화벽이 특정 사이트로 가는 트래픽을 막더라도, VPN 터널은 그 트래픽을 암호화된 페이로드 안에 숨겨 통과시킨다. 방화벽은 터널의 바깥 헤더만 보므로 안에 담긴 목적지를 보지 못한다.

![VPN으로 방화벽 우회: 차단 대상 사이트(ex. facebook.com)로 직접 가는 경로는 방화벽에서 막히고, VPN 터널로 VPN 서버에 간 패킷을 서버가 대신 사이트로 보내고 응답을 받는다](./images/net-vpn-bypass.svg '차단 대상 패킷이 터널 안에 숨어 VPN 서버를 거쳐 나간다')

동작 원리는 네 단계다. 차단 대상 패킷을 VPN 서버 쪽 TUN 인터페이스로 보내면, VPN 서버가 그 패킷을 인터넷으로 내보낸다. 응답은 VPN 서버로 돌아오고, 서버가 터널을 통해 사용자에게 되돌려 보낸다. 응답이 VPN 서버로 돌아오는 이유는 그 패킷의 출발지가 VPN 서버 주소로 바뀌어 나갔기 때문이다.

![방화벽 우회 실험 구성: 차단 대상 사이트로 가는 패킷 F가 VPN 클라이언트의 tun0(10.4.2.99)에서 터널을 거쳐 VPN 서버의 tun0(10.4.2.5)으로 가고, 서버의 NAT를 지나 사이트로 나간다. 물리 인터페이스는 eth6(10.0.2.6)과 eth5(10.0.2.5)](./images/net-vpn-bypass-setup.svg '사용자의 tun0으로 보낸 트래픽이 VPN 서버를 거쳐 나간다')

먼저 방화벽이 특정 사이트로 가는 사용자의 트래픽을 막는다. 사이트가 소유한 IP 접두사 목록이나 DNS가 돌려주는 주소는 `whois{:bash}`와 `dig{:bash}`로 조회해 규칙에 반영한다. 이 상태에서는 사용자가 사이트에 닿지 못한다.

우회는 라우팅 한 줄로 이뤄진다. 사용자 머신에서 해당 사이트로 가는 트래픽의 경로를 물리 인터페이스 대신 TUN 인터페이스로 바꾸면, 그 트래픽은 터널 안에 숨어 VPN 서버로 간다.

```bash
# 차단 대상 IP 범위를 tun0으로 라우팅 (예시 주소)
sudo route add -net 203.0.113.0/24 tun0
```

패킷이 VPN 서버 주소로 감싸여 나가므로 방화벽의 패킷 필터링 규칙에 걸리지 않는다. VPN 서버가 패킷을 인터넷으로 내보내고, 응답을 받아 터널로 되돌려 준다.

> [!CAUTION] 터널은 양날의 칼
> 같은 VPN 기술이 안전한 원격 접속을 제공하면서 동시에 방화벽 정책 우회에도 쓰인다. 터널 안이 암호화돼 내용 기반 필터링이 통하지 않으므로, 조직에서는 신뢰하는 VPN 종단점만 허용하고 알 수 없는 아웃바운드 터널을 감시한다.

## 정리

VPN은 공용망 위에 암호화된 사설망을 세운다. 핵심은 IP 터널링으로, 보호할 IP 패킷을 통째로 페이로드에 담고 새 IP 헤더로 감싸 공용망으로 보낸 뒤 반대편에서 꺼낸다. 캡슐화를 커널에서 하면 IPsec, 응용 수준에서 TCP·UDP 위에 하면 TLS/SSL VPN이다.

| 구성 요소      | 역할                                       |
| -------------- | ------------------------------------------ |
| TUN 인터페이스 | IP 패킷 전체를 사용자 공간 프로그램에 전달 |
| 터널 응용      | TUN과 소켓을 감시하며 암호화·복호화해 전달 |
| 라우팅         | 보호할 목적지 패킷을 TUN으로 보냄          |
| VPN 서버       | 터널 종단, 사설망·인터넷과 중개            |

TLS/SSL VPN은 TUN 가상 인터페이스로 IP 패킷을 얻고, `select(){:c}`로 TUN과 소켓을 감시하며 사이에서 패킷을 전달한다. 라우팅으로 트래픽을 터널에 태우면 방화벽이 보지 못하는 통로가 생긴다. 네트워크 보안 연재는 전송 프로토콜의 동작에서 시작해, 그것을 노리는 공격과 경계의 방화벽, 그리고 터널 전체를 보호하는 VPN까지 이어졌다.

<details>
<summary>참고 문헌</summary>

- S. Kent, K. Seo, "Security Architecture for the Internet Protocol," RFC 4301, 2005. <https://www.rfc-editor.org/rfc/rfc4301>
- T. Dierks, E. Rescorla, "The Transport Layer Security (TLS) Protocol Version 1.2," RFC 5246, 2008. <https://www.rfc-editor.org/rfc/rfc5246>
- Wenliang Du, _Computer & Internet Security: A Hands-on Approach_, 2nd Ed., 2019.

</details>
