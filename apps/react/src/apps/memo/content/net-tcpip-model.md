---
title: TCP/IP 계층 모델과 캡슐화
date: 2021-09-13
category: 학습/CS/네트워크 보안
series: 네트워크 보안
seriesOrder: 1
summary: TCP/IP 4계층과 OSI 7계층의 대응, 헤더를 겹겹이 붙이는 캡슐화와 식별자로 받을 프로그램을 찾는 역다중화, 포트 번호와 RFC 표준화 과정, 이더넷·SLIP·PPP 링크 계층과 MTU를 정리했다.
---

## 들어가기 전에

TCP/IP는 서로 다른 하드웨어와 운영체제를 쓰는 컴퓨터가 하나의 인터넷으로 데이터를 주고받게 하는 프로토콜 묶음이다. 프로토콜(protocol)은 통신하는 양쪽이 지키는 메시지 형식과 교환 순서의 규칙이다. 예를 들어 HTTP는 요청 첫 줄을 `GET /index.html HTTP/1.1`처럼 메서드, 경로, 버전 순서로 적도록 정하고, 서버는 이 형식을 해석해 응답한다. 1960년대 후반의 패킷 교환 연구에서 출발해 1990년대에는 컴퓨터를 연결하는 사실상의 공통 형식이 되었다. 네트워크 보안의 공격과 방어는 거의 모두 이 프로토콜 묶음의 특정 계층, 특정 헤더 필드를 대상으로 한다. 스푸핑은 발신지 주소 필드를, SYN 플러딩은 TCP 연결 설정 절차를, 방화벽 규칙은 포트 번호를 다룬다.

계층 구조가 없던 시절을 생각하면 필요성이 분명하다. 웹 브라우저가 이더넷 카드의 레지스터 사용법, 와이파이의 재전송 규칙, 라우터의 경로 선택을 모두 직접 처리해야 한다면, 네트워크 카드를 교체하면 모든 응용 프로그램을 다시 작성해야 한다. 계층화는 이 일을 네 개의 층으로 나누고 층 사이의 약속만 고정한다. 브라우저는 TCP에 바이트를 넘길 뿐이고, 그 바이트가 이더넷으로 나가는지 PPP로 나가는지 알 필요가 없다.

핵심 질문은 두 가지다. 한 응용의 데이터는 송신 시각에 어떤 헤더를 어떤 순서로 얻어 전선 위의 프레임이 되는가. 그리고 수신 호스트는 그 프레임을 보고 수많은 프로그램 중 어느 것에 데이터를 넘길지 어떻게 결정하는가.

| 순서 | 내용                                                      |
| ---- | --------------------------------------------------------- |
| 1    | 네트워크의 분류와 통신 방식                               |
| 2    | TCP/IP 4계층, OSI 7계층과의 대응, 계층별 프로토콜         |
| 3    | 인터넷 주소의 클래스, DNS                                 |
| 4    | 캡슐화와 역다중화, 계층별 PDU 이름                        |
| 5    | 클라이언트-서버 모델과 포트 번호                          |
| 6    | 표준화 조직과 RFC, 표준 단순 서비스, BSD 구현과 API       |
| 7    | 링크 계층: 이더넷·IEEE 802 캡슐화, SLIP, PPP, 루프백, MTU |

특별한 선행 지식은 필요 없다. 2진수와 16진수 변환, 비트와 바이트의 관계만 알면 된다. 여기서 소개하는 IP 헤더와 주소 체계는 [IP 헤더와 서브넷, ARP 주소 변환](/memo/net-ip-arp)에서, TCP와 UDP 헤더는 [UDP와 TCP의 헤더, 연결 설정과 종료, 상태 전이](/memo/net-udp-tcp)에서 필드 단위로 다룬다.

## 네트워크의 분류와 통신 방식

네트워크는 노드(node)가 데이터를 공유하도록 통신 회선으로 연결한 체계다. 노드는 네트워크에 속한 컴퓨터나 통신 장비를 가리킨다. 인터넷(Internet)은 이런 네트워크를 전 세계 규모로 연결한 가장 큰 네트워크이고, 흔히 인터넷과 같은 뜻으로 쓰는 WWW는 인터넷 위에서 웹 문서를 주고받는 서비스 하나다.

크기로 나누면 건물이나 가정처럼 가까운 지역을 묶은 LAN(Local Area Network), 도시 규모의 MAN(Metropolitan Area Network), 멀리 떨어진 LAN들을 다시 묶은 WAN(Wide Area Network)이 있다. 집, 회사, 학원의 LAN이 각자 있고 이들을 잇는 통신사 망이 WAN이다.

연결 형태로 나누면 다음과 같다.

| 형태         | 구조                               | 특징                                                     |
| ------------ | ---------------------------------- | -------------------------------------------------------- |
| 성형(star)   | 중앙 장비 하나에 모든 노드 연결    | 가정의 공유기가 예. 중앙 장비가 고장 나면 전체가 끊긴다  |
| 망형(mesh)   | 노드끼리 그물처럼 여러 경로로 연결 | 한 회선이 끊겨도 우회 경로가 있다. 국가 간 해저 케이블망 |
| 트리형(tree) | 나뭇가지처럼 계층적으로 연결       | 상위 장비 아래로 하위 장비를 확장한다                    |
| 링형, 버스형 | 고리 모양, 공유 회선 하나          | 토큰 링, 초기 동축 케이블 이더넷                         |

![네트워크 연결 형태: 링형(Ring), 망형(Mesh), 성형(Star), 완전 연결형(Fully Connected), 선형(Line), 트리형(Tree), 버스형(Bus)의 노드와 회선 배치](./images/net-tcpip-model-topologies.jpg '초록 원이 노드, 검은 선이 통신 회선이다')

실제 인터넷은 이 형태들을 섞은 혼합형이다. 가정 안은 공유기를 중심으로 한 성형이고, 통신사의 백본은 한 회선이 끊겨도 우회할 수 있도록 망형으로 연결된다.

수신 대상의 수로 나누면 통신 방식은 세 가지다. 유니캐스트(unicast)는 특정 대상 하나와 1:1로, 멀티캐스트(multicast)는 특정 그룹과 1:N으로, 브로드캐스트(broadcast)는 같은 네트워크의 모든 대상과 통신한다. 뒤에서 볼 ARP 요청은 브로드캐스트, 그 응답은 유니캐스트다.

## TCP/IP의 계층화

### 네 계층과 OSI 7계층

TCP/IP 프로토콜 묶음은 네 계층으로 이루어진다.

![TCP/IP 4계층 표: 응용(Telnet, FTP, e-mail), 트랜스포트(TCP, UDP), 네트워크(IP, ICMP, IGMP), 링크(장치 드라이버와 인터페이스)](./images/net-tcpip-model-01.jpg '아래 계층일수록 하드웨어에 가깝다')

국제 표준화 기구 ISO는 1984년 OSI(Open System Interconnection) 참조 모델을 표준으로 정했다. OSI는 통신 기능을 일곱 계층으로 나눈 역할 중심의 모델이고, TCP/IP는 실제로 쓰이던 프로토콜을 중심으로 정리한 모델이다.

![OSI 7계층과 TCP/IP 4계층 대응: OSI의 응용·표현·세션이 TCP/IP 응용 계층에, 트랜스포트와 네트워크는 일대일로, 데이터 링크·물리가 네트워크 인터페이스 계층에 대응한다](./images/net-tcpip-model-osi.svg 'OSI 상위 세 계층이 TCP/IP에서는 응용 하나로 합쳐진다')

