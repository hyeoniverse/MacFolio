---
title: Wireshark로 HTTP 트래픽과 TCP 핸드셰이크 분석하기
date: 2021-11-04
category: 학습/CS/네트워크 보안
series: 네트워크 보안
seriesOrder: 6
summary: Wireshark로 HTTP 트래픽을 수집해 http.host·요청 메서드·상태 코드로 거르고, TCP 3-way handshake를 순서 번호까지 따라 읽으며, Flow Graph·Expert Information으로 재전송을 확인하고, 수집한 패킷에서 TCP 포트 스캔을 탐지하는 분석 절차를 다룬다.
---

## 들어가기 전에

웹 페이지 하나를 여는 짧은 순간에도 브라우저는 DNS 질의를 보내고, TCP 연결을 맺고, HTTP 요청을 보내고, 응답을 받고, 연결을 닫는다. 이 과정이 느리거나 실패할 시각, 응용 로그만으로는 어느 단계에서 막혔는지 알기 어렵다. 회선 위의 패킷을 그대로 수집해 계층별로 펼쳐 보면 연결 설정, 요청, 응답, 재전송이 시각과 함께 드러난다.

[패킷 스니핑과 스푸핑, pcap과 원시 소켓의 이해](/memo/net-sniffing-spoofing)에서 Wireshark의 구조와 필터 문법, 통계 메뉴를 소개했다. 이 글은 그 도구로 실제 HTTP 트래픽을 분석하는 구체적인 절차를 다룬다. 어떤 사이트를 방문했는지 `http.host`로 추리고, GET·POST 요청과 상태 코드를 거르고, TCP 3-way handshake를 순서 번호까지 따라 읽고, Flow Graph와 Expert Information으로 재전송을 확인한다. 뒤이어 수집한 패킷에서 TCP 포트 스캔을 탐지하는 방법으로 넘어간다.

이 글이 답하려는 질문은 두 가지다. HTTP 요청 하나가 TCP 위에서 어떤 순서로 오가며, Wireshark의 어떤 기능으로 그 흐름을 재구성하는가. 그리고 정상 트래픽과 포트 스캔은 패킷 수준에서 어떻게 구별되는가.

| 순서 | 내용                                                        |
| ---- | ----------------------------------------------------------- |
| 1    | HTTP 트래픽 수집과 수집 필터                                |
| 2    | 표시 필터: `http.host`, 요청 메서드, 상태 코드              |
| 3    | TCP 3-way handshake를 순서 번호까지 읽기, Follow TCP Stream |
| 4    | Flow Graph와 Expert Information(재전송)                     |
| 5    | 포트 스캔 탐지: TCP Open 스캔과 SYN(Half-open) 스캔         |
| 6    | NULL·XMAS·ACK 스캔의 차이                                   |

TCP 헤더의 플래그와 순서 번호, 상태 전이는 [UDP와 TCP의 헤더, 연결 설정과 종료, 상태 전이](/memo/net-udp-tcp)에서, HTTP의 기본 동작은 아래에서 함께 정리한다. 수집 환경과 무차별 모드, 필터 문법은 [스니핑과 스푸핑](/memo/net-sniffing-spoofing)을 기준으로 한다.

> [!CAUTION] 수집 범위와 개인 정보
> 패킷 수집은 자신이 소유한 호스트와 네트워크에서만 수행한다. pcap 파일에는 실제 IP 주소와 평문 페이로드가 그대로 담기므로, 공유하거나 글에 실을 시각에는 주소와 페이로드를 익명화해야 한다. 이 글의 모든 주소는 문서용 주소(`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`)와 사설 주소(`10.0.0.0/8`)로 바꾼, 수집 결과를 표로 재구성한 것이다.

## HTTP 트래픽 수집하기

### 수집 필터로 범위 좁히기

웹 브라우징만 분석하려면 수집 단계에서 범위를 좁힌다. 수집 필터(capture filter)는 BPF 문법을 따르며, 조건에 맞지 않는 패킷은 저장조차 하지 않는다. 자기 호스트의 주소가 `198.51.100.10`이고 웹 트래픽만 30초 동안 수집한다면 다음과 같다.