| OSI 계층      | TCP/IP 계층               | 대표 프로토콜·장비                      | PDU 이름         |
| ------------- | ------------------------- | --------------------------------------- | ---------------- |
| 7 응용        | 응용                      | HTTP, SMTP, FTP, Telnet, SSH, DNS, SNMP | 메시지           |
| 6 표현        | 응용                      | 데이터 표현 변환(XDR 등)                |                  |
| 5 세션        | 응용                      | NetBIOS                                 |                  |
| 4 트랜스포트  | 트랜스포트                | TCP, UDP                                | 세그먼트         |
| 3 네트워크    | 네트워크(인터넷)          | IP, ICMP, IGMP                          | 패킷(데이터그램) |
| 2 데이터 링크 | 링크(네트워크 인터페이스) | 이더넷, PPP, 무선 LAN, ARP              | 프레임           |
| 1 물리        | 링크(네트워크 인터페이스) | 전선, 광섬유, 리피터, 모뎀              | 비트             |

두 모델은 모두 계층 구조이고 계층마다 역할을 정의한다는 공통점이 있다. 차이는 계층 수와 출발점이다. OSI는 통신 전반을 표준화하려는 역할 기반 모델이고, TCP/IP는 데이터 전송 기술에 특화된 프로토콜 기반 모델이다. ARP는 IP 주소를 다루지만 링크 계층의 프레임으로 운반되므로 2계층과 3계층 사이에 놓인다고 보는 편이 정확하다.

### 계층별 역할

링크 계층은 데이터 링크 계층, 네트워크 인터페이스 계층이라고도 부른다. 운영체제의 장치 드라이버와 네트워크 인터페이스 카드(NIC)를 포함하고, 케이블과의 물리적 인터페이스를 다루는 하드웨어 세부 사항을 처리한다. 같은 네트워크(LAN) 안에서 어느 장비가 어느 장비로 프레임을 보내는지를 MAC 주소로 구분한다.

네트워크 계층은 인터넷 계층이라고도 부르며, 네트워크 사이에서 패킷이 이동하는 경로를 제어한다(라우팅). IP, ICMP, IGMP가 여기에 속한다. 2계층만으로는 같은 LAN 안에서만 통신할 수 있고, 다른 네트워크와 통신하려면 반드시 3계층의 주소와 프로토콜이 필요하다.

트랜스포트 계층은 두 호스트의 응용 사이에 데이터 흐름을 제공한다. TCP는 데이터를 적당한 크기로 분할하고, 수신 확인을 받고, 타임아웃이 지나면 재전송해 신뢰성 높은 흐름을 만든다. UDP는 데이터그램을 보내기만 하는 단순한 서비스를 제공하고 신뢰성은 응용이 책임진다.

응용 계층은 특정 응용의 세부 동작을 처리한다. 원격 로그인 Telnet, 파일 전송 FTP(File Transfer Protocol), 전자 메일 SMTP(Simple Mail Transfer Protocol), 네트워크 관리 SNMP(Simple Network Management Protocol)가 대표적이다.

==응용 계층은 사용자 프로세스에서, 아래 세 계층은 운영체제 커널에서 동작한다.== 응용은 통신 세부를 몰라도 되고, 커널은 응용의 의미를 몰라도 된다.

### 같은 LAN과 라우터를 거치는 통신

이더넷으로 연결된 두 호스트가 FTP를 실행하면 각 계층은 상대 호스트의 같은 계층과 대화한다.

![LAN 위 두 호스트의 FTP: FTP 클라이언트-서버, TCP-TCP, IP-IP, 이더넷 드라이버-이더넷 드라이버가 각 계층의 프로토콜로 대화하고 실제 데이터는 이더넷 선으로 흐른다](./images/net-tcpip-model-03.jpg '점선 화살표가 계층별 논리적 통신, 실선이 실제 데이터 경로다')

FTP 클라이언트가 보낸 명령은 실제로는 TCP, IP, 이더넷 드라이버를 차례로 내려가 선을 타고 상대 호스트에서 다시 올라간다. 그러나 각 계층의 설계자는 상대 호스트의 같은 계층과 직접 대화한다고 보고 프로토콜을 설계한다. 이 관점이 계층화의 핵심이다. FTP 프로그램을 작성하는 사람은 FTP 명령의 형식만 정하면 되고, 그 명령이 TCP 세그먼트 몇 개로 나뉘는지, 어느 이더넷 카드로 나가는지는 아래 계층이 처리한다.

인터넷을 구성하는 가장 쉬운 방법은 라우터(router)로 둘 이상의 네트워크를 연결하는 일이다.

![이더넷과 토큰 링을 잇는 라우터: 라우터는 IP와 이더넷·토큰 링 드라이버만 갖고, FTP와 TCP 프로토콜은 양 끝 호스트 사이에서만, IP 프로토콜은 홉마다 동작한다](./images/net-tcpip-model-router.svg '라우터는 네트워크 계층까지만 처리한다')

이 그림에서 응용 계층과 트랜스포트 계층은 양 끝 호스트 사이의 종단 간(end-to-end) 프로토콜이다. 반면 IP는 홉 단위(hop-by-hop) 프로토콜이라 양 끝 호스트와 중간 라우터가 모두 IP를 처리한다. 라우터는 이더넷 쪽에서 받은 데이터그램을 토큰 링 쪽 프레임에 다시 담아 보낸다.

인터페이스가 둘 이상인 시스템을 멀티홈드(multihomed) 시스템이라 한다. 멀티홈드 호스트는 설정에 따라 라우터 역할도 할 수 있어서 상황에 따라 호스트라고도 라우터라고도 부른다. 인터넷이 강력하고 편리한 이유는 응용에서 물리적 접속 방식이 감추어져 있기 때문이다. 네트워크를 연결하는 또 다른 방법인 브리지(bridge)는 링크 계층에서 두 네트워크를 이어 하나의 네트워크처럼 보이게 한다.

### TCP/IP 프로토콜 그룹의 구성

![TCP/IP 프로토콜 관계도: 사용자 프로세스는 TCP·UDP를 거치거나 ICMP·IP에 직접 닿고, TCP·UDP는 IP로 모이며, 네트워크 계층에 ICMP·IP·IGMP, 링크 계층에 ARP·하드웨어 인터페이스·RARP, 맨 아래 매체가 있다](./images/net-tcpip-model-protocols.svg '모든 상위 데이터는 IP를 거친다')

트랜스포트 계층의 두 프로토콜은 쓰임새가 다르다.

| 구분   | TCP 응용                                  | UDP 응용                                  |
| ------ | ----------------------------------------- | ----------------------------------------- |
| 예     | Telnet, Rlogin, FTP, SMTP, HTTP           | DNS 질의, TFTP, BOOTP(DHCP), SNMP         |
| 공통점 | 큰 데이터를 순서대로 빠짐없이 받아야 한다 | 짧은 요청·응답, 손실 시 응용이 재전송한다 |

ICMP(Internet Control Message Protocol)는 IP를 이용해 오류 메시지와 제어 정보를 다른 호스트나 라우터의 IP 계층과 교환한다. 사용자는 ping과 traceroute로 ICMP를 직접 쓸 수 있다. IGMP(Internet Group Management Protocol)는 UDP 데이터그램을 여러 호스트에 동시에 보내는 멀티캐스팅의 그룹 가입을 관리한다. ARP(Address Resolution Protocol)와 RARP(Reverse ARP)는 IP 주소와 MAC 주소를 서로 변환한다.

## 인터넷 주소와 DNS

### 클래스 주소

인터넷의 모든 인터페이스는 고유한 32비트 인터넷 주소(IP 주소)를 갖는다. 초기 주소 체계는 앞 몇 비트로 클래스를 정하고, 클래스마다 네트워크 ID(netid)와 호스트 ID(hostid)의 경계를 고정했다.

![클래스 A~E의 비트 구조: A는 0 뒤 7비트 네트워크 ID(netid)와 24비트 호스트 ID(hostid), B는 10 뒤 14비트와 16비트, C는 110 뒤 21비트와 8비트, D는 1110 뒤 28비트 멀티캐스트 그룹 ID, E는 11110 뒤 예약](./images/net-tcpip-model-classes.svg '선두 비트 패턴이 클래스를 결정한다')

| 클래스 | 선두 비트 | 범위                        | 네트워크 수 | 네트워크당 호스트 수 |
| ------ | --------- | --------------------------- | ----------- | -------------------- |
| A      | 0         | 0.0.0.0 ~ 127.255.255.255   | 128         | 16,777,214           |
| B      | 10        | 128.0.0.0 ~ 191.255.255.255 | 16,384      | 65,534               |
| C      | 110       | 192.0.0.0 ~ 223.255.255.255 | 2,097,152   | 254                  |
| D      | 1110      | 224.0.0.0 ~ 239.255.255.255 | 멀티캐스트  |                      |
| E      | 1111      | 240.0.0.0 ~ 255.255.255.255 | 예약        |                      |

<details>
<summary>네트워크 수와 호스트 수 계산</summary>

클래스 A는 선두 비트 1개를 빼면 netid가 7비트, hostid가 24비트다. 호스트 ID가 모두 0인 주소는 네트워크 자체를, 모두 1인 주소는 브로드캐스트를 뜻하므로 두 개를 뺀다.

```math
\text{A: } 2^7 = 128,\quad 2^{24} - 2 = 16{,}777{,}214
```

```math
\text{B: } 2^{14} = 16{,}384,\quad 2^{16} - 2 = 65{,}534
```

```math
\text{C: } 2^{21} = 2{,}097{,}152,\quad 2^{8} - 2 = 254
```

클래스 A의 128개 중 0.0.0.0/8과 루프백용 127.0.0.0/8은 일반 네트워크로 쓰지 않는다.

</details>

호스트가 수백 대인 기관은 C 하나로 부족하고 B 하나(65,534대)는 너무 컸다. 클래스 경계가 고정된 이 낭비 때문에 1993년 CIDR(Classless Inter-Domain Routing)이 도입되어 지금은 `198.51.100.64/26`처럼 접두사 길이를 자유롭게 정한다. `/26`은 앞 26비트가 네트워크 부분이라는 뜻이고, 남은 6비트로 호스트 62개(2^6 − 2)를 구분한다. 서브넷과 CIDR은 [IP 헤더와 서브넷, ARP 주소 변환](/memo/net-ip-arp)에서 계산 예제와 함께 다룬다.

주소의 유형은 세 가지다. 유니캐스트 주소는 호스트 하나, 브로드캐스트 주소는 특정 네트워크의 모든 호스트(호스트 ID가 모두 1), 멀티캐스트 주소는 그룹에 속한 호스트들을 가리킨다. 주소 할당은 IANA가 지역 인터넷 레지스트리에 블록을 나눠 주고, 국내 주소와 도메인 이름은 KRNIC이 관리한다. 초기에는 InterNIC이 등록, 디렉터리, 정보 서비스를 맡았다.

### DNS

DNS(Domain Name System)는 호스트 이름과 IP 주소의 대응을 제공하는 분산 데이터베이스다. 이름으로 주소를 찾는 정방향 조회와 주소로 이름을 찾는 역방향 조회가 모두 가능하다. 사람은 `www.example.com` 같은 이름을 기억하고, 응용은 통신 직전에 DNS로 주소를 얻는다. DNS의 계층 구조와 캐시 오염 공격은 [DNS의 계층 구조와 캐시 오염 공격, DNSSEC 방어](/memo/net-dns-attack)에서 다룬다.

## 캡슐화

### 헤더를 겹겹이 붙이는 과정

응용이 TCP로 데이터를 보내면 데이터는 프로토콜 스택을 내려가며 계층마다 헤더(header)를 얻고, 링크 계층에서는 트레일러(trailer)도 붙는다. 이 과정을 캡슐화(encapsulation)라 한다. 각 계층은 위 계층에서 받은 바이트 전체를 내용을 해석하지 않고 데이터로 취급하며, 자기 계층의 헤더만 앞에 붙인다. 이더넷 헤더는 라우터를 지날 때마다 새로 만들어지지만, 그 안의 IP 헤더와 TCP 헤더는 목적지 호스트까지 유지된다.

![캡슐화 개념: 응용 계층의 데이터에 트랜스포트 계층이 TCP 헤더를, 네트워크 계층이 IP 헤더를, 네트워크 접근 계층이 프레임 헤더와 프레임 트레일러를 붙인다](./images/net-tcpip-model-encapsulation.svg '아래 계층은 위 계층 전체를 데이터로 취급한다')

![TCP를 이용한 캡슐화의 크기: 사용자 데이터에 응용 헤더, TCP 헤더 20, IP 헤더 20, 이더넷 헤더 14와 트레일러 4바이트가 차례로 붙고, TCP 세그먼트·IP 데이터그램·이더넷 프레임으로 이름이 바뀌며 이더넷 데이터 부분은 46~1500바이트](./images/net-tcpip-model-ethernet-encap.svg '각 계층의 PDU 이름이 다르다')

계층마다 데이터 단위의 이름이 다르다. 이를 PDU(Protocol Data Unit)라 한다.

| 계층       | PDU 이름                     | 정의                                            |
| ---------- | ---------------------------- | ----------------------------------------------- |
| 트랜스포트 | TCP 세그먼트, UDP 데이터그램 | TCP·UDP가 IP에 넘기는 단위 (UDP 헤더는 8바이트) |
| 네트워크   | IP 데이터그램(패킷)          | IP가 네트워크 인터페이스에 넘기는 단위          |
| 링크       | 프레임                       | 이더넷 위로 전달되는 비트 스트림                |

구체적인 값으로 따라가면 다음과 같다. 클라이언트 `192.0.2.10`의 브라우저가 서버 `203.0.113.80`에 `GET / HTTP/1.1`과 `Host: www.example.com` 두 줄, 빈 줄로 이루어진 41바이트 요청을 보낸다고 하자.

1. TCP가 출발지 포트 49152(커널이 고른 임시 포트), 목적지 포트 80을 담은 20바이트 헤더를 붙인다. TCP 세그먼트는 61바이트다.
2. IP가 protocol 필드를 6(TCP)으로 적은 20바이트 헤더를 붙인다. IP 데이터그램은 81바이트이고 Total Length 필드 값도 81이다.
3. 이더넷 드라이버가 type 필드 0x0800(IPv4)을 담은 14바이트 헤더와 4바이트 FCS를 붙인다. 프레임은 99바이트다.