```text
host 198.51.100.10 and (tcp port 80 or tcp port 443)
```

수집 필터는 저장 용량과 분석 대상을 줄이지만, 한 번 버린 패킷은 되돌릴 수 없다. 그래서 어떤 트래픽이 섞여 있을지 모를 시각에는 수집 필터를 느슨하게 두거나 걸지 않고, 수집한 뒤 표시 필터(display filter)로 추리는 편이 안전하다. 표시 필터는 모든 패킷을 보관하면서 화면에만 조건을 적용한다.

> [!NOTE] HTTP와 HTTPS
> 80번 포트의 HTTP는 평문이라 요청 URL, 호스트, 헤더, 본문이 Wireshark에 그대로 보인다. 443번 포트의 HTTPS는 TLS로 암호화되어 있어 TCP 핸드셰이크와 TLS 핸드셰이크(ClientHello, 인증서)까지만 보이고 HTTP 내용은 보이지 않는다. 이 글의 `http.*` 필터는 평문 HTTP에만 적용된다.

### 수집한 패킷 훑어보기

수집을 멈추면 패킷 목록에 수백~수천 줄이 쌓인다. Wireshark 창은 세 영역으로 나뉜다. 위에서부터 수집된 패킷 목록, 선택한 패킷의 계층별 상세, 그리고 16진수·ASCII로 본 원본 바이트다.

![Wireshark의 세 영역: 표시 필터 입력줄, 패킷 목록, 계층별 상세, 16진수·ASCII 바이트 보기](./images/net-wireshark-http-panes.svg '패킷 하나를 고르면 가운데 영역에 계층별 필드가 펼쳐진다')

## 표시 필터로 HTTP 분석하기

### 어떤 사이트를 방문했는가: http.host

HTTP 요청 헤더의 `Host` 필드에는 접속한 서버의 도메인이 들어 있다. `http.host` 필터로 이 필드가 있는 패킷만 추리고, `Host` 열을 추가하면 방문한 사이트 목록이 한눈에 보인다.

```text
http.host
```

| No. | 출발지        | 목적지       | Host            | Info                    |
| --- | ------------- | ------------ | --------------- | ----------------------- |
| 12  | 198.51.100.10 | 203.0.113.50 | www.example.com | GET / HTTP/1.1          |
| 34  | 198.51.100.10 | 203.0.113.60 | img.example.net | GET /logo.png HTTP/1.1  |
| 51  | 198.51.100.10 | 203.0.113.50 | www.example.com | GET /style.css HTTP/1.1 |

멀티캐스트 주소 `239.255.255.250`의 1900번 포트로 가는 SSDP 트래픽처럼, 브라우징과 무관한 HTTP 유사 트래픽도 섞인다. `http.host` 필터는 실제 웹 요청만 남겨 이런 잡음을 걸러 낸다.

### 무엇을 요청했는가: 요청 메서드

HTTP 요청의 첫 줄에는 메서드(method)가 있다. GET은 자원을 가져오고, POST는 데이터를 서버로 보낸다. `http.request.method`로 요청만 추린다.

```text
http.request.method == "GET" || http.request.method == "POST"
```

| 메서드 | 의미                                        | 본문      |
| ------ | ------------------------------------------- | --------- |
| GET    | 자원을 가져온다. 파라미터는 URL에 붙인다    | 보통 없음 |
| POST   | 데이터를 서버로 보낸다(폼 제출 등)          | 있음      |
| HEAD   | GET과 같지만 헤더만 받고 본문은 받지 않는다 | 없음      |

로그인 폼을 평문 HTTP로 제출하면 POST 요청의 본문에 아이디와 비밀번호가 그대로 담긴다. HTTP가 평문이라는 사실이 곧 스니핑의 위험인 이유다. 지금은 모든 민감한 폼이 HTTPS로 전송된다.

### 응답은 어땠는가: 상태 코드