![41바이트 HTTP 요청이 TCP 헤더 20(포트 49152 → 80), IP 헤더 20(protocol 6), 이더넷 헤더 14(type 0x0800)와 FCS 4를 얻어 99바이트 프레임이 되고, 수신 쪽은 type 0x0800, protocol 6, 목적지 포트 80 순서로 확인해 웹 서버 프로세스에 전달한다](./images/net-tcpip-model-http-example.svg '송신 쪽이 붙인 세 식별자를 수신 쪽은 반대 순서로 확인한다')

엄밀히는 IP 데이터그램이 조각화(fragmentation)되면 각 조각을 패킷이라 부르지만, 일상에서는 패킷과 데이터그램을 섞어 쓴다. 수신 쪽은 반대로 헤더를 하나씩 벗겨 낸다. 이를 디캡슐화(decapsulation)라 한다.

이더넷 프레임의 데이터 부분은 46~1500바이트다. 상한 1500은 이더넷의 MTU이고, 하한 46은 최소 프레임 길이 64바이트에서 헤더 14와 FCS(Frame Check Sequence) 4를 뺀 값이다. 10Mbps 이더넷은 충돌을 감지하려면 송신이 끝나기 전에 충돌 신호가 돌아와야 해서, 왕복 전파 시간에 해당하는 512비트(64바이트) 이상을 보내도록 정했다.

### 작은 데이터의 오버헤드

Telnet처럼 키 입력 한 번에 1바이트를 보내는 대화형 응용은 헤더 비용이 크다.

![키 입력 1바이트 프레임: 이더넷 헤더 14, IP 헤더 20, TCP 헤더 20, 데이터 1, 패딩 5, FCS 4로 총 64바이트](./images/net-tcpip-model-overhead.svg '헤더가 데이터의 수십 배다')

```math
\text{사용자 데이터 비율} = \frac{1}{14 + (20 + 20 + 1 + 5) + 4} = \frac{1}{64} \approx 1.6\%
```

1바이트를 보내려고 64바이트를 전송한다. 프리앰블 8바이트와 프레임 간 간격 12바이트까지 치면 선로에서는 84바이트 시간이 든다. 뒤에서 볼 CSLIP이 헤더 압축을 도입한 이유가 이 비율이다.

## 역다중화

### 식별자 세 개

수신 호스트는 프레임을 받으면 스택을 올라가며 헤더의 식별자를 보고 데이터를 넘길 다음 상위 계층을 정한다. 이를 역다중화(demultiplexing)라 한다. 송신 쪽에서 여러 응용의 데이터를 한 회선에 섞는 다중화의 반대 과정이다.

![역다중화: 수신 프레임을 이더넷 헤더의 프레임 유형으로 ARP·IP·RARP에 나누고, IP 헤더의 프로토콜 값으로 ICMP·IGMP·TCP·UDP에 나누고, TCP·UDP 헤더의 목적지 포트로 응용에 나눈다](./images/net-tcpip-model-demux-tree.svg '세 번의 분기를 거쳐 응용에 도착한다')

| 단계 | 헤더    | 필드(크기)          | 값의 예                              |
| ---- | ------- | ------------------- | ------------------------------------ |
| 1    | 이더넷  | type(16비트)        | 0x0800 IPv4, 0x0806 ARP, 0x8035 RARP |
| 2    | IP      | protocol(8비트)     | 1 ICMP, 2 IGMP, 6 TCP, 17 UDP        |
| 3    | TCP·UDP | 목적지 포트(16비트) | 22 SSH, 53 DNS, 80 HTTP              |

![역다중화 구체 값: 프레임 type 0x0800이면 IP, 0x0806이면 ARP, IP protocol 1·6·17이면 ICMP·TCP·UDP, 포트 80·22이면 웹·SSH 서버, UDP 포트 53이면 DNS 서버](./images/net-tcpip-model-demux.svg '각 분기의 값은 IANA 레지스트리에 등록되어 있다')

> [!NOTE]
> ICMP와 IGMP는 IP 데이터그램에 담겨 운반되지만 IP의 일부로 취급된다. 캡슐화 방식으로 보면 트랜스포트 계층처럼 보이고, 역할로 보면 네트워크 계층의 제어 프로토콜이다. ARP는 링크 계층 프레임에 직접 실리지만 역할은 IP를 돕는 주소 변환이다.

이 구조 때문에 방화벽은 세 식별자를 검사해 트래픽을 걸러낸다. "IPv4이고, TCP이고, 목적지 포트가 22인 패킷만 허용" 같은 규칙이 바로 이 세 단계 역다중화를 그대로 옮긴 형태다. 규칙 작성법은 [방화벽의 종류와 iptables 규칙](/memo/net-firewall)에서 다룬다.

## 클라이언트-서버 모델과 포트 번호

### 반복 서버와 병렬 서버

대부분의 네트워크 응용은 서버가 정의된 서비스를 클라이언트에 제공하는 구조다. 서버는 처리 방식에 따라 두 종류로 나뉜다.

반복 서버(iterative server)는 다음을 되풀이한다.

1. 클라이언트의 요청을 기다린다.
2. 요청을 처리한다.
3. 요청한 클라이언트에 응답을 보낸다.
4. 1로 돌아간다.

2단계 처리가 길면 그동안 다른 클라이언트는 기다려야 한다.

병렬 서버(concurrent server)는 요청이 오면 그 요청만 처리할 새 서버(프로세스나 스레드)를 시작하고 곧바로 다음 요청을 기다린다. 새 서버는 처리를 마치면 종료한다. 여러 클라이언트가 동시에 서비스를 받을 수 있다.

> [!IMPORTANT] 프로토콜과 서버 방식의 관계
> 대부분의 TCP 서버는 병렬 서버이고 대부분의 UDP 서버는 반복 서버다. TCP는 연결마다 상태를 유지하고 연결 하나가 오래 지속되므로 연결마다 처리 주체를 따로 두는 편이 자연스럽다. UDP 요청은 데이터그램 하나로 끝나는 짧은 질의가 많아 한 프로세스가 차례로 처리해도 충분하다.

병렬 TCP 서버를 `fork(){:c}`로 구현하는 코드는 [BSD 소켓 API로 만드는 TCP 서버와 클라이언트](/memo/net-socket-programming)에서 다룬다.

### 포트 번호

TCP와 UDP는 16비트 포트 번호로 응용을 식별한다. 서버는 잘 알려진 포트(well-known port)를 쓴다. FTP 21, Telnet 23, TFTP 69, Rlogin 513 같은 번호다. 클라이언트는 서버와 통신하는 동안만 존재하는 임시 포트(ephemeral port)를 커널에서 받는다.

| 범위          | 이름                   | 용도                                                 |
| ------------- | ---------------------- | ---------------------------------------------------- |
| 0 ~ 1023      | 시스템(잘 알려진) 포트 | IANA가 관리. 유닉스에서는 슈퍼유저 프로세스만 바인드 |
| 1024 ~ 49151  | 사용자(등록) 포트      | IANA에 등록해 쓰는 서비스                            |
| 49152 ~ 65535 | 동적(사설) 포트        | 임시 포트용                                          |

4.x BSD 계열은 임시 포트로 1024~5000을 할당했고, 지금 리눅스는 기본으로 32768~60999를 쓴다(`/proc/sys/net/ipv4/ip_local_port_range`). 1~1023을 슈퍼유저만 쓸 수 있게 한 예약 포트 규칙 덕분에, 클라이언트는 상대가 예약 포트를 쓰면 관리자 권한으로 실행된 정식 서버라고 가정할 수 있었다. Rlogin의 신뢰 호스트 인증이 이 가정에 기대었는데, 공격자가 자신의 장비에서는 얼마든지 루트가 될 수 있으므로 지금은 안전한 가정이 아니다.

유닉스 시스템은 서비스 이름과 포트 번호를 `/etc/services` 파일에 보관한다.

```bash
$ grep telnet /etc/services
telnet          23/tcp
$ grep domain /etc/services
domain          53/udp
domain          53/tcp
```

Telnet은 TCP 23번을, DNS는 UDP 53번과 TCP 53번을 모두 쓴다. DNS는 보통 UDP로 질의하고, 응답이 커서 잘리거나 영역 전송(zone transfer)을 하면 TCP를 쓴다.

## 표준화와 RFC

### 표준화 조직

TCP/IP 프로토콜을 관리하고 새 표준을 승인하는 인터넷 기술 그룹은 다음과 같다.

| 조직                                  | 역할                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| ISOC(Internet Society)                | 인터넷의 발전과 성장을 촉진하는 전문 단체                    |
| IAB(Internet Architecture Board)      | 기술 방향을 관리·조정하고 표준의 최종 책임을 진다            |
| IETF(Internet Engineering Task Force) | 단기 표준을 개발한다. 응용, 라우팅, 보안 등 영역별 워킹 그룹 |
| IRTF(Internet Research Task Force)    | 장기 연구 프로젝트를 추진한다                                |

### RFC

RFC(Request for Comments)는 인터넷 공식 표준을 포함한 문서 시리즈이고 문서마다 고유 번호가 붙는다. 지금은 rfc-editor.org에서 번호로 바로 조회한다.

몇 가지 중요한 RFC가 있다. 할당 번호(Assigned Numbers) RFC는 프로토콜에 쓰이는 매직 넘버와 상수를 모두 정의했다. 마지막 판이 RFC 1700(1994)이고, RFC 3232(2002) 이후로는 IANA의 온라인 레지스트리가 그 역할을 한다. 앞의 이더넷 type, IP protocol, 포트 번호 표의 값이 모두 여기에 등록되어 있다.

RFC 2026의 표준화 단계는 제안 표준(proposed standard), 초안 표준(draft standard), 인터넷 표준(Internet standard)이었고, RFC 6410(2011) 이후로는 제안 표준과 인터넷 표준 두 단계다. 표준이 아닌 RFC는 실험(experimental), 정보(informational), 역사(historic)로 분류한다. 표준의 적용 수준은 요구(required), 권고(recommended), 선택(elective), 제한 사용(limited use), 비권고(not recommended)로 나뉜다.

호스트 요구사항 RFC는 RFC 1122(링크, 네트워크, 트랜스포트 계층)와 RFC 1123(응용 계층)이다. 구현 요구 수준을 MUST, SHOULD, MAY, SHOULD NOT, MUST NOT으로 구분하는데, 이 단어들의 뜻은 RFC 2119가 정의한다. 라우터 요구사항은 RFC 1009였고 지금은 RFC 1812다.

> [!TIP]
> RFC에서 대문자 MUST는 "반드시", SHOULD는 "특별한 이유가 없으면", MAY는 "선택"을 뜻한다. 구현이 표준을 따르는지 판단하려면 이 차이를 구분해야 한다. 예를 들어 RFC 1122는 호스트가 IP 헤더 체크섬을 반드시(MUST) 검사하도록 요구한다.

### 표준 단순 서비스

대부분의 구현은 다음 단순 서비스를 제공했다. TCP와 UDP에서 같은 포트 번호를 쓴다.

| 이름    | 포트 | RFC | 동작                                                                                        |
| ------- | ---- | --- | ------------------------------------------------------------------------------------------- |
| Echo    | 7    | 862 | 클라이언트가 보낸 데이터를 그대로 돌려보낸다                                                |
| Discard | 9    | 863 | 클라이언트가 보낸 데이터를 버린다                                                           |
| Daytime | 13   | 867 | 사람이 읽을 수 있는 형식으로 날짜와 시각을 돌려보낸다                                       |
| Chargen | 19   | 864 | TCP는 연결이 끊길 때까지 문자열을 계속 보내고, UDP는 데이터그램마다 임의 길이 문자열로 응답 |
| Time    | 37   | 868 | 1900년 1월 1일 0시(UTC)부터 지난 초를 32비트 2진수로 돌려보낸다                             |

<details>
<summary>Time 프로토콜의 값 계산</summary>

1970년 1월 1일 0시(UTC)를 Time 프로토콜로 표현하면 1900년부터 지난 초가 된다. 1900년부터 1970년까지 70년 중 윤년은 1904년부터 1968년까지 4년마다 17번이다(1900년은 100의 배수이고 400의 배수가 아니라서 평년).

```math
(70 \times 365 + 17) \times 86400 = 25567 \times 86400 = 2{,}208{,}988{,}800
```

유닉스 시각에 2,208,988,800을 더하면 Time 프로토콜 값이 된다. 32비트 부호 없는 정수의 최댓값은 약 42억 9천만 초라서 이 값은 2036년 2월에 넘친다.

</details>

> [!WARNING]
> Echo와 Chargen을 UDP로 열어 두면 증폭 공격에 쓰인다. 공격자가 발신지 주소를 희생자로 위조해 Chargen에 작은 데이터그램을 보내면 서버는 더 큰 응답을 희생자에게 보낸다. 두 서버의 Echo와 Chargen 포트를 서로 향하게 위조하면 끝없이 주고받는 루프도 생긴다. 지금 운영체제는 이 서비스들을 기본으로 끈다. daytime 서비스는 소켓 프로그래밍 예제로는 여전히 좋은 대상이다.

## 인터넷, 구현, API

소문자 internet은 공통 프로토콜 묶음을 쓰는 여러 네트워크를 연결한 것을 뜻한다. 대문자 Internet은 TCP/IP로 전 세계 호스트가 통신하는 바로 그 대규모 네트워크다. 대문자 Internet은 소문자 internet의 한 예이지만 그 역은 성립하지 않는다.

TCP/IP의 사실상 표준 구현은 캘리포니아 대학교 버클리의 컴퓨터 시스템 연구 그룹(CSRG)이 4.x BSD와 BSD 네트워킹 릴리스로 배포한 코드다. 많은 상용 구현이 이 코드에서 출발했다.

![BSD 릴리스 계보: 4.2BSD(1983), 4.3BSD(1986), 4.3BSD Tahoe(1988), 4.3BSD Reno(1990), 4.4BSD(1993)로 이어지고, Tahoe에서 Net/1(1989), Reno에서 Net/2(1991), 4.4BSD에서 4.4BSD-Lite(1994, Net/3)가 나왔다](./images/net-tcpip-model-bsd.svg 'TCP 혼잡 제어 기능이 릴리스마다 더해졌다')

| 릴리스             | 연도 | 더해진 기능                                                  |
| ------------------ | ---- | ------------------------------------------------------------ |
| 4.2BSD             | 1983 | 일반에 처음 공개된 TCP/IP 구현                               |
| 4.3BSD             | 1986 | TCP 성능 개선                                                |
| 4.3BSD Tahoe       | 1988 | 느린 시작(slow start), 혼잡 회피, 빠른 재전송                |
| 4.3BSD Reno        | 1990 | 빠른 회복, TCP 헤더 예측, SLIP 헤더 압축, 라우팅 테이블 변경 |
| 4.4BSD             | 1993 | 멀티캐스팅, 대역폭 지연 곱이 큰 경로(long fat pipe) 대응     |
| 4.4BSD-Lite(Net/3) | 1994 | 저작권 문제가 해결된 공개 코드                               |