서버의 응답 첫 줄에는 상태 코드(status code)가 있다. `http.response.code`로 응답만 추린다.

```text
http.response.code
```

| 코드 | 의미                  | 설명                                                          |
| ---- | --------------------- | ------------------------------------------------------------- |
| 200  | OK                    | 요청이 성공했고 본문에 자원이 들어 있다                       |
| 301  | Moved Permanently     | 자원에 새 URL이 영구히 할당되었다. 이후에는 새 URL로 접속한다 |
| 302  | Found                 | 자원이 일시적으로 다른 URL로 옮겨졌다                         |
| 404  | Not Found             | 요청한 자원이 서버에 없다                                     |
| 500  | Internal Server Error | 서버 내부 오류로 요청을 처리하지 못했다                       |

상태 코드의 첫 자리가 분류를 나타낸다. 2xx는 성공, 3xx는 리다이렉션, 4xx는 클라이언트 오류, 5xx는 서버 오류다. HTTP 오류와 DNS 오류를 함께 보려면 `http.response.code >= 400 || dns.flags.rcode != 0`으로 거른다.

## TCP 3-way handshake 읽기

### 하나의 연결만 추리기

HTTP 요청 하나는 TCP 연결 하나 위에서 오간다. 특정 연결만 보려면 그 연결의 스트림 번호로 거른다. 패킷을 오른쪽 클릭해 `Follow – TCP Stream`을 고르면 Wireshark가 자동으로 `tcp.stream` 필터를 걸어 준다.

```text
tcp.stream == 0
```

이 필터를 걸면 선택한 연결의 모든 패킷만 남는다. 연결의 시작에는 3-way handshake의 세 패킷(SYN, SYN+ACK, ACK)이 있다.

### 순서 번호로 따라 읽기

클라이언트 `198.51.100.10`이 서버 `203.0.113.50`의 80번 포트로 연결을 맺는 과정을 순서 번호(sequence number)와 확인 응답 번호(acknowledgment number)까지 따라 읽는다. 아래는 수집 결과를 표로 재구성한 것이다. 순서 번호는 수집에 나타난 실제 초기 순서 번호(ISN)를 그대로 썼다.

![클라이언트와 서버가 SYN, SYN+ACK, ACK를 주고받으며 순서 번호와 확인 응답 번호가 정해지는 3-way handshake](./images/net-wireshark-http-handshake.svg 'SYN은 순서 번호를 1 소비하므로 ACK 번호는 상대 ISN + 1이다')

| 단계 | 방향              | 플래그  | Seq        | Ack        | 해석                                        |
| ---- | ----------------- | ------- | ---------- | ---------- | ------------------------------------------- |
| 1    | 클라이언트 → 서버 | SYN     | 512816760  | (없음)     | 클라이언트가 자신의 ISN을 보낸다            |
| 2    | 서버 → 클라이언트 | SYN+ACK | 3296522402 | 512816761  | 서버 ISN을 보내고, 받은 ISN + 1로 확인 응답 |
| 3    | 클라이언트 → 서버 | ACK     | 512816761  | 3296522403 | 서버 ISN + 1로 확인 응답, 연결 성립         |

2단계의 확인 응답 번호가 `512816760 + 1 = 512816761`이고, 3단계의 확인 응답 번호가 `3296522402 + 1 = 3296522403`인 점을 확인할 수 있다. SYN 플래그가 순서 번호를 1 소비하기 때문이다. 세 패킷으로 연결이 성립되면 클라이언트는 비로소 HTTP 요청을 보낸다.

> [!TIP] 상대 순서 번호
> Wireshark는 기본으로 상대 순서 번호(relative sequence number)를 보여 준다. 연결마다 ISN을 0으로 치환해 SYN의 Seq를 0, 첫 데이터 바이트를 1부터 세므로 읽기 쉽다. 위 표처럼 실제 ISN을 보려면 `Edit – Preferences – Protocols – TCP`에서 `Relative sequence numbers`를 끈다.

### Follow TCP Stream으로 요청·응답 보기