응용이 TCP/IP를 쓰는 API는 두 가지가 널리 쓰였다. 버클리 소켓(Berkeley sockets)이라고도 부르는 소켓(socket)과, AT&T가 만든 TLI(Transport Layer Interface)다. TLI를 X/Open이 표준화한 것이 XTI(X/Open Transport Interface)다. 오늘날 사실상 표준은 소켓이다.

Stevens의 _TCP/IP Illustrated_는 이더넷 두 개와 다이얼업 SLIP 링크, 라우터 몇 대로 이루어진 시험 네트워크에서 모든 예제를 실행한다. 연재 뒤쪽 글의 tcpdump 출력에 나오는 svr4, bsdi, sun, slip 같은 호스트 이름이 이 시험 네트워크의 장비다.

## 링크 계층

### 링크 계층의 목적

링크 계층은 세 모듈을 위해 데이터를 송수신한다. IP 모듈의 IP 데이터그램, ARP 모듈의 ARP 요청과 응답, RARP 모듈의 RARP 요청과 응답이다. TCP/IP는 이더넷, 토큰 링, FDDI, RS-232 직렬 회선 등 어떤 물리 네트워크 위에서도 동작하도록 설계되었다.

### 이더넷과 IEEE 802 캡슐화

이더넷은 DEC, Intel, Xerox가 1982년에 발표한 표준을 가리키고, CSMA/CD(Carrier Sense Multiple Access with Collision Detection) 접근 방식을 쓴다. 전송 속도는 10Mbps, 주소는 48비트다. 이후 IEEE 802 위원회가 비슷한 표준 묶음을 만들었다. 802.2는 LLC(Logical Link Control), 802.3은 CSMA/CD, 802.4는 토큰 버스, 802.5는 토큰 링, 802.11은 무선 LAN이다.

IP 데이터그램을 담는 방식은 이더넷에 대해 RFC 894, IEEE 802 네트워크에 대해 RFC 1042가 정의한다.

![RFC 1042와 RFC 894 프레임 비교: 802.3 MAC 헤더(목적지 주소, 출발지 주소, 길이) 뒤에 LLC(DSAP AA, SSAP AA, 제어 03)와 SNAP(조직 코드 00, 유형) 8바이트가 붙어 데이터가 38~1492바이트, 이더넷은 유형 바로 뒤에 46~1500바이트 데이터. ARP·RARP 요청/응답 28바이트 뒤에 패딩 10 또는 18바이트](./images/net-tcpip-model-frames.svg 'ARP 28바이트는 최소 길이를 채우려고 패딩이 붙는다')

두 형식의 차이는 다음과 같다.

| 항목            | 이더넷(RFC 894)              | IEEE 802.2/802.3(RFC 1042)                          |
| --------------- | ---------------------------- | --------------------------------------------------- |
| 주소 뒤 2바이트 | type(0x0800, 0x0806, 0x8035) | length(뒤따르는 바이트 수)                          |
| 추가 헤더       | 없음                         | LLC 3바이트(AA AA 03) + SNAP 5바이트(000000 + type) |
| 데이터 크기     | 46 ~ 1500                    | 38 ~ 1492                                           |
| ARP 패딩        | 28 + 18 = 46                 | 8 + 28 + 10 = 46                                    |

두 형식이 한 선 위에 섞여도 구분할 수 있는 이유는 2바이트 필드의 값 범위가 겹치지 않기 때문이다. 802.3 length는 1500 이하이고, 이더넷 type은 1536(0x0600) 이상만 쓴다. 0x0800은 2048이므로 type으로 해석된다.

호스트 요구사항 RFC는 호스트가 RFC 894 패킷을 송수신할 수 있어야 하고(MUST), RFC 894와 섞여 오는 RFC 1042 패킷을 수신할 수 있어야 하며(SHOULD), RFC 1042 패킷도 송신할 수 있으면(MAY) 어느 형식으로 보낼지 설정할 수 있어야 하고 기본값은 RFC 894여야 한다고 정한다. 실제로는 RFC 894 형식이 압도적으로 많이 쓰인다.

RFC 893은 트레일러 캡슐화(trailer encapsulation)라는 또 다른 형식을 설명한다. IP와 TCP 헤더를 데이터 뒤로 옮겨, 데이터를 커널로 복사하는 과정에서 페이지 경계에 맞춰 메모리 간 복사를 효율적으로 하려는 실험이었다. 지금은 쓰이지 않는다.

### SLIP

SLIP(Serial Line IP, RFC 1055)은 RS-232 직렬 포트와 모뎀으로 인터넷에 접속하는 데 쓰던 단순한 프레이밍 규칙이다.

1. IP 데이터그램 끝에 END 문자 0xC0을 붙인다. 회선 잡음이 데이터로 해석되지 않도록 많은 구현이 데이터그램 앞에도 END를 붙인다.
2. 데이터그램 안의 0xC0은 2바이트 0xDB 0xDC로 바꿔 보낸다. 0xDB는 SLIP ESC 문자다.
3. 데이터그램 안의 0xDB는 0xDB 0xDD로 바꿔 보낸다.

![SLIP 프레이밍: IP 데이터그램 안의 c0는 db dc로, db는 db dd로 바뀌고 양 끝에 END(c0)가 붙는다](./images/net-tcpip-model-slip.svg '1바이트가 2바이트로 늘어나는 바이트 스터핑이다')

<details>
<summary>SLIP 바이트 스터핑 예</summary>

데이터그램 바이트가 `45 C0 DB 01`이면 송신 바이트는 다음과 같다.

| 원래 | 45  | C0    | DB    | 01  |
| ---- | --- | ----- | ----- | --- |
| 송신 | 45  | DB DC | DB DD | 01  |

앞뒤에 END를 붙이면 `C0 45 DB DC DB DD 01 C0`로 8바이트가 된다. 수신 쪽은 DB 다음 바이트가 DC면 C0, DD면 DB로 되돌린다. 데이터 안에 C0이 남지 않으므로 C0은 언제나 프레임 경계다.

</details>

SLIP에는 단점이 많다. 양 끝 시스템이 서로의 IP 주소를 미리 알아야 하고 주소를 알려 줄 방법이 없다. 이더넷의 type 같은 필드가 없어 한 직렬 회선에서 SLIP과 다른 프로토콜을 동시에 쓸 수 없다. CRC 같은 체크섬이 없어 잡음으로 깨진 데이터그램은 상위 계층이 검출해야 한다. 그래서 IP 헤더 체크섬, TCP의 헤더·데이터 체크섬, UDP의 헤더·데이터 체크섬(선택)이 이를 맡는다.

### CSLIP

SLIP 회선은 19,200bps 이하로 느렸고 Telnet, Rlogin 같은 대화형 TCP 트래픽에 많이 쓰였다. 앞에서 계산한 것처럼 1바이트를 보내는 데 TCP 20, IP 20으로 헤더만 40바이트다. CSLIP(Compressed SLIP, RFC 1144)은 한 연결의 연속된 패킷에서 두 헤더의 필드 대부분이 바뀌지 않는다는 성질을 이용해 40바이트를 보통 3~5바이트로 줄인다. 비동기 직렬 회선은 바이트마다 시작 비트와 정지 비트를 더해 10비트를 보내므로, 송신 시간은 패킷 바이트 수에 10을 곱해 회선 속도로 나눈 값이다.

```math
\text{송신 시간} = \frac{\text{패킷 바이트} \times 10}{19200\,\text{bps}}
```

19,200bps 회선에서 데이터 1바이트짜리 패킷을 비교하면 다음과 같다.

| 구성  | 헤더 | 패킷 바이트 | 선로 비트 | 송신 시간 |
| ----- | ---- | ----------- | --------- | --------- |
| SLIP  | 40   | 40 + 1 = 41 | 410       | 약 21ms   |
| CSLIP | 4    | 4 + 1 = 5   | 50        | 약 2.6ms  |

헤더를 4바이트로 압축하면 송신 시간이 8분의 1 수준으로 줄어 대화형 응답이 눈에 띄게 빨라진다.

### PPP

PPP(Point-to-Point Protocol)는 SLIP의 단점을 모두 고쳤고 세 요소로 구성된다.

1. 직렬 링크 위에서 IP 데이터그램을 캡슐화하는 방법. 8비트 데이터·패리티 없음의 비동기 링크와 비트 지향 동기 링크를 모두 지원한다.
2. 데이터 링크 연결을 설정, 구성, 시험하는 LCP(Link Control Protocol). 양 끝이 여러 옵션을 협상한다.
3. 네트워크 계층 프로토콜마다 있는 NCP(Network Control Protocol). IP용 NCP인 IPCP(RFC 1332)를 비롯해 OSI 네트워크 계층, DECnet, AppleTalk용이 있다.

캡슐화와 LCP는 RFC 1331에서 처음 정의되었고 지금은 RFC 1661이 표준이다.

![PPP 프레임: 플래그 7E, 주소 FF, 제어 03, 프로토콜 2바이트, 정보 최대 1500바이트, CRC 2바이트, 플래그 7E. 프로토콜 0021은 IP 데이터그램, C021은 링크 제어 데이터, 8021은 네트워크 제어 데이터](./images/net-tcpip-model-ppp.svg 'protocol 필드가 이더넷의 type 역할을 한다')

정보 필드에 플래그 값 0x7E가 나타나면 동기 링크는 비트 스터핑을, 비동기 링크는 이스케이프 문자 0x7D를 쓴다. 0x7D 뒤에는 원래 바이트의 6번째 비트(0x20)를 반전한 값을 보낸다. 즉 원래 바이트와 0x20을 XOR한다.

| 원래 바이트 | 송신 바이트 | 이유                           |
| ----------- | ----------- | ------------------------------ |
| 0x7E        | 0x7D 0x5E   | 플래그와 구분                  |
| 0x7D        | 0x7D 0x5D   | 이스케이프 문자 자신           |
| 0x01        | 0x7D 0x21   | 0x20 미만 제어 문자(기본 설정) |

0x20 미만의 값을 기본으로 이스케이프하는 이유는 호스트나 모뎀의 직렬 드라이버가 이 값을 ASCII 제어 문자(XON/XOFF 등)로 해석하지 않게 하려는 것이다. 어느 문자를 이스케이프할지는 LCP로 협상한다.

SLIP처럼 상수인 flag와 address를 생략하고 protocol을 1바이트로 줄이는 옵션도 협상할 수 있지만, 그래도 CRC 2바이트와 protocol 1바이트로 최소 3바이트의 오버헤드가 남는다. CSLIP과 같은 TCP·IP 헤더 압축도 쓸 수 있다.

| 비교 항목               | SLIP             | PPP                                             |
| ----------------------- | ---------------- | ----------------------------------------------- |
| 한 회선의 다중 프로토콜 | 불가             | protocol 필드로 가능                            |
| 오류 검출               | 없음             | 프레임마다 CRC                                  |
| IP 주소                 | 양쪽이 미리 설정 | IPCP로 동적 협상                                |
| 헤더 압축               | CSLIP으로 별도   | 협상으로 지원                                   |
| 링크 옵션               | 없음             | LCP로 여러 옵션 협상                            |
| 비용                    | 단순             | 최소 3바이트 오버헤드, 협상 프레임, 복잡한 구현 |

### 루프백 인터페이스

대부분의 구현은 같은 호스트의 클라이언트와 서버가 TCP/IP로 통신할 수 있도록 루프백 인터페이스(loopback interface)를 제공한다. 이름은 localhost, 주소는 127.0.0.1이며, 127.0.0.0/8 전체가 루프백용이다.

![루프백 처리 흐름: IP 출력 함수는 목적지가 브로드캐스트·멀티캐스트면 루프백 드라이버로 복사하고 이더넷으로도 보내며, 인터페이스 자신의 주소면 루프백으로만 보내고, 그 밖에는 ARP로 이더넷 주소를 구해 이더넷 드라이버로 보낸다](./images/net-tcpip-model-loopback.svg '자신에게 보낸 데이터그램은 선로에 나가지 않는다')

1. 루프백 주소로 보낸 모든 것은 IP 입력 큐에 그대로 나타난다.
2. 브로드캐스트나 멀티캐스트 주소로 보낸 데이터그램은 루프백 인터페이스로 복사되고 이더넷으로도 나간다. 브로드캐스트와 멀티캐스트의 정의가 송신 호스트 자신을 포함하기 때문이다.
3. 호스트 자신의 IP 주소 중 하나로 보낸 것도 루프백 인터페이스로 간다.

트랜스포트와 IP 계층이 루프백 데이터를 모두 처리하는 것은 비효율적으로 보이지만, 네트워크 계층에서 루프백이 그저 또 하나의 링크 계층으로 보이므로 설계가 단순해진다. 또한 자신의 주소로 보낸 IP 데이터그램은 절대 네트워크에 나타나지 않는다는 뜻이기도 하다.

> [!CAUTION]
> 127.0.0.1에만 바인드한 서비스는 외부에서 접근할 수 없지만, 0.0.0.0(모든 인터페이스)에 바인드하면 외부에 열린다. 개발용 데이터베이스나 관리 페이지를 실수로 0.0.0.0에 열어 두는 설정이 흔한 노출 원인이다.

### MTU와 경로 MTU

링크 계층이 프레임 크기를 제한하는 특성을 MTU(Maximum Transmission Unit)라 한다. IP 데이터그램이 링크의 MTU보다 크면 IP가 조각화를 하고, 조각은 각각 MTU보다 작아야 한다.

| 네트워크                  | MTU(바이트) |
| ------------------------- | ----------- |
| Hyperchannel              | 65535       |
| 16Mbps 토큰 링(IBM)       | 17914       |
| 4Mbps 토큰 링(IEEE 802.5) | 4464        |
| FDDI                      | 4352        |
| 이더넷                    | 1500        |
| IEEE 802.3/802.2          | 1492        |
| X.25                      | 576         |
| 점대점(저지연 설정)       | 296         |

점대점 링크의 MTU 296은 매체의 물리적 한계가 아니라 대화형 응용의 응답 시간을 위한 논리적 제한이다. 큰 파일 전송 패킷이 회선을 오래 차지하면 그 뒤의 키 입력 패킷이 기다려야 하기 때문이다.

<details>
<summary>MTU 296이 대화형 응답에 주는 효과</summary>