Follow TCP Stream은 한 연결의 양방향 바이트를 응용 데이터 수준에서 재조립해 보여 준다. 보낸 내용은 빨간색, 받은 내용은 파란색이다. 핸드셰이크 뒤의 HTTP 교환은 다음처럼 재구성된다.

![하나의 TCP 연결에서 SYN·SYN+ACK·ACK 뒤에 GET 요청과 200 OK 응답, 그리고 FIN으로 닫히는 타임라인](./images/net-wireshark-http-get.svg '핸드셰이크 다음에 GET 요청과 200 OK가 오가고 FIN으로 닫힌다')

```http
GET /file-view/avatar/id/1 HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0 ...
Accept: image/png,image/*;q=0.8

HTTP/1.1 200 OK
Content-Type: image/png
Content-Length: 805
...
```

요청의 첫 줄(메서드, 경로, 버전)과 `Host` 헤더, 응답의 상태 줄과 `Content-Length`를 함께 보면 앞의 필터들이 어느 필드를 가리키는지 분명해진다. `http.request.method`는 요청 첫 단어를, `http.host`는 `Host` 헤더를, `http.response.code`는 응답 상태 줄의 숫자를 가리킨다.

## Flow Graph와 재전송

### Flow Graph

`Statistics – Flow Graph`는 수집한 패킷의 교환을 시간순 시퀀스 도식으로 그린다. 창 왼쪽 아래의 `Limit to display filter`를 켜면 표시 필터로 추린 패킷만 그리므로, `tcp.stream == 0`을 건 상태에서 쓰면 한 연결의 핸드셰이크·데이터·종료가 한눈에 보인다.

### Expert Information과 재전송

`Analyze – Expert Information`은 Wireshark가 자동으로 감지한 이상 징후를 심각도(severity)별로 모은다. 그 중 재전송(retransmission)은 ACK를 받지 못해 같은 세그먼트를 다시 보낸 경우로, 패킷 손실이나 지연을 나타낸다.

| 심각도  | 의미                                     | 예                                  |
| ------- | ---------------------------------------- | ----------------------------------- |
| Error   | 명백한 오류                              | 체크섬 오류                         |
| Warning | 비정상이지만 통신을 깨뜨리지는 않는 상황 | 재전송, 중복 ACK, 윈도우 꽉 참      |
| Note    | 정상 통신의 일부이나 눈여겨볼 만한 상황  | 연결 종료 중의 세그먼트, Keep-Alive |
| Chat    | 일반적인 통신 흐름                       | 연결 설정, 요청, 응답               |

재전송만 거르려면 다음 필터를 쓴다.

```text
tcp.analysis.retransmission
```

재전송이 언제 일어났는지는 `Statistics – IO Graph`로 시각화한다. 재전송 패킷만 그린 그래프와 전체 패킷을 함께 그린 그래프를 겹쳐 보면, 특정 시각에 손실이 몰렸는지 수집 내내 고르게 퍼졌는지 판별할 수 있다. 재전송이 전혀 없다면 Note·Warning 중 하나(예: 연결 종료 중의 세그먼트)를 골라 그 의미를 확인한다.

## 포트 스캔 탐지하기

### 스캔이란

수집한 패킷에서 공격의 흔적을 찾는 일도 패킷 분석의 중요한 쓰임이다. 포트 스캔(port scan)은 질의를 보내면 응답이 오는 네트워크의 특성을 이용해, 대상 호스트의 어떤 포트가 열려 있는지 알아내는 정찰 단계다. 공격자는 열린 포트를 찾은 뒤 그 포트에서 동작하는 서비스의 취약점을 노린다. 수집한 파일에는 ARP, ICMP, TCP, UDP 스캔이 섞여 나타날 수 있다.