9600bps 비동기 회선은 초당 960바이트를 보낸다. 1500바이트 패킷이 막 송신을 시작했다면 뒤의 키 입력 패킷은 최대 다음 시간을 기다린다.

```math
\frac{1500}{960} \approx 1.56\,\text{s}, \qquad \frac{296}{960} \approx 0.31\,\text{s}
```

MTU를 296으로 줄이면 대기 시간이 0.3초 정도로 줄어든다. 296은 TCP·IP 헤더 40바이트와 데이터 256바이트의 합이다.

</details>

두 호스트가 같은 네트워크에 있으면 그 네트워크의 MTU가 중요하다. 그러나 사이에 여러 네트워크가 있으면 양 끝 네트워크보다 경로상 가장 작은 MTU가 중요하고, 이를 경로 MTU(path MTU)라 한다. 경로 MTU는 그 시각에 쓰이는 경로에 따라 달라진다. 라우팅은 대칭이 아니어서 A에서 B로 가는 경로와 B에서 A로 가는 경로가 다를 수 있으므로 경로 MTU도 방향마다 다를 수 있다.

RFC 1191의 경로 MTU 발견(path MTU discovery)은 IP 헤더의 DF(Don't Fragment) 비트를 켜고 보내, 더 작은 MTU를 만난 라우터가 돌려보내는 ICMP "fragmentation needed and DF set"(유형 3, 코드 4) 오류의 다음 홉 MTU 값으로 크기를 줄여 가는 방식이다. 1500바이트 데이터그램이 MTU 576인 링크를 만나면 송신자는 오류를 받고 576으로 다시 보낸다.

> [!WARNING]
> 방화벽이 ICMP를 모두 막으면 이 오류가 송신자에게 돌아가지 못한다. 그러면 큰 패킷만 계속 사라지는 "블랙홀" 증상이 생긴다. 연결은 맺어지는데 큰 웹 페이지만 멈추는 현상의 흔한 원인이다. ICMP 오류 메시지는 [ICMP와 traceroute, IP 라우팅 테이블](/memo/net-traceroute-routing)에서 다룬다.

## 정리

| 주제      | 핵심                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| 계층      | 링크·네트워크·트랜스포트·응용. 아래 셋은 커널, 응용은 사용자 프로세스             |
| OSI 대응  | OSI 응용·표현·세션 = TCP/IP 응용, 데이터 링크·물리 = 링크                         |
| 주소      | 32비트 IP 주소, 클래스 A~E는 선두 비트로 구분. 지금은 CIDR                        |
| 캡슐화    | 세그먼트 → 데이터그램 → 프레임. 이더넷 데이터는 46~1500바이트                     |
| 역다중화  | 이더넷 type → IP protocol → 목적지 포트의 세 단계                                 |
| 포트      | 0~1023 시스템, 1024~49151 등록, 49152~65535 동적                                  |
| 표준화    | IETF가 RFC로 표준을 만들고 번호 값은 IANA 레지스트리가 관리                       |
| 링크 계층 | RFC 894와 1042, SLIP의 바이트 스터핑, PPP의 LCP·NCP와 CRC, 루프백, MTU와 경로 MTU |

다음 글 [IP 헤더와 서브넷, ARP 주소 변환](/memo/net-ip-arp)에서는 IP 헤더의 필드, 서브넷 마스크 계산, IP 주소를 MAC 주소로 바꾸는 ARP와 그 약점을 노린 ARP 스푸핑을 다룬다.

<details>
<summary>참고 문헌</summary>

- W. Richard Stevens, Kevin R. Fall, [TCP/IP Illustrated, Volume 1: The Protocols](https://www.informit.com/store/tcp-ip-illustrated-volume-1-the-protocols-9780321336316), Addison-Wesley
- Larry L. Peterson, Bruce S. Davie, [Computer Networks: A Systems Approach](https://book.systemsapproach.org/)
- [RFC 791: Internet Protocol](https://www.rfc-editor.org/rfc/rfc791)
- [RFC 768: User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 793: Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc793)
- [RFC 893: Trailer Encapsulations](https://www.rfc-editor.org/rfc/rfc893)
- [RFC 894: A Standard for the Transmission of IP Datagrams over Ethernet Networks](https://www.rfc-editor.org/rfc/rfc894)
- [RFC 1042: A Standard for the Transmission of IP Datagrams over IEEE 802 Networks](https://www.rfc-editor.org/rfc/rfc1042)
- [RFC 1055: A Nonstandard for Transmission of IP Datagrams over Serial Lines: SLIP](https://www.rfc-editor.org/rfc/rfc1055)
- [RFC 1144: Compressing TCP/IP Headers for Low-Speed Serial Links](https://www.rfc-editor.org/rfc/rfc1144)
- [RFC 1661: The Point-to-Point Protocol (PPP)](https://www.rfc-editor.org/rfc/rfc1661)
- [RFC 1332: The PPP Internet Protocol Control Protocol (IPCP)](https://www.rfc-editor.org/rfc/rfc1332)
- [RFC 1191: Path MTU Discovery](https://www.rfc-editor.org/rfc/rfc1191)
- [RFC 1122: Requirements for Internet Hosts: Communication Layers](https://www.rfc-editor.org/rfc/rfc1122)
- [RFC 1123: Requirements for Internet Hosts: Application and Support](https://www.rfc-editor.org/rfc/rfc1123)
- [RFC 1812: Requirements for IP Version 4 Routers](https://www.rfc-editor.org/rfc/rfc1812)
- [RFC 2026: The Internet Standards Process, Revision 3](https://www.rfc-editor.org/rfc/rfc2026)
- [RFC 6410: Reducing the Standards Track to Two Maturity Levels](https://www.rfc-editor.org/rfc/rfc6410)
- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 1700: Assigned Numbers](https://www.rfc-editor.org/rfc/rfc1700), [RFC 3232: Assigned Numbers: RFC 1700 is Replaced by an On-line Database](https://www.rfc-editor.org/rfc/rfc3232)
- [RFC 6335: IANA Procedures for the Management of the Service Name and Transport Protocol Port Number Registry](https://www.rfc-editor.org/rfc/rfc6335)
- [RFC 862: Echo Protocol](https://www.rfc-editor.org/rfc/rfc862), [RFC 863: Discard Protocol](https://www.rfc-editor.org/rfc/rfc863), [RFC 864: Character Generator Protocol](https://www.rfc-editor.org/rfc/rfc864), [RFC 867: Daytime Protocol](https://www.rfc-editor.org/rfc/rfc867), [RFC 868: Time Protocol](https://www.rfc-editor.org/rfc/rfc868)
- [IANA IEEE 802 Numbers (EtherType)](https://www.iana.org/assignments/ieee-802-numbers/ieee-802-numbers.xhtml)
- [IANA Protocol Numbers](https://www.iana.org/assignments/protocol-numbers/protocol-numbers.xhtml)
- [IANA Service Name and Transport Protocol Port Number Registry](https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml)
- [RFC 4632: Classless Inter-domain Routing (CIDR)](https://www.rfc-editor.org/rfc/rfc4632)
- [RFC 5737: IPv4 Address Blocks Reserved for Documentation](https://www.rfc-editor.org/rfc/rfc5737)

</details>

<details>
<summary>사진 출처</summary>

- 네트워크 연결 형태 그림: Maksim(원본 PNG), Wikimedia Commons, [NetworkTopologies.svg](https://commons.wikimedia.org/wiki/File:NetworkTopologies.svg), 퍼블릭 도메인

</details>