| 스캔      | 원리                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------- |
| ARP 스캔  | 같은 대역에 ARP 요청을 뿌리고, 응답한 호스트로 생존 여부를 파악. 2계층이라 라우터를 넘지 못한다 |
| ICMP 스캔 | ping의 응답과 TTL 값으로 호스트 생존과 OS 종류를 추측(TTL 64 이하는 유닉스 계열)                |
| TCP 스캔  | SYN에 대한 응답(SYN+ACK/RST)으로 포트의 열림 여부를 판단                                        |
| UDP 스캔  | 닫힌 포트가 돌려주는 ICMP 도달 불가(Type 3, Code 3)로 열림 여부를 판단                          |

### TCP Open 스캔과 SYN 스캔

TCP 스캔은 연결을 끝까지 맺는 Open 스캔과 중간에 끊는 Stealth 스캔으로 나뉜다. 둘의 차이는 3-way handshake를 완성하는지에 있다.

![열린 포트에 대한 Open 스캔(핸드셰이크 완성)과 SYN 스캔(SYN+ACK를 받자마자 RST로 중단)의 패킷 교환 비교](./images/net-wireshark-http-synscan.svg 'SYN 스캔은 핸드셰이크를 완성하지 않아 로그가 남지 않는다')

Open 스캔(TCP connect 스캔)은 공격자가 SYN을 보내고, 포트가 열려 있으면 서버의 SYN+ACK에 ACK로 응답해 연결을 완성한다. 3-way handshake가 성립되므로 서버에 연결 로그가 남는다. SYN 스캔은 Half-open 스캔이라고도 하며, SYN+ACK를 받자마자 ACK 대신 RST를 보내 연결을 중단한다. 핸드셰이크가 완성되지 않으므로 많은 서버가 연결로 기록하지 않는다. 이 점이 Stealth 스캔의 특징이다.

| 경우      | 공격자 → 대상 | 대상 → 공격자 | 공격자의 다음 행동        |
| --------- | ------------- | ------------- | ------------------------- |
| 포트 열림 | SYN           | SYN+ACK       | Open: ACK / SYN 스캔: RST |
| 포트 닫힘 | SYN           | RST+ACK       | 아무것도 보내지 않음      |

수집한 파일에서 공격자와 대상을 가려내려면, 여러 목적지 포트로 SYN을 연달아 보내는 출발지를 찾는다. 아래는 공격자 `10.0.0.66`이 대상 `10.0.0.1`의 여러 포트로 SYN을 보낸 SYN 스캔을 표로 재구성한 것이다.

| No. | 출발지    | 목적지       | 플래그  | 해석                        |
| --- | --------- | ------------ | ------- | --------------------------- |
| 1   | 10.0.0.66 | 10.0.0.1:135 | SYN     | 포트 135 탐색               |
| 2   | 10.0.0.1  | 10.0.0.66    | SYN+ACK | 포트 135 열림               |
| 3   | 10.0.0.66 | 10.0.0.1:135 | RST     | 연결을 즉시 중단(Half-open) |
| 4   | 10.0.0.66 | 10.0.0.1:139 | SYN     | 포트 139 탐색               |
| 5   | 10.0.0.1  | 10.0.0.66    | RST+ACK | 포트 139 닫힘               |

2번에서 SYN+ACK가 돌아온 포트 135는 열려 있고, 5번에서 RST+ACK가 돌아온 포트 139는 닫혀 있다. 공격자가 2번 응답 뒤 ACK가 아니라 3번 RST를 보낸다는 점이 SYN 스캔임을 가리킨다. 열린 포트를 추리는 표시 필터는 다음과 같다.

```text
tcp.flags == 0x012              # SYN+ACK (열린 포트의 응답)
tcp.flags == 0x002              # SYN (스캔 패킷)
tcp.flags.syn == 1 && tcp.flags.ack == 0 && ip.dst == 10.0.0.1
```

> [!IMPORTANT] 포트 스캔 방어
> 포트 스캔 자체는 막기 어렵지만 영향을 줄일 수 있다. 쓰지 않는 포트를 닫고 방화벽으로 외부 접근을 제한하면 열린 포트가 줄어든다. IDS·IPS는 짧은 시간에 한 출발지가 여러 포트로 SYN을 보내는 패턴을 탐지해 차단한다. 스캔에 응답하지 않도록 방화벽을 설정하면 공격자가 포트의 열림·닫힘을 구별하기 어려워진다.

### NULL·XMAS·ACK 스캔

파일 끝에 다른 종류의 TCP 스캔이 더 있을 수 있다. 이들도 핸드셰이크를 완성하지 않는 Stealth 스캔이지만, 보내는 플래그 조합이 다르다.

| 스캔 | 보내는 플래그               | 열린 포트의 반응  | 닫힌 포트의 반응               |
| ---- | --------------------------- | ----------------- | ------------------------------ |
| SYN  | SYN                         | SYN+ACK           | RST+ACK                        |
| NULL | 아무 플래그도 설정하지 않음 | 응답 없음         | RST                            |
| XMAS | FIN+PSH+URG(동시 설정)      | 응답 없음         | RST                            |
| ACK  | ACK                         | RST(필터링 안 됨) | RST 또는 무응답/ICMP(필터링됨) |

NULL 스캔과 XMAS 스캔은 열린 포트가 응답하지 않고 닫힌 포트만 RST를 돌려준다는 점을 이용한다. 표준은 플래그가 비정상인 세그먼트에 대해 열린 포트는 무시하고 닫힌 포트만 RST를 보내도록 정하므로, 응답이 없으면 열림, RST가 오면 닫힘으로 판단한다. ACK 스캔은 포트의 열림 여부가 아니라 스캐너와 대상 사이의 방화벽 종류를 판별하는 데 목적이 있다. 방화벽이 필터링하지 않으면 열린 포트와 닫힌 포트 모두 RST를 돌려주고, 필터링하면 응답이 없거나 ICMP 오류가 돌아온다.

SYN 스캔과 Open 스캔의 차이가 핸드셰이크 완성 여부였듯, 이 스캔들의 차이도 결국 운영체제가 비정상 플래그 조합에 어떻게 반응하는지에서 나온다. 패킷의 플래그와 응답만 보면 어떤 스캔인지 구별할 수 있다.

## 정리

| 단계        | 필터·기능                                | 보는 것                                    |
| ----------- | ---------------------------------------- | ------------------------------------------ |
| 사이트 식별 | `http.host`                              | 방문한 도메인                              |
| 요청 분석   | `http.request.method`                    | GET·POST와 본문                            |
| 응답 분석   | `http.response.code`                     | 상태 코드(2xx~5xx)                         |
| 연결 추적   | `tcp.stream`, Follow TCP Stream          | 3-way handshake, 요청·응답 재조립          |
| 품질 확인   | Flow Graph, Expert Information, IO Graph | 세그먼트 순서, 재전송 시점                 |
| 스캔 탐지   | `tcp.flags`                              | SYN·SYN+ACK·RST로 본 열린 포트와 스캔 종류 |

HTTP 요청 하나를 TCP 핸드셰이크부터 응답·종료까지 따라 읽으면, 앞 글에서 다룬 TCP 상태 전이와 순서 번호가 실제 패킷에서 어떻게 나타나는지 확인할 수 있다. 소켓 API로 이런 서버와 클라이언트를 직접 만드는 과정은 [소켓 프로그래밍](/memo/net-socket-programming)에서, TCP를 노리는 공격은 [TCP 공격](/memo/net-tcp-attacks)에서 이어진다.

## 참고 문헌

- C. Sanders, _Practical Packet Analysis_, 3rd ed., No Starch Press, 2017.
- R. Fielding, J. Reschke, [RFC 7230: HTTP/1.1 Message Syntax and Routing](https://www.rfc-editor.org/rfc/rfc7230), 2014.
- R. Fielding, J. Reschke, [RFC 7231: HTTP/1.1 Semantics and Content](https://www.rfc-editor.org/rfc/rfc7231), 2014.
- J. Postel, [RFC 793: Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc793), 1981.
- [Wireshark User's Guide](https://www.wireshark.org/docs/wsug_html_chunked/).
- [Nmap: Port Scanning Techniques](https://nmap.org/book/man-port-scanning-techniques.html).
