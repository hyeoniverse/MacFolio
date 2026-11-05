---
title: BSD 소켓 API로 만드는 TCP 서버와 클라이언트
date: 2021-11-15
category: CS/네트워크 보안
series: 네트워크 보안
seriesOrder: 8
summary: 파일 디스크립터에서 출발해 BSD 소켓 API의 socket·bind·listen·accept·connect 흐름, 소켓 주소 구조체와 바이트 순서, 이름·주소 변환 함수를 정리하고, daytime 서버·클라이언트와 select() 기반 다중 클라이언트 서버를 직접 구현한다.
---

## 들어가기 전에

소켓 프로그래밍은 운영체제가 제공하는 BSD 소켓 API(Berkeley Sockets API)로 TCP/IP 통신 프로그램을 작성하는 방법이다. 웹 브라우저, SSH 클라이언트, 데이터베이스 드라이버 모두 `socket(){:c}`, `connect(){:c}`, `send(){:c}`, `recv(){:c}` 같은 시스템 호출 위에서 동작한다. 앞선 글들에서 패킷 헤더와 TCP 상태 전이를 읽었다면, 이 글에서는 그 패킷을 만들어 내는 쪽의 코드를 작성한다.

소켓 API가 왜 필요한지는 파일 입출력과 비교하면 드러난다. 파일은 `open(){:c}`, `read(){:c}`/`write(){:c}`, `close(){:c}` 세 단계로 끝난다. 그런데 네트워크 상대는 이름 하나로 정해지지 않는다. 어느 주소 체계(IPv4, IPv6, 유닉스 도메인)인지, 바이트 스트림인지 데이터그램인지, 기다리는 쪽인지 찾아가는 쪽인지, 상대 주소는 무엇인지를 모두 지정해야 한다. 시각을 알려 주는 daytime 서버를 예로 들면 "13번 포트에서 모든 인터페이스로 들어오는 TCP 연결을 받아, 연결마다 문자열 한 줄을 쓰고 닫는다"를 코드로 표현해야 하고, `open(){:c}` 하나로는 이 정보를 담을 수 없다. 소켓 API는 `open(){:c}`에 해당하는 절차를 `socket(){:c}`, `bind(){:c}`, `listen(){:c}`, `accept(){:c}`, `connect(){:c}`로 나눠 이 문제를 푼다.

이 글이 답하려는 질문은 세 가지다. 소켓 API의 각 함수는 커널 안에서 어떤 TCP 동작을 일으키는가, 주소와 포트는 어떤 구조체와 바이트 순서로 커널에 전달되는가, 서버 하나가 여러 클라이언트를 동시에 처리하려면 어떻게 구성하는가.

| 순서 | 내용                                                   |
| ---- | ------------------------------------------------------ |
| 1    | 파일 입출력과 파일 디스크립터                          |
| 2    | BSD 소켓의 정의, POSIX와 Winsock                       |
| 3    | 클라이언트-서버 모델과 daytime 서버·클라이언트         |
| 4    | 소켓 도메인·타입과 기본 함수                           |
| 5    | 비트 번호, 엔디언, 주소·이름 변환                      |
| 6    | fork 서버와 select() 기반 다중 클라이언트 서버         |
| 7    | Winsock으로 메시지를 주고받는 클라이언트·서버와 디버깅 |

TCP 헤더, 3-way handshake, 연결 종료와 상태 전이도는 [UDP와 TCP의 헤더, 연결 설정과 종료, 상태 전이](/memo/net-udp-tcp)에서, 포트 번호와 계층 구조는 [TCP/IP 계층 모델과 캡슐화](/memo/net-tcpip-model)에서 다뤘다. 이름을 주소로 바꾸는 DNS의 구조는 [DNS의 계층 구조와 캐시 오염 공격, DNSSEC 방어](/memo/net-dns-attack)에 있다. 이 글의 코드는 C로 작성했고 macOS(clang)에서 컴파일과 실행을 확인했다.

## 파일 입출력에서 소켓으로

소켓 디스크립터는 유닉스 파일 디스크립터와 같은 정수 번호표다. 그래서 소켓에 앞서 ANSI C 표준 라이브러리의 `FILE *{:c}`와 유닉스 시스템 호출의 `int fd{:c}`를 먼저 비교한다.

### 표준 라이브러리 파일 입출력

`fopen(){:c}`은 파일을 열고 `FILE` 구조체의 주소를 돌려준다. `fprintf(fp, "%s %d\n", "Hello", 100){:c}`은 `printf(){:c}`와 같은 서식으로 파일에 쓰고, `fscanf(fp, "%s %d", s1, &num1){:c}`은 같은 서식으로 읽는다. 화면 출력용 `stdout`도 `FILE *{:c}`이므로 `fprintf(stdout, ...){:c}`로 화면과 파일에 똑같이 쓸 수 있다. 출력 대상을 추상화하는 이 설계가 소켓에서 `read(){:c}`/`write(){:c}`를 그대로 쓰는 발상으로 이어진다.

`"r"`는 읽기 전용(파일이 없으면 실패), `"w"`는 쓰기 전용(있으면 내용을 지우고 없으면 생성), `"a"`는 끝에 이어 쓰기(없으면 생성)다. `+`를 붙인 `"r+"`·`"w+"`·`"a+"`는 같은 규칙에 읽기와 쓰기를 모두 허용하고, `"a+"`의 쓰기는 항상 파일 끝에서 일어난다.

`"t"`와 `"b"`는 Windows에서만 동작이 다르다. 텍스트 모드는 `\n`과 `\r\n`을 서로 변환하고 Ctrl+Z를 파일 끝으로 처리하며, 바이너리 모드는 바이트를 그대로 읽고 쓴다. POSIX 시스템은 `"b"`를 받아들이되 무시하므로, 이식성을 위해 바이너리 파일에는 항상 `"rb"`/`"wb"`를 쓴다.

`fread(){:c}`는 고정 크기 버퍼로 파일 전체를 나눠 읽을 수 있고, 실제로 읽은 항목 수를 돌려준다.

```c
char buffer[5] = { 0 }; /* 데이터 4바이트 + 널 문자 1바이트 */
int count, total = 0;
FILE *fp = fopen("hello2.txt", "r"); /* 내용: Helabcdworld! (13바이트) */

while (feof(fp) == 0) {
	count = fread(buffer, sizeof(char), 4, fp); /* 1바이트씩 최대 4개 */
	printf("%s", buffer);
	memset(buffer, 0, 5);
	total += count;
}
printf("\ntotal: %d\n", total); /* total: 13 */
fclose(fp);
```

![13바이트 파일을 4바이트씩 읽으며 파일 위치가 0, 4, 8, 12로 이동하고 마지막에 feof가 1이 되는 과정](./images/net-socket-programming-fread.svg '세 번은 4바이트, 마지막에는 1바이트를 읽고 그 시각에 feof가 1이 된다')

13바이트 파일이면 `fread(){:c}`가 4, 4, 4, 1을 돌려주고 합계는 13이다.

`feof(){:c}`는 직전 읽기가 파일 끝에 닿았는지만 알려 준다. 파일이 12바이트처럼 4의 배수라면 세 번째 호출이 끝까지 읽고도 EOF 표시를 켜지 않아 반복이 한 번 더 돌고, 네 번째 호출은 0을 돌려준다. `while ((count = fread(buffer, 1, 4, fp)) > 0){:c}`처럼 반환값으로 반복을 제어하면 이 문제가 없고, 소켓의 `read(){:c}` 반복도 같은 형태로 작성한다.

### 텍스트 파일과 바이너리 파일

숫자 100, 200, 300, 400을 텍스트로 쓰면 숫자 한 자리가 ASCII 문자 1바이트라 `"100200300400"`이 12바이트이고, 2바이트 정수로 쓰면 4 × 2 = 8바이트다.

![같은 네 숫자를 바이너리 파일에는 8바이트, 텍스트 파일에는 12바이트로 저장한 비교](./images/net-socket-programming-binary-text.svg '바이너리는 2바이트 단위 정수, 텍스트는 자릿수만큼의 ASCII 문자')

바이너리 쪽이 `64 00 C8 00 2C 01 90 01`인 이유는 리틀 엔디언이다. 300 = `0x012C`은 하위 바이트 `2C`가 먼저 놓인다. 공간 효율 때문에 실무 프로그램은 구조체를 통째로 바이너리 파일에 쓰는 경우가 많고, 호환성이 중요한 웹에서는 문자열 형식을 쓰기도 한다.

```c
#pragma pack(push, 1) /* 멤버 사이에 패딩을 넣지 않는다 */
struct Data {
	char c1;     /* 1바이트 */
	short num1;  /* 2바이트 */
	int num2;    /* 4바이트 */
	char s1[20]; /* 20바이트 */
};
#pragma pack(pop) /* 정렬 설정을 원래대로 되돌린다 */

int main(void)
{
	struct Data d1;
	memset(&d1, 0, sizeof(d1));
	d1.c1 = 'a';
	d1.num1 = 32100;
	d1.num2 = 2100000100;
	strcpy(d1.s1, "Hello, world!");

	FILE *fp = fopen("data2.bin", "wb");
	fwrite(&d1, sizeof(d1), 1, fp); /* 구조체 메모리를 그대로 기록 */
	fclose(fp);
	return 0;
}
```

![data2.bin의 27바이트를 c1, num1, num2, s1 영역으로 나눠 16진수로 표시한 그림](./images/net-socket-programming-struct-bytes.svg '61은 a, 64 7D는 32100, 64 75 2B 7D는 2100000100을 리틀 엔디언으로 보관한 값')

`xxd data2.bin`의 출력은 다음과 같다.

```text
00000000: 6164 7d64 752b 7d48 656c 6c6f 2c20 776f  ad}du+}Hello, wo
00000010: 726c 6421 0000 0000 0000 00              rld!.......
```

32100 = `0x7D64`는 `64 7D`로, 2100000100 = `0x7D2B7564`는 `64 75 2B 7D`로 저장된다.

```math
\texttt{0x7D2B7564} = 125 \cdot 2^{24} + 43 \cdot 2^{16} + 117 \cdot 2^{8} + 100 = 2100000100
```

문자열 `"Hello, world!"`는 13바이트이고 나머지 7바이트는 0이다. 합계는 1 + 2 + 4 + 20 = 27바이트다. 같은 구조체 정의와 `fread(&d1, sizeof(d1), 1, fp){:c}`로 읽으면 `a 32100 2100000100 Hello, world!`가 복원된다.

<details>
<summary>#pragma pack을 빼면 왜 28바이트가 되는가</summary>

컴파일러는 각 멤버를 자기 크기의 배수 오프셋에 정렬한다.

| 멤버   | 크기 | pack(1) 오프셋 | 기본 정렬 오프셋 |
| ------ | ---- | -------------- | ---------------- |
| `c1`   | 1    | 0              | 0                |
| (패딩) | 1    | 없음           | 1                |
| `num1` | 2    | 1              | 2                |
| `num2` | 4    | 3              | 4                |
| `s1`   | 20   | 7              | 8                |
| 합계   |      | 27             | 28               |

기본 정렬에서는 `c1` 뒤에 1바이트 패딩이 들어간다. 끝(28)이 최대 정렬 단위 4의 배수이므로 끝 패딩은 없다. 실제로 `sizeof(struct Data){:c}`는 pack 없이 28, pack(1)이면 27이다. 패딩은 컴파일러와 아키텍처에 따라 달라질 수 있으므로, 구조체를 파일이나 네트워크로 그대로 보내려면 정렬과 바이트 순서를 명시적으로 고정해야 한다.

</details>

### FILE 포인터와 파일 디스크립터

`<stdio.h>` 함수들은 `fopen(){:c}`이 사용자 프로세스 메모리(대개 힙)에 만든 `FILE` 구조체를 참조하고, 표준 라이브러리가 이 구조체를 직접 관리한다. 유닉스 시스템 호출은 포인터 대신 정수 `fd`를 쓴다. 커널은 프로세스 제어 블록(PCB) 안에 파일 디스크립터 테이블을 보관하고, 사용자 프로그램은 행 번호만 받는다.

![open, write, close 호출에 따라 커널의 파일 디스크립터 테이블에 fd 10 행이 생기고 사용되고 삭제되는 과정](./images/net-socket-programming-fdtable.svg '사용자는 번호표 10만 쥐고, 파일을 찾고 쓰는 일은 커널이 한다')

==소켓도 이 테이블의 한 행을 차지한다.== 유닉스 스타일은 파이프, 터미널, 소켓까지 같은 정수 번호표로 다루므로 유닉스에서는 연결된 소켓에 `read(){:c}`/`write(){:c}`/`close(){:c}`를 그대로 쓸 수 있다.

## BSD 소켓과 POSIX

### 유닉스 계열과 표준화

유닉스는 1969년 AT&T 벨 연구소의 Ken Thompson과 Dennis Ritchie가 만든 운영체제다. 처음에는 어셈블리어로 작성했고 이후 Ritchie가 만든 C 언어로 다시 작성했다. UNIX는 등록 상표(현재 The Open Group 소유)여서 인증받지 않은 시스템은 유닉스 계열(Unix-like)이라 부른다. AT&T 코드를 라이선스해 개조한 Solaris·HP-UX, Linus Torvalds가 유닉스의 동작을 본떠 처음부터 작성한 리눅스 배포판, UC 버클리 CSRG가 배포한 Berkeley Software Distribution에서 유래한 FreeBSD·NetBSD·Darwin·macOS·iOS가 여기에 속한다. 여러 시스템이 난립하자 C 언어와 시스템 프로그래밍 인터페이스의 표준화가 진행됐다.

![POSIX.1(1988), ANSI C(1989), XPG, POSIX.1g 소켓(2000), SUSv3(2001), SUSv4(2008)로 이어지는 유닉스 표준화 계보](./images/net-socket-programming-posix.svg '소켓 API는 POSIX.1g와 XNS를 거쳐 POSIX.1-2001/SUSv3에 들어갔다')

소켓 관점에서 중요한 줄기는 POSIX.1g(2000)와 X/Open XNS가 POSIX.1-2001/SUSv3(Single UNIX Specification v3)로 합쳐진 흐름이다. man 페이지의 "SUSv3에 정의되어 있다"는 표현은 이 표준을 가리킨다.

### 소켓의 정의

BSD 소켓 API는 1981~1983년에 개발되어 1983년 4.2BSD와 함께 공개됐고, 현재 쓰이는 사실상 모든 소켓 API는 BSD 소켓 API나 이를 표준화한 POSIX 소켓 API를 따른다. 소켓이라는 말은 문서마다 조금씩 다른 대상을 가리킨다.

- RFC 793(TCP): 인터넷 주소와 TCP 포트를 연접(concatenation)한 주소. 소켓 한 쌍이 TCP 연결 하나를 유일하게 식별한다. RFC 768(UDP)은 포트는 쓰지만 소켓을 정의하지 않는다
- 4.3BSD 문서: `socket` 시스템 호출이 만들고 디스크립터를 돌려주는 일시적 객체. 디스크립터를 가진 프로세스가 있는 동안만 존재한다
- Quarterman 외(1985): 통신의 끝점(end point). 열린 파일이 inode를 가리키듯 열린 소켓은 커널의 socket 구조체를 가리키고, 이 구조체가 소켓 타입, 상태, 입출력 데이터 큐를 관리한다

![프로세스의 TCP/IP 응용 아래 시스템 호출 경계, 커널 안의 소켓 계층, 프로토콜 계층, 인터페이스 계층](./images/net-socket-programming-layers.svg '소켓 계층은 프로토콜과 무관한 계층으로 응용과 TCP/IP 구현 사이에 있다')

소켓 하나는 로컬 소켓 주소(로컬 IP와 포트), 원격 소켓 주소, 전송 프로토콜의 조합으로 구별된다. 원격 주소는 연결이 수립된 TCP 소켓에만 있다. TCP 서버는 클라이언트마다 소켓을 하나씩 만들고, 이 소켓들은 같은 로컬 소켓 주소를 공유한다.

### Windows Sockets API

Windows는 응용용 BSD 스타일 API인 Winsock, 커널 모듈용 Winsock Kernel(WSK), 원격 프로시저 호출(RPC), HTTP·FTP 같은 응용 계층을 다루는 Web access API, 예전 IBM PC LAN용 NetBIOS를 제공한다. Winsock 1.0은 유닉스 네트워크 응용을 쉽게 옮기려고 마이크로소프트가 구현한 BSD 소켓이고, Winsock 2.2는 비동기 입출력 같은 Windows 고유 기능을 더했다. POSIX와 다른 점은 다음과 같다.

- `ws2_32.lib`를 링크해야 한다. 코드 상단의 `#pragma comment(lib, "ws2_32.lib"){:c}`로 지정하고, Visual Studio 2019 이전 버전에서는 링커 입력의 추가 종속성에 넣어야 하는 경우가 있다
- 함수 본체는 `WS2_32.DLL`에 있으므로 먼저 `WSAStartup(MAKEWORD(2, 2), &wsa){:c}`로 라이브러리를 불러와 초기화하고, 사용이 끝나면 `WSACleanup(){:c}`으로 정리한다

> [!CAUTION] WSACleanup() 전에 연결을 정리한다
> `WSACleanup(){:c}`을 호출하면 전송 중인 연결이 아무 통보 없이 끊긴다. 보낼 데이터가 남은 연결은 `shutdown(){:c}`으로 송신 방향을 닫아 FIN을 보낸 뒤 소켓을 닫고, 그다음 `WSACleanup(){:c}`을 호출한다.

## 클라이언트-서버 모델

통신 채널을 만들려면 한쪽이 먼저 시작하고 다른 쪽은 기다려야 한다. 먼저 시작하는 쪽이 클라이언트, 기다리는 쪽이 서버다. 서버는 항상 켜져 있고(always on) 클라이언트는 필요한 시각에만 켜진다. P2P 통신에서는 한 프로그램이 두 역할을 모두 한다. 서버는 응용에 따라 연결 지향(TCP) 또는 비연결(UDP)로 구성한다.

![TCP는 서버가 socket, bind, listen, accept, 클라이언트가 socket, connect를 거쳐 read/write하고, UDP는 recvfrom/sendto로 주고받는 흐름 비교](./images/net-socket-programming-flow.svg 'TCP는 연결을 먼저 맺고, UDP는 매번 상대 주소를 담아 보낸다')

| 함수        | 역할                                        |
| ----------- | ------------------------------------------- |
| `socket()`  | 소켓을 만든다                               |
| `bind()`    | 소켓에 로컬 주소(IP 주소와 포트)를 할당한다 |
| `listen()`  | 들어오는 연결을 기다리는 상태로 바꾼다      |
| `accept()`  | 들어온 연결을 받아들이고 새 소켓을 돌려준다 |
| `connect()` | 원격 호스트에 연결한다                      |
| `send()`    | 소켓으로 데이터를 보낸다                    |
| `recv()`    | 소켓에서 데이터를 읽는다                    |

한 서버 호스트의 여러 서비스는 목적지 포트로 구별된다. 같은 서버라도 `198.51.100.10:80`으로 오는 요청은 웹 서버로, `198.51.100.10:7`로 오는 요청은 echo 서버로 전달된다.

### 클라이언트가 여러 개 오면

연결 하나를 끝까지 처리한 뒤 다음 `accept(){:c}`을 부르는 반복 서버(iterative server)에서는 한 클라이언트가 느리면 나머지가 모두 기다린다.

![클라이언트 1이 사용자 입력을 기다리는 동안 서버는 클라이언트 1의 read에서 막히고 클라이언트 2의 connect는 완료되지 못하는 시퀀스](./images/net-socket-programming-blocking.svg '서버가 한 연결의 read()에서 막히면 다음 연결 처리가 밀린다')

Client1이 연결 후 `fgets(){:c}`으로 사용자 입력을 기다리면 서버는 Client1의 `read(){:c}`에서 막힌다. 그사이 Client2의 연결은 커널 큐에 들어가지만 서버가 `accept(){:c}`을 다시 부르기 전까지 처리되지 않는다. 그래서 서버는 동시 처리 구조가 필요하다.

| 방식       | 동작                            | 장점                     | 단점                         |
| ---------- | ------------------------------- | ------------------------ | ---------------------------- |
| `fork()`   | 연결마다 자식 프로세스          | 연결끼리 메모리가 분리됨 | 생성·문맥 전환 비용이 큼     |
| 스레드     | 연결마다 스레드                 | 이해하기 쉬움            | 경쟁 상태로 복잡해짐         |
| `select()` | 이벤트가 생긴 디스크립터만 처리 | 경쟁 상태 없음           | 상태와 제어 흐름을 직접 관리 |

`select(){:c}` 방식은 여러 소켓을 동시에 처리하는 것이 아니라, 이벤트가 발생한 하나를 골라 처리하는 일을 반복한다. 두 방식 모두 뒤에서 직접 구현한다.

## daytime 서버와 클라이언트

### daytime 프로토콜

daytime 프로토콜은 1983년 RFC 867로 정의된 응용 프로토콜이다. 시각 동기화에는 NTP(Network Time Protocol)를 쓰지만 daytime은 훨씬 단순해서 소켓 API를 익히는 예제로 널리 쓰인다. TCP 서비스는 서버가 13번 포트에서 대기하다 연결이 수립되면 날짜와 시각을 ASCII 문자열로 보내고 곧바로 연결을 닫는다. UDP 서비스는 서버가 UDP 13번 포트로 받은 데이터그램의 내용을 무시하고 시각 문자열을 돌려보낸다. 문자열 형식은 표준에 정해져 있지 않다.

미국 국립표준기술연구소(NIST)는 지금도 daytime 서버를 운영한다. NIST 서버의 응답을 Wireshark로 캡처하면 TCP 헤더 이후는 다음과 같다.

```text
오프셋  바이트                                             해석
0x22   00 0d                                              출발지 포트 13
0x24   d4 a1                                              목적지 포트 54433
0x2e   50 18                                              헤더 20바이트, PSH+ACK
0x36   0a 35 38 36 37 31 20 31 39 2d 30 37 2d 30 37 20     "\n58671 19-07-07 "
0x46   30 36 3a 33 30 3a 31 37 20 35 30 20 30 20 30 20     "06:30:17 50 0 0 "
0x56   33 34 36 2e 36 20 55 54 43 28 4e 49 53 54 29 20     "346.6 UTC(NIST) "
0x66   2a 20 0a                                           "* \n"
```

==NIST 서버는 시각 문자열 앞에 개행(`0x0a`)을 하나 더 보낸다.== 이더넷 헤더 14바이트, IP 헤더 20바이트, TCP 헤더 20바이트 뒤인 `0x36`에서 페이로드가 시작한다. IP 전체 길이 필드는 `0x005b` = 91이고 91 − 20 − 20 = 51바이트가 페이로드다. 집계하면 앞뒤 개행 2바이트와 본문 49바이트로 51바이트가 맞다.

<details>
<summary>NIST 응답 형식 읽기</summary>

형식은 `JJJJJ YR-MO-DA HH:MM:SS TT L H msADV UTC(NIST) OTM`이다. 58671은 수정 율리우스일(MJD), `19-07-07 06:30:17`은 UTC 날짜와 시각, `TT` = 50은 미국 일광 절약 시간 적용 중(표준시면 00), `L` = 0은 윤초 예고 없음, `H` = 0은 서버 상태 정상, 346.6은 네트워크 지연을 보정하려고 앞당겨 보낸 밀리초다.

MJD를 검산한다. 2020년 1월 1일의 MJD는 58849다. 2019년 7월 7일부터 12월 31일까지는 25 + 31 + 30 + 31 + 30 + 31 = 178일이므로 58849 − 178 = 58671이 맞다.

</details>

### unp.h 헤더

예제 코드는 W. Richard Stevens의 _UNIX Network Programming_ 관례를 따라 공통 선언을 `unp.h`에 모은다.

```c
#ifndef UNP_H
#define UNP_H

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#define bzero(ptr, n) memset(ptr, 0, n)
#else
#include <sys/types.h>
#include <sys/socket.h> /* 소켓 기본 정의 */
#include <netinet/in.h> /* sockaddr_in과 인터넷 상수 */
#include <arpa/inet.h>  /* inet_pton() 등 */
#include <unistd.h>     /* read(), write(), close() */
#endif
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAXLINE 4096 /* 텍스트 한 줄 최대 길이 */
#define LISTENQ 1024 /* listen()의 두 번째 인자 */
#define SA struct sockaddr

/* 시스템 호출 오류: errno 설명을 덧붙이고 종료한다 */
static inline void err_sys(const char *fmt, ...)
{
	int saved = errno;
	va_list ap;
	va_start(ap, fmt);
	vfprintf(stderr, fmt, ap);
	va_end(ap);
	fprintf(stderr, ": %s\n", strerror(saved));
	exit(1);
}

/* err_quit()은 errno 설명 없이 메시지만 출력하고 종료한다(구현 생략) */
#endif
```

`bzero(){:c}`는 C 표준 함수가 아니라 BSD의 `<strings.h>`에 있고 Microsoft C 런타임에는 없어서, Windows에서는 `memset(){:c}`으로 대체하는 매크로를 정의한다. `SA`는 주소 구조체 포인터의 형 변환을 짧게 쓰기 위한 이름이다. `LISTENQ`를 1024로 정한 이유는 `<sys/socket.h>`의 `SOMAXCONN`이 여러 커널에서 5 같은 작은 값으로 정의되어 있지만 실제로는 훨씬 많은 연결을 지원하기 때문이다.

### daytime TCP 클라이언트

```c
#include "unp.h"

int main(int argc, char *argv[])
{
	int sockfd, n;
	char recvline[MAXLINE + 1];
	struct sockaddr_in servaddr;

	if (argc != 2)
		err_quit("usage: %s <IPaddress>", argv[0]);

	if ((sockfd = socket(AF_INET, SOCK_STREAM, 0)) < 0) /* IPv4 TCP 소켓 */
		err_sys("socket error");

	memset(&servaddr, 0, sizeof(servaddr));
	servaddr.sin_family = AF_INET;
	servaddr.sin_port = htons(13); /* daytime 포트 */
	if (inet_pton(AF_INET, argv[1], &servaddr.sin_addr) <= 0) /* 점 표기 → 32비트 */
		err_quit("inet_pton error for %s", argv[1]);

	if (connect(sockfd, (SA *)&servaddr, sizeof(servaddr)) < 0)
		err_sys("connect error");

	while ((n = read(sockfd, recvline, MAXLINE)) > 0) {
		recvline[n] = 0; /* 문자열로 쓰려면 널 문자로 끝낸다 */
		if (fputs(recvline, stdout) == EOF)
			err_sys("fputs error");
	}
	if (n < 0)
		err_sys("read error");

	close(sockfd);
	return 0;
}
```

`socket(AF_INET, SOCK_STREAM, 0){:c}`은 IPv4 TCP 소켓을 만든다. 주소 구조체의 포트는 `htons(){:c}`로 네트워크 바이트 순서로 바꾸고, 점 표기 주소는 `inet_pton(){:c}`으로 32비트 이진 값으로 바꾼다. `connect(){:c}`이 3-way handshake를 수행하며, `struct sockaddr *{:c}`를 받으므로 `(SA *){:c}`로 형 변환한다. TCP는 메시지 경계가 없는 바이트 스트림이라 서버가 한 번에 쓴 문자열도 여러 번에 나뉘어 도착할 수 있으므로 반복해서 읽는다. `read(){:c}`가 0이면 서버가 연결을 닫았다는 뜻(EOF)이고 음수면 오류다.

> [!NOTE] Winsock에서는 read() 대신 recv()
> Winsock의 `SOCKET`은 파일 디스크립터가 아니어서 `read(){:c}`/`write(){:c}`/`close(){:c}`를 쓸 수 없다. `recv(sockfd, recvline, MAXLINE, 0){:c}`, `send(){:c}`, `closesocket(){:c}`으로 바꾸고 앞뒤에 `WSAStartup(){:c}`과 `WSACleanup(){:c}`을 넣는다.

### daytime TCP 서버

```c
#include "unp.h"
#include <time.h>

int main(void)
{
	int listenfd, connfd; /* 연결을 기다리는 소켓과 연결된 소켓 */
	char buff[MAXLINE];
	struct sockaddr_in servaddr;
	time_t ticks;

	if ((listenfd = socket(AF_INET, SOCK_STREAM, 0)) < 0)
		err_sys("socket error");

	memset(&servaddr, 0, sizeof(servaddr));
	servaddr.sin_family = AF_INET;
	servaddr.sin_addr.s_addr = htonl(INADDR_ANY); /* 모든 인터페이스의 주소 */
	servaddr.sin_port = htons(13);                /* daytime 포트 */

	if (bind(listenfd, (SA *)&servaddr, sizeof(servaddr)) < 0)
		err_sys("bind error");
	if (listen(listenfd, LISTENQ) < 0)
		err_sys("listen error");

	for (;;) {
		if ((connfd = accept(listenfd, (SA *)NULL, NULL)) < 0) {
			if (errno == EINTR || errno == ECONNABORTED)
				continue; /* 연결이 중간에 끊긴 경우는 다시 기다린다 */
			err_sys("accept error");
		}

		ticks = time(NULL);
		snprintf(buff, sizeof(buff), "%.24s\r\n", ctime(&ticks));
		if (write(connfd, buff, strlen(buff)) != (ssize_t)strlen(buff))
			err_sys("write error");

		close(connfd); /* 보낸 즉시 연결을 닫는다 */
	}
}
```

서버는 소켓을 두 종류 쓴다. `listenfd`는 `bind(){:c}`와 `listen(){:c}`을 거쳐 연결을 기다리는 소켓이고, `connfd`는 `accept(){:c}`이 연결마다 새로 돌려주는 소켓이다. 시각을 쓰고 닫는 대상은 `connfd`이며 `listenfd`는 계속 열려 있다. 이 서버는 클라이언트 주소를 쓰지 않으므로 `accept(){:c}`의 주소 인자에 `NULL`을 넘긴다. `ECONNABORTED`는 handshake가 끝난 연결을 클라이언트가 `accept(){:c}` 전에 RST로 끊은 경우이고(오래된 System V 계열은 `EPROTO`를 돌려준다), `EINTR`은 시그널로 호출이 중단된 경우다.

`ctime(){:c}`은 `"Fri Nov  5 10:20:30 2021\n"`처럼 개행을 포함한 25글자를 돌려준다. `%.24s`로 앞 24글자만 취해 개행을 버리고 `\r\n`을 붙이므로 서버는 연결마다 26바이트를 보낸다.

### 빌드와 실행

GNU Make 빌드는 `Makefile`을 작성하고 `make all`을 실행한다. 레시피 줄은 탭으로 시작한다. Visual Studio에서는 클라이언트와 서버에 각각 빈 C++ 프로젝트를 만들고 해당 `.c` 파일과 `unp.h`를 추가한다.

```makefile
all: daytimetcpcli daytimetcpsrv

daytimetcpcli: daytimetcpcli.c unp.h
	gcc -Wall -o daytimetcpcli daytimetcpcli.c

daytimetcpsrv: daytimetcpsrv.c unp.h
	gcc -Wall -o daytimetcpsrv daytimetcpsrv.c

clean:
	rm -f daytimetcpcli daytimetcpsrv
```

```bash
$ ./daytimetcpsrv &
$ ./daytimetcpcli 127.0.0.1
Fri Nov  6 01:39:44 2026
```

> [!IMPORTANT] 1024 미만 포트와 권한
> 리눅스에서 1024 미만 포트에 `bind(){:c}`하려면 root 권한이나 `CAP_NET_BIND_SERVICE`가 필요하고, 없으면 `bind error: Permission denied`가 난다. `sudo`로 실행하거나 포트를 1024 이상(예: 9013)으로 바꾸고 클라이언트도 같은 포트로 맞춘다. 위 실행 예는 이 제한이 없는 macOS에서 일반 사용자로 실행했다.

![daytime 서버와 클라이언트의 호출 순서와 SYN, SYN+ACK, ACK, 시각 문자열, FIN 세그먼트](./images/net-socket-programming-daytime.svg 'connect()는 handshake가 끝나야 반환하고, 서버의 close()가 FIN을 보내 클라이언트 read()가 0을 받는다')

이 예제에서 세 가지를 관찰할 수 있다. 첫째, 파일의 열기·입출력·닫기 세 단계보다 훨씬 길다. 확장성을 위해 `open(){:c}`에 해당하는 절차를 잘게 나눴기 때문이고, 최종 번호표는 클라이언트에서 `socket(){:c}`의 반환값, 서버에서 `accept(){:c}`의 반환값이다. 둘째, 13은 daytime의 well-known 포트 번호다. 셋째, 클라이언트는 서버 IP를 명시하지만 서버는 `INADDR_ANY`(값 0)로 초기화한다. 어느 인터페이스 주소로 들어온 연결이든 받겠다는 의미이고, 랜카드가 여럿인 서버에서 한 인터페이스로만 받으려면 그 IP를 넣는다.

## 소켓의 도메인과 타입

호스트 A(`198.51.100.10`)의 서버 응용 P가 소켓 x를 80번 포트에 바인드하고, 호스트 B(`203.0.113.7`)의 클라이언트 Q가 소켓 y로 접속하면 커널이 y에 임시 포트(예: 17322)를 할당한다. x의 주소는 `198.51.100.10:80`, 피어는 `203.0.113.7:17322`이고 y는 그 반대다. P에게 x는 로컬, y는 피어(원격) 소켓이다.

`socket(){:c}`의 도메인 인자는 주소 형식을 정한다. `AF_UNIX`는 같은 호스트 안에서 경로 이름으로(`sockaddr_un`), `AF_INET`은 32비트 IPv4 주소와 16비트 포트로(`sockaddr_in`), `AF_INET6`은 128비트 IPv6 주소와 16비트 포트로(`sockaddr_in6`) 통신한다. 타입 인자는 전달 방식을 정한다.

| 타입             | 의미                                               |
| ---------------- | -------------------------------------------------- |
| `SOCK_STREAM`    | 순서 보장, 신뢰성, 양방향, 연결 지향 바이트 스트림 |
| `SOCK_DGRAM`     | 비연결, 신뢰성 없음, 길이 제한이 있는 메시지       |
| `SOCK_SEQPACKET` | 순서 보장, 신뢰성, 연결 지향 메시지                |
| `SOCK_RAW`       | IP에 직접 접근(POSIX.1에서 선택 사항)              |

`SOCK_RAW`는 IP·ICMP 헤더를 직접 만드는 용도로 쓰며 패킷 위조의 바탕이다. 원시 소켓의 활용은 [스니핑과 스푸핑](/memo/net-sniffing-spoofing)에서 다룬다.

스트림 소켓은 신뢰성 있는 양방향 바이트 스트림 채널이다. 신뢰성은 보낸 데이터가 그대로 도착하거나 전송 실패 가능성을 통보받는다는 뜻이고(링크나 수신 측이 죽지 않는다는 가정에서), 바이트 스트림은 파이프처럼 메시지 경계가 없다는 뜻이다. 연결된 쌍으로 동작하므로 연결 지향이라 부르고, 한 소켓은 피어 하나에만 연결된다. 연결 수립 후에는 자기 소켓만 지정해도 읽고 쓸 수 있다.

![유닉스 도메인 소켓은 커널 안 버퍼 두 개로 두 응용을 잇고, TCP 스트림은 양쪽 커널의 TCP 종점마다 상태 정보와 송신·수신 버퍼를 갖추는 구조](./images/net-socket-programming-buffers.svg '응용은 sockfd로 커널 버퍼에 쓰고 읽을 뿐, 세그먼트 전송은 TCP 종점이 맡는다')

`write(){:c}`의 반환은 데이터가 커널 송신 버퍼로 복사됐다는 뜻이지 상대가 받았다는 뜻이 아니다.

데이터그램 소켓은 메시지 경계를 보존하지만 순서가 바뀌거나 중복되거나 유실될 수 있다. 비연결 소켓이라 커널이 피어 주소를 보관하지 않으므로, 보통 `sendto(){:c}`와 `recvfrom(){:c}`으로 매번 상대 주소를 지정한다. 인터넷 도메인에서 데이터그램 소켓은 UDP를, 스트림 소켓은 (대개) TCP를 쓰므로 각각 UDP 소켓, TCP 소켓이라 부른다.

## 소켓 API 함수

![TCP 서버·클라이언트와 UDP 서버·클라이언트의 함수 호출 흐름 전체](./images/net-socket-programming-flow-full.svg '소켓 프로그래밍의 지도다. TCP 쪽 close()는 상대 read()에 EOF로 전달된다')

### socket()과 bind()

```c
#include <sys/socket.h>
int socket(int domain, int type, int protocol);
/* 성공하면 파일 디스크립터, 실패하면 -1 */
int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
/* 성공하면 0, 실패하면 -1 */
```

`socket(){:c}`의 `protocol`은 한 도메인·타입 조합에 프로토콜이 여럿인 경우를 위한 확장용 인자로, 보통 0을 넣어 기본 프로토콜을 고른다. `bind(){:c}`는 `addr`이 가리키는 주소(인터넷 도메인에서는 `INADDR_ANY` 또는 특정 인터페이스 IP와 포트)를 소켓에 할당하고, `addrlen`은 그 구조체 크기다. `socklen_t`는 SUSv3가 정한 정수형이다. 서버 소켓은 보통 클라이언트가 미리 알고 있는 well-known 주소에 바인드한다.

### 소켓 주소 구조체

`bind(){:c}`, `connect(){:c}`, `accept(){:c}`은 모든 도메인에서 쓰도록 범용 `struct sockaddr`의 포인터를 받는다. 실제로는 도메인별 구조체를 채운 뒤 포인터를 형 변환해 넘긴다.

```c
struct sockaddr {          /* 범용 */
	sa_family_t sa_family; /* 주소 계열(AF_INET 등) */
	char sa_data[14];      /* 계열별 주소 정보 */
};
struct in_addr {
	in_addr_t s_addr; /* 32비트 IPv4 주소, 네트워크 바이트 순서 */
};
struct sockaddr_in {           /* IPv4 전용 */
	sa_family_t sin_family;    /* AF_INET */
	in_port_t sin_port;        /* 16비트 포트, 네트워크 바이트 순서 */
	struct in_addr sin_addr;   /* 32비트 IPv4 주소 */
	unsigned char sin_zero[8]; /* 사용하지 않음 */
};
```

`sockaddr_in`은 2 + 2 + 4 + 8 = 16바이트로 범용 `sockaddr`(2 + 14 = 16바이트)와 크기가 같다. `sin_zero`가 이 크기를 맞추는 채움이며, 구조체 전체를 0으로 초기화하는 이유 중 하나다. BSD 계열(macOS 포함)은 앞 2바이트를 1바이트 `sin_len`과 1바이트 `sin_family`로 나눠 쓰지만 전체 크기는 같다.

![sockaddr_in 16바이트, sockaddr_in6 28바이트, sockaddr_un 가변 길이, sockaddr_dl, sockaddr_storage 구조체 비교](./images/net-socket-programming-sockaddr.svg 'sockaddr_in 외의 구조체는 크기가 달라서 addrlen 인자가 필요하다')

`sockaddr_in6`은 길이·계열 2, 포트 2, 흐름 레이블 4, IPv6 주소 16, scope ID 4로 28바이트다. 크기가 도메인마다 다르므로 함수마다 `addrlen`을 함께 넘긴다. `sockaddr_storage`는 어떤 주소 구조체도 담을 만큼 크게 정의되어, 상대가 IPv4인지 IPv6인지 모르는 상태에서 주소를 받는 용도로 쓴다.

### listen()과 backlog

```c
int listen(int sockfd, int backlog); /* 성공하면 0, 실패하면 -1 */
```

`listen(){:c}`은 소켓을 수동(passive) 소켓으로 표시하고, 이후 커널은 이 소켓으로 오는 SYN에 응답한다. `backlog`는 아직 `accept(){:c}`되지 않은 대기 연결의 수를 제한한다.

![SYN_RCVD 상태의 미완료 연결 큐와 ESTABLISHED 상태의 완료 연결 큐, 수동 소켓과 능동 소켓의 호출 흐름](./images/net-socket-programming-queues.svg 'handshake가 끝난 연결은 완료 큐에서 accept()를 기다린다')

커널은 큐 두 개를 관리한다. SYN+ACK를 보내고 마지막 ACK를 기다리는 연결은 미완료 큐(SYN_RCVD)에, handshake가 끝난 연결은 완료 큐(ESTABLISHED)에 들어가고, `accept(){:c}`은 완료 큐의 맨 앞을 꺼낸다. 클라이언트의 `connect(){:c}`은 handshake가 끝나면 반환하므로, 서버가 아직 `accept(){:c}`을 부르지 않았어도 클라이언트 쪽은 연결이 완료된 상태다.

> [!WARNING] backlog의 의미는 OS마다 다르다
> 전통적인 BSD 구현에서는 두 큐의 합이 backlog를 넘지 못한다. 리눅스는 2.2 이후 backlog를 완료 큐에만 적용하고, 미완료 큐 길이는 `net.ipv4.tcp_max_syn_backlog`로 정한다. 큐가 가득 찬 상태에서 SYN이 오면 TCP는 RST 없이 그 SYN을 무시한다. 클라이언트가 재전송하는 사이 자리가 날 수 있기 때문이다(RST를 보내는 구현은 바른 동작이 아니다). 미완료 큐를 일부러 채우는 공격이 SYN 플러딩이며 [TCP 프로토콜을 겨냥한 공격과 방어](/memo/net-tcp-attacks)에서 다룬다.

![backlog 0부터 14까지에 대해 운영체제별로 실제 허용하는 대기 연결 수를 그린 꺾은선 그래프](./images/net-socket-programming-backlog.svg '같은 backlog라도 OS마다 실제 큐 길이가 다르다')

그래프에서 Linux 2.4.7은 backlog + 3, MacOS 10.2.6과 AIX 5.1은 `\lfloor 1.5 \times \text{backlog} \rfloor + 1{:math}`을 허용한다. backlog 2라면 리눅스 5개, macOS 4개다. 이식성 있는 코드는 backlog를 정확한 상한으로 기대하지 말고 넉넉한 값을 준다.

### accept()와 connect()

```c
int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
/* 성공하면 새 파일 디스크립터, 실패하면 -1 */
int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
/* 성공하면 0, 실패하면 -1 */
```

`accept(){:c}`은 수신 대기 소켓에서 연결 하나를 받아 그 연결 전용 소켓을 돌려주고, 대기 연결이 없으면 연결 요청이 도착하기 전까지 블록된다. `addr`은 피어 주소를 돌려받을 구조체다. `addrlen`은 값-결과(value-result) 인자로, 호출 전에는 버퍼 크기를 커널에 알리고 반환 후에는 커널이 기록한 크기를 담는다. 피어 주소가 필요 없으면 둘 다 `NULL`을 넘긴다.

`connect(){:c}`은 능동 소켓을 `addr`의 수신 대기 소켓에 연결하며, 인자는 `bind(){:c}`와 같은 방식으로 지정한다. 클라이언트는 보통 `bind(){:c}`를 호출하지 않고, 커널이 `connect(){:c}` 시각에 출발지 IP와 임시 포트(ephemeral port)를 고른다.

![클라이언트 connect가 SYN J를 보내고, SYN K와 ACK J+1을 받으면 connect가 반환하며, ACK K+1을 받으면 서버 accept가 반환하는 3-way handshake](./images/net-socket-programming-handshake.svg 'connect()는 두 번째, accept()는 세 번째 세그먼트를 받은 뒤 반환한다')

![연결 수립 세 단계에서 서버 listenfd는 {*:13, *:*}를 유지하고, 클라이언트는 임시 포트를 받으며, accept 뒤 connfd가 생기는 그림](./images/net-socket-programming-concurrent.svg '로컬 포트가 같은 소켓 여럿을 원격 주소로 구별한다')

연결 수립 과정의 소켓 주소 쌍은 세 단계로 변한다. `accept(){:c}` 대기 중인 수신 소켓은 `{*:13, *:*}`다. `*:13`의 IP는 `INADDR_ANY`의 결과, 포트는 `bind(){:c}`의 결과이고 원격 주소는 없다. `connect(){:c}` 직후 클라이언트 소켓에 임시 포트(예: 50000)가 정해진다. 연결이 끝나면 서버에 `{198.51.100.10:13, 203.0.113.7:50000}`인 연결 소켓이 새로 생기고 수신 소켓은 그대로 남는다. ==서버의 연결 소켓은 모두 로컬 포트 13을 쓰고, 커널은 출발지·목적지 IP와 포트 네 값으로 세그먼트를 소켓에 배정한다.== `fork(){:c}` 서버라면 이 연결 소켓을 자식 프로세스가 맡는다.

### 버퍼 크기와 MSS

![응용 버퍼에서 write로 커널 송신 버퍼로 복사하고, TCP가 MSS 크기 세그먼트로, IP가 MTU 크기 패킷으로 나누는 경로](./images/net-socket-programming-mss.svg 'MSS는 보통 MTU − 40(IPv4) 또는 MTU − 60(IPv6) 이하다')

IPv4 데이터그램의 최대 크기는 전체 길이 필드가 16비트이므로 `2^{16} - 1 = 65535{:math}`바이트이고, 경로상 링크의 MTU가 실제 크기를 더 줄인다. TCP는 MSS(Maximum Segment Size)로 한 세그먼트에 받을 수 있는 최대 데이터 양을 상대에게 알린다. 옵션이 없는 경우 이더넷에서는 다음과 같다.

```math
\text{MSS} = \text{MTU} - \underbrace{20}_{\text{IPv4}} - \underbrace{20}_{\text{TCP}} = 1500 - 40 = 1460
```

상대가 MSS 옵션을 보내지 않으면 기본값 536을 쓴다. 모든 호스트가 받아야 하는 최소 IP 데이터그램 576바이트에서 헤더 40바이트를 뺀 값이다. `write(){:c}`에 넘기는 응용 버퍼는 크기 제한이 없지만, 커널 송신 버퍼(`SO_SNDBUF`)가 가득 차면 자리가 생기기 전까지 블록된다.

### recv()와 send()

```c
ssize_t recv(int sockfd, void *buffer, size_t length, int flags);
/* 받은 바이트 수, EOF면 0, 실패하면 -1 */
ssize_t send(int sockfd, const void *buffer, size_t length, int flags);
/* 보낸 바이트 수, 실패하면 -1 */
```

반환값과 앞의 세 인자는 `read(){:c}`/`write(){:c}`와 같고, 소켓 전용 동작을 고르는 `flags`가 추가됐다(쓰지 않으면 0).

| 플래그         | 동작                                                              |
| -------------- | ----------------------------------------------------------------- |
| `MSG_DONTWAIT` | 이 호출만 비블로킹. 데이터나 버퍼 공간이 없으면 `EAGAIN`으로 실패 |
| `MSG_OOB`      | 대역 외(out-of-band) 데이터를 주고받는다                          |
| `MSG_PEEK`     | `recv` 전용. 버퍼의 바이트를 복사만 하고 제거하지 않는다          |
| `MSG_WAITALL`  | `recv` 전용. `length` 바이트를 다 받기 전까지 반환하지 않는다     |
| `MSG_NOSIGNAL` | `send` 전용. 닫힌 연결에 써도 `SIGPIPE` 없이 `EPIPE`로 실패한다   |

`MSG_DONTWAIT`는 SUSv3에 없지만 여러 유닉스 구현이 지원한다. `MSG_NOSIGNAL`은 리눅스용이고 macOS에서는 소켓 옵션 `SO_NOSIGPIPE`가 같은 역할을 한다.

### close()와 연결 종료

```c
int close(int sockfd); /* 성공하면 0, 실패하면 -1 */
```

TCP 소켓의 `close(){:c}`은 기본적으로 소켓을 닫힘으로 표시하고 즉시 반환한다. 닫힌 소켓은 더 이상 `read(){:c}`/`write(){:c}`에 쓸 수 없고, 양방향 채널이 모두 닫힌다. TCP는 송신 큐에 남은 데이터를 마저 보낸 뒤 정상 종료 절차를 시작한다.

![클라이언트 close로 FIN M을 보내 FIN_WAIT_1, ACK M+1로 FIN_WAIT_2, 서버 close로 FIN N과 LAST_ACK, ACK N+1 뒤 TIME_WAIT와 CLOSED](./images/net-socket-programming-close.svg '앞서 write한 데이터의 전송이 끝난 뒤에야 FIN이 나간다')

먼저 닫는 쪽이 능동 종료(active close)를, 나중에 닫는 쪽이 수동 종료(passive close)를 수행한다. 흔히 클라이언트가 능동 종료를 하지만, HTTP/1.0 서버와 위의 daytime 서버는 서버가 먼저 닫는다.

![TCP 상태 전이도와 클라이언트·서버의 일반 경로](./images/net-socket-programming-tcp-states.svg '굵은 실선은 클라이언트의, 점선은 서버의 일반 경로다')

![socket부터 close까지 한 연결의 전체 패킷 교환과 각 시점의 상태](./images/net-socket-programming-exchange.svg '응답 데이터에 요청의 ACK가 실려 가는 피기백도 보인다')

이 그림은 함수 호출과 세그먼트, 상태 변화를 대응시킨다. `connect(){:c}`이 SYN을 보내 SYN_SENT가 되고, 서버의 `read(){:c}`가 0을 반환하는 시각은 클라이언트의 FIN이 도착한 시각이다. 상태 전이의 자세한 설명은 [UDP와 TCP의 헤더, 연결 설정과 종료, 상태 전이](/memo/net-udp-tcp)에 있다.

> [!IMPORTANT] 서버가 먼저 닫으면 서버 쪽에 TIME_WAIT가 남는다
> daytime 서버는 능동 종료를 하므로 연결마다 서버 소켓이 TIME_WAIT로 2MSL 동안 남는다. 클라이언트를 두 번 실행한 직후 `netstat -an -p tcp`(macOS)로 조회하면 `127.0.0.1.13`의 TIME_WAIT 항목 두 개가 남아 있고, 이 상태에서 서버를 다시 띄우면 `bind error: Address already in use`가 난다. `bind(){:c}` 전에 `SO_REUSEADDR` 옵션을 켜면 TIME_WAIT 연결이 남아 있어도 같은 포트에 바인드할 수 있다.

### shutdown()

```c
int shutdown(int sockfd, int how); /* 성공하면 0, 실패하면 -1 */
```

한 방향의 전송만 끝내고 반대 방향은 유지해야 하는 경우가 있다. 요청을 모두 보낸 클라이언트가 "더 보낼 것이 없다"고 알리면서 응답은 계속 받는 상황이다. `SHUT_RD`는 읽기 방향을 닫아 이후 읽기가 EOF를 반환하게 하지만 TCP에서는 의미 있는 동작이 없다. `SHUT_WR`는 쓰기 방향을 닫고 FIN을 보내며, 이후 쓰기는 `SIGPIPE`와 `EPIPE`를 일으키지만 상대 데이터는 계속 읽을 수 있다. 이를 반쪽 닫기(half-close)라 부르며 가장 흔한 사용이다. `SHUT_RDWR`는 두 방향을 모두 닫는다.

`shutdown(){:c}`은 채널만 닫고 디스크립터는 닫지 않으므로 끝으로 `close(){:c}`을 따로 호출한다. 또 `fork(){:c}`로 디스크립터를 공유한 프로세스가 여럿이면 `close(){:c}`은 참조 횟수만 줄이고 마지막 참조가 닫히는 시각에만 FIN을 보내지만, `shutdown(){:c}`은 참조 횟수와 무관하게 즉시 연결에 작용한다.

### UDP: recvfrom()과 sendto()

```c
ssize_t recvfrom(int sockfd, void *buffer, size_t length, int flags,
                 struct sockaddr *src_addr, socklen_t *addrlen);
ssize_t sendto(int sockfd, const void *buffer, size_t length, int flags,
               const struct sockaddr *dest_addr, socklen_t addrlen);
/* 주고받은 바이트 수, 실패하면 -1 */
```

앞의 네 인자는 `recv(){:c}`/`send(){:c}`와 같다. `recvfrom(){:c}`의 `src_addr`과 `addrlen`은 `accept(){:c}`처럼 보낸 쪽 주소를 돌려받는 값-결과 인자이고, 둘 다 `NULL`이면 `recv(){:c}`와 같다. `sendto(){:c}`의 `dest_addr`과 `addrlen`은 `connect(){:c}`처럼 상대를 지정한다. `recvfrom(){:c}`은 `length`와 상관없이 메시지 하나만 꺼내며, 메시지가 더 길면 남는 부분은 알림 없이 잘린다. 길이 0인 데이터그램은 리눅스에서는 보낼 수 있지만 모든 유닉스 구현이 허용하지는 않는다. TCP에서 0바이트 `read(){:c}`는 EOF지만 UDP에서 0바이트 수신은 빈 데이터그램 하나를 받았다는 뜻이다.

### 소켓 옵션

```c
int getsockopt(int sockfd, int level, int optname, void *optval, socklen_t *optlen);
int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen);
/* 성공하면 0, 실패하면 -1 */
```

`level`은 옵션이 적용될 프로토콜로 대부분 `SOL_SOCKET`을, TCP 고유 옵션은 `IPPROTO_TCP`를 쓴다. `optname`은 옵션 이름, `optval`은 값 버퍼, `optlen`은 그 크기다.

```c
int on = 1;
setsockopt(listenfd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)); /* TIME_WAIT 문제 */

int size;
socklen_t len = sizeof(size);
getsockopt(sockfd, SOL_SOCKET, SO_SNDBUF, &size, &len); /* 송신 버퍼 크기 조회 */
```

## 바이트 순서와 주소 변환

### 비트 번호 매기기

비트 번호(bit numbering)는 이진수 안의 비트 위치에 번호를 붙이는 규칙이고 엔디언과는 다른 개념이다. N비트 값 `b_0 b_1 \dots b_{N-1}{:math}`을 두 규칙으로 해석하면 다음과 같다.

```math
\text{LSB 0: } \sum_{i=0}^{N-1} b_i \cdot 2^{i} \qquad\qquad \text{MSB 0: } \sum_{i=0}^{N-1} b_i \cdot 2^{N-1-i}
```

LSB 0이면 가장 작은 자리 비트(LSB)가 0번, MSB 0이면 가장 큰 자리 비트(MSB)가 0번이다. ==IETF 문서의 헤더 그림은 MSB 0 번호를 쓴다.== 그래서 IPv4 헤더 그림의 0번 비트는 버전 필드의 최상위 비트다. 보통은 신경 쓸 일이 없지만 RFC 헤더 그림을 비트 연산으로 옮기는 경우에는 이 차이를 알아야 한다.

### 엔디언

엔디언(endianness)은 여러 바이트로 된 값을 메모리에 저장하는 순서다. 리틀 엔디언은 가장 작은 자리 바이트를, 빅 엔디언은 가장 큰 자리 바이트를 낮은 주소에 놓는다. 프로세서(x86, 대부분의 ARM)는 리틀 엔디언이 지배적이고 네트워크 프로토콜(IP, TCP, UDP)은 빅 엔디언이 지배적이다. 예전 Sun, HP, SGI는 빅 엔디언, DEC과 Intel은 리틀 엔디언이었다.

![32비트 정수 0x0A0B0C0D가 빅 엔디언에서는 0A, 0B, 0C, 0D로, 리틀 엔디언에서는 0D, 0C, 0B, 0A로 저장되는 비교](./images/net-socket-programming-endian.svg '같은 값이 바이트 순서만 반대로 놓인다')

```c
#include <stdio.h>

int main(void)
{
	union {
		unsigned int addr;  /* 4바이트 주소 */
		unsigned char c[4]; /* 같은 메모리를 바이트 단위로 읽는다 */
	} un;

	un.addr = 0x8002c25f;
	printf("%u %u %u %u\n", un.c[0], un.c[1], un.c[2], un.c[3]);
	return 0;
}
```

리틀 엔디언 호스트(x86, Apple Silicon)에서 출력은 `95 194 2 128`이고 `c[0]`은 `0x5F` = 95다. 빅 엔디언 호스트라면 `128 2 194 95`가 나온다. `0x8002C25F`를 점 표기로 쓰면 `128.2.194.95`다.

![0x8002C25F를 빅 엔디언은 80 02 C2 5F, 리틀 엔디언은 5F C2 02 80으로 보관하는 그림](./images/net-socket-programming-byteorder.svg '리틀 엔디언 호스트에서 c[0]은 가장 낮은 자리 바이트 0x5F다')

<details>
<summary>배열을 char c[4]로 선언하면 무엇이 잘못되는가</summary>

`char`가 부호 있는 형인 환경(x86, macOS)에서 배열을 `char c[4]{:c}`로 선언하면 출력이 `95 4294967234 2 4294967168`이 된다. `0xC2`와 `0x80`은 최상위 비트가 1이라 부호 있는 `char`로는 −62와 −128이다. 가변 인자 함수에 넘기면 `int`로 승격되며 부호가 확장되고, `%u`는 그 비트 패턴을 부호 없는 32비트 정수로 출력한다.

```math
-62 \rightarrow 2^{32} - 62 = 4294967234, \qquad -128 \rightarrow 2^{32} - 128 = 4294967168
```

바이트를 숫자로 다루려면 `unsigned char`나 `uint8_t`를 쓴다. IP 주소 옥텟을 `char` 배열에서 꺼내 출력하는 코드에서 128 이상의 옥텟이 거대한 수로 찍히는 원인도 같다.

</details>

TCP/IP의 네트워크 바이트 순서는 빅 엔디언이고 대부분의 호스트 바이트 순서(PC, 스마트폰)는 리틀 엔디언이므로, IP 주소와 포트는 구조체에 넣기 전에 변환한다. `htonl(){:c}`/`htons(){:c}`는 호스트에서 네트워크 순서로 32비트·16비트 값을 바꾸고, `ntohl(){:c}`/`ntohs(){:c}`는 그 반대다. 보통 `htonl(){:c}`은 IPv4 주소에, `htons(){:c}`은 포트에 쓴다.

`htons(13){:c}`을 예로 든다. 13 = `0x000D`는 리틀 엔디언 메모리에 `0D 00`으로 놓이고, `htons(){:c}`이 두 바이트를 뒤집어 `00 0D`가 된다. 앞의 NIST 캡처에서 출발지 포트 자리에 보인 바이트다. 빅 엔디언 호스트에서 이 함수들은 아무 일도 하지 않으므로, 항상 호출하면 어느 호스트에서나 바른 코드가 된다.

> [!TIP] 변환을 빠뜨리면
> `servaddr.sin_port = 13;{:c}`처럼 `htons(){:c}`을 빠뜨리면 리틀 엔디언 호스트는 메모리에 `0D 00`을 쓰고, 네트워크는 이를 `0x0D00` = 3328번 포트로 읽는다. 컴파일 오류 없이 엉뚱한 포트로 연결하므로 `Connection refused`가 나면 바이트 순서 변환부터 확인한다.

IPv4 주소는 32비트를 8비트씩 나눠 10진수로 적는 점 표기(dotted decimal)로 쓴다. `192.0.2.33`은 `11000000.00000000.00000010.00100001`, 16진수로 `0xC0000221`이고, `inet_pton(){:c}`이 `sin_addr`에 채우는 값은 메모리상 `C0 00 02 21`이다.

### 이름과 주소

인터넷의 주소 체계는 IP 하나로 의도적으로 설계됐고, 이름 체계는 DNS 하나로 거의 우연히, 나중에 덧붙여졌다. 호스트 이름은 로컬 `hosts` 파일이나 DNS 리졸버가 IP 주소로 바꾼다. 이름과 주소를 분리하면 서버 주소가 바뀌어도 사용자와 응용은 같은 이름을 쓰고, 이름 하나를 여러 복제 서버 주소에 대응시켜 부하를 분산하고 가까운 서버로 지연을 줄일 수 있다. 반대로 `www.example.com`과 `example.com` 같은 별칭 여러 개가 호스트의 실제 이름인 정규 이름(canonical name, CNAME)으로 이어질 수도 있다.

### 주소 변환 함수

| 오래된 함수       | 변환                              | 대체 함수       |
| ----------------- | --------------------------------- | --------------- |
| `inet_aton()`     | 점 표기 → 네트워크 순서 IPv4 주소 | `inet_pton()`   |
| `inet_ntoa()`     | 네트워크 순서 IPv4 주소 → 점 표기 | `inet_ntop()`   |
| `gethostbyname()` | 호스트 이름 → 주소를 포함한 정보  | `getaddrinfo()` |
| `gethostbyaddr()` | 주소 → 호스트 이름을 포함한 정보  | `getnameinfo()` |

왼쪽 함수들은 주로 IPv6를 지원하지 못해 권장되지 않지만 많은 예제가 아직 쓴다. `inet_ntoa(){:c}`와 `gethostbyname(){:c}`은 정적 버퍼를 돌려주므로 스레드에 안전하지도 않다.

```c
int inet_pton(int domain, const char *src_str, void *addrptr);
/* 성공 1, 표기 형식이 아니면 0, 실패 -1 */
const char *inet_ntop(int domain, const void *addrptr, char *dst_str, size_t len);
/* 성공하면 dst_str, 실패하면 NULL */
```

p는 표기(presentation: IPv4 점 표기, IPv6 16진 문자열), n은 네트워크 순서 이진 주소다. `domain`은 `AF_INET` 또는 `AF_INET6`이고 `addrptr`은 그에 맞는 `in_addr`/`in6_addr`를 가리킨다. daytime 클라이언트가 반환값을 `<= 0{:c}`으로 검사한 이유는 0(형식 오류)과 −1을 모두 실패로 처리하기 위해서다. `inet_ntop(){:c}`은 `len`이 작으면 `NULL`을 돌려주고 `errno`를 `ENOSPC`로 설정하므로, 버퍼는 `INET_ADDRSTRLEN`(16)이나 `INET6_ADDRSTRLEN`(46)으로 잡는다. IPv4 최장 문자열 `255.255.255.255`는 15글자에 널 문자를 더해 16이고, IPv6 최장 문자열인 IPv4 매핑 형식 `ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255`는 30 + 15 = 45글자에 널 문자를 더해 46이다.

### getnameinfo()와 getaddrinfo()

```c
#include <netdb.h>
int getnameinfo(const struct sockaddr *addr, socklen_t addrlen, char *host, size_t hostlen,
                char *service, size_t servlen, int flags);
int getaddrinfo(const char *host, const char *service,
                const struct addrinfo *hints, struct addrinfo **result);
/* 둘 다 성공하면 0, 실패하면 0이 아닌 값 */

struct addrinfo {
	int ai_flags;             /* 입력 플래그(AI_* 상수) */
	int ai_family;            /* 주소 계열 */
	int ai_socktype;          /* SOCK_STREAM, SOCK_DGRAM */
	int ai_protocol;          /* 소켓 프로토콜 */
	socklen_t ai_addrlen;     /* ai_addr 구조체 크기 */
	char *ai_canonname;       /* 정규 이름 */
	struct sockaddr *ai_addr; /* 소켓 주소 구조체 */
	struct addrinfo *ai_next; /* 다음 항목 */
};
```

`getnameinfo(){:c}`은 소켓 주소 구조체를 호스트 이름과 서비스 이름으로 바꿔 호출자가 할당한 버퍼에 쓴다. 버퍼 크기는 `NI_MAXHOST`(1025)와 `NI_MAXSERV`(32)로 잡는다. `getaddrinfo(){:c}`은 반대로 호스트 이름이나 숫자 주소 문자열과 서비스 이름이나 포트 번호를 받아, `hints`의 조건에 맞는 `addrinfo` 연결 리스트를 동적으로 할당해 `result`에 돌려준다.

![result가 addrinfo 연결 리스트를 가리키고 각 항목의 ai_addr가 소켓 주소 구조체를, 첫 항목의 ai_canonname이 정규 호스트 이름을 가리키는 구조](./images/net-socket-programming-addrinfo.svg '이름 하나에 주소가 여럿일 수 있어 결과가 리스트다')

```c
#include <netdb.h>
#include <stdio.h>
#include <string.h>
#include <arpa/inet.h>
#include <sys/socket.h>

int main(int argc, char *argv[])
{
	struct addrinfo hints, *res, *p;
	char addr[INET6_ADDRSTRLEN], host[NI_MAXHOST];
	int err;

	if (argc != 2)
		return 1;
	memset(&hints, 0, sizeof(hints));
	hints.ai_family = AF_UNSPEC;     /* IPv4와 IPv6 모두 */
	hints.ai_socktype = SOCK_STREAM; /* TCP 주소만 */
	hints.ai_flags = AI_CANONNAME;

	if ((err = getaddrinfo(argv[1], "http", &hints, &res)) != 0) {
		fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(err));
		return 1;
	}
	if (res->ai_canonname)
		printf("canonical name: %s\n", res->ai_canonname);
	for (p = res; p != NULL; p = p->ai_next) {
		void *a = p->ai_family == AF_INET
			? (void *)&((struct sockaddr_in *)p->ai_addr)->sin_addr
			: (void *)&((struct sockaddr_in6 *)p->ai_addr)->sin6_addr;
		inet_ntop(p->ai_family, a, addr, sizeof(addr));
		if (getnameinfo(p->ai_addr, p->ai_addrlen, host, sizeof(host), NULL, 0, 0) != 0)
			strcpy(host, "?");
		printf("%-6s %-40s %s\n", p->ai_family == AF_INET ? "IPv4" : "IPv6", addr, host);
	}
	freeaddrinfo(res); /* 리스트 전체를 해제한다 */
	return 0;
}
```

```bash
$ ./resolve localhost
canonical name: localhost
IPv6   ::1                                      localhost
IPv4   127.0.0.1                                localhost
```

`getaddrinfo(){:c}`의 오류는 `errno`가 아니라 반환값으로 오므로 `gai_strerror(){:c}`로 메시지를 얻는다. 리스트의 `ai_addr`를 그대로 `socket(){:c}`과 `connect(){:c}`에 넘기며 차례로 시도하면 IPv4와 IPv6를 구별하지 않는 클라이언트가 된다.

## 여러 클라이언트를 처리하는 서버

### fork()로 만드는 병행 서버

전통적인 병행 서버는 `accept(){:c}`이 연결을 돌려주면 곧바로 `fork(){:c}`로 자식 프로세스를 만든다. 앞의 daytime 서버에서 `SO_REUSEADDR`를 켜고 반복문을 다음처럼 바꾼다.

```c
static void sig_chld(int signo)
{
	(void)signo;
	while (waitpid(-1, NULL, WNOHANG) > 0) /* 끝난 자식을 모두 회수한다 */
		;
}

/* main()에서 listen() 뒤 */
signal(SIGCHLD, sig_chld);
for (;;) {
	if ((connfd = accept(listenfd, NULL, NULL)) < 0) {
		if (errno == EINTR || errno == ECONNABORTED)
			continue;
		err_sys("accept error");
	}
	if ((pid = fork()) == 0) { /* 자식: 이 연결만 처리한다 */
		char buff[MAXLINE];
		time_t ticks = time(NULL);
		close(listenfd);
		snprintf(buff, sizeof(buff), "%.24s\r\n", ctime(&ticks));
		write(connfd, buff, strlen(buff));
		close(connfd);
		exit(0);
	}
	close(connfd); /* 부모: 연결 소켓은 자식에게 넘기고 닫는다 */
}
```

`fork(){:c}` 직후 부모와 자식은 두 디스크립터를 공유해 각 소켓의 참조 횟수가 2가 된다. 자식은 쓰지 않는 `listenfd`를, 부모는 `connfd`를 닫아야 한다. 부모가 `connfd`를 닫지 않으면 자식이 닫아도 참조가 남아 FIN이 나가지 않고 부모의 디스크립터도 고갈된다. 끝난 자식은 회수 전까지 좀비 프로세스로 남는다. 시그널은 큐에 쌓이지 않아 자식 여럿이 함께 끝나도 처리기가 한 번만 불릴 수 있으므로, `waitpid(-1, NULL, WNOHANG){:c}`을 반복 호출한다. 처리기 실행 중 `accept(){:c}`이 `EINTR`로 중단되면 다시 호출한다.

### select()로 만드는 다중화 서버

여러 클라이언트가 같은 상태를 읽고 바꿔야 한다면 한 프로세스가 모든 소켓을 감시하는 I/O 다중화가 알맞다. 예로 IoT 환경의 스마트 홈 보일러를 원격으로 설정하는 시스템을 구현한다.

![클라이언트의 Commander와 Monitor가 인터넷을 거쳐 서버의 Coordinator에 연결하고, Coordinator가 기기 1부터 N까지를 관리하는 스마트 홈 시스템 구성](./images/net-socket-programming-smart-home.svg 'Commander는 설정을 바꾸고 Monitor는 상태를 감시한다')

Commander는 표준 입력으로 받은 명령을 보낸다. `QUERY`는 현재 온도와 안전 범위를 묻고, `CONFIGURE UPPER_BOUND 30`·`CONFIGURE LOWER_BOUND -5`는 범위를 바꾼다. Monitor는 반복문 안에서 `sleep(){:c}`으로 주기를 정해 `POLLING`을 보내고 `safe` 또는 `warning`을 출력한다. 서버 쪽 Coordinator는 두 클라이언트의 소켓을 `select(){:c}`로 다중화하고, `POLLING`마다 온도를 `refresh_temp(){:c}`로 −1, 0, +1 중 하나만큼 바꿔 안전 범위 안이면 `safe`, 밖이면 `warning`으로 응답한다. 초기 상태는 온도 25, 상한 30, 하한 −5이고, 모든 프로그램이 같은 호스트의 `127.0.0.1:8080`으로 접속한다.

| 매크로·함수              | 동작                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `FD_ZERO(&set)`          | 집합을 비운다                                                 |
| `FD_SET(fd, &set)`       | 디스크립터를 추가한다                                         |
| `FD_CLR(fd, &set)`       | 디스크립터를 제거한다                                         |
| `FD_ISSET(fd, &set)`     | 디스크립터가 집합에 있는지 검사한다                           |
| `select(maxfd + 1, ...)` | 하나라도 준비되기 전까지 블록하고, 준비된 디스크립터만 남긴다 |

==`select(){:c}`은 넘긴 집합을 결과로 덮어쓰므로, 감시 대상 전체(`allset`)를 따로 보관하고 호출마다 복사본(`rset`)을 넘긴다.== 첫 인자는 가장 큰 디스크립터 번호에 1을 더한 값이다. 수신 소켓이 읽기 준비가 됐다면 완료 큐에 연결이 있으므로 `accept(){:c}`이 블록되지 않는다. 연결 소켓이 읽기 준비가 됐다면 데이터가 왔거나 FIN이 온 경우이고, 후자면 `recv(){:c}`가 0을 돌려준다.

![Coordinator가 select()로 대기하다 listenfd면 accept와 FD_SET, 클라이언트면 recv와 명령 처리, recv가 0이면 close와 FD_CLR을 하는 흐름과 보일러 상태](./images/net-socket-programming-select.svg '스레드 하나가 이벤트가 생긴 소켓만 골라 처리하므로 보일러 상태에 경쟁 상태가 없다')

```c
#include "unp.h"
#include <sys/select.h>
#include <time.h>

#define PORT 8080
#define MAXCLI 8

struct client {
	int fd;        /* -1이면 빈 칸 */
	char buf[256]; /* 아직 개행을 받지 못한 바이트 */
	size_t len;
};

static int temp = 25, lower = -5, upper = 30;

int refresh_temp(int curr_temp)
{
	return curr_temp + rand() % 3 - 1; /* -1, 0, +1 중 하나만큼 변한다 */
}

/* 명령 한 줄을 처리하고 응답을 out에 적는다 */
static void handle(const char *line, char *out, size_t size)
{
	int value;

	if (strcmp(line, "QUERY") == 0)
		snprintf(out, size, "temp %d, lower %d, upper %d\n", temp, lower, upper);
	else if (sscanf(line, "CONFIGURE UPPER_BOUND %d", &value) == 1)
		snprintf(out, size, "Upper bound: %d\n", upper = value);
	else if (sscanf(line, "CONFIGURE LOWER_BOUND %d", &value) == 1)
		snprintf(out, size, "Lower bound: %d\n", lower = value);
	else if (strcmp(line, "POLLING") == 0) {
		temp = refresh_temp(temp);
		snprintf(out, size, "%s (temp %d)\n", lower <= temp && temp <= upper ? "safe" : "warning", temp);
	} else
		snprintf(out, size, "unknown command\n");
}

int main(void)
{
	int listenfd, maxfd, i, n;
	struct client cli[MAXCLI];
	struct sockaddr_in servaddr;
	fd_set allset, rset;
	char out[128];
	int on = 1;

	srand((unsigned)time(NULL));
	for (i = 0; i < MAXCLI; i++)
		cli[i].fd = -1;

	if ((listenfd = socket(AF_INET, SOCK_STREAM, 0)) < 0)
		err_sys("socket error");
	setsockopt(listenfd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on));

	memset(&servaddr, 0, sizeof(servaddr));
	servaddr.sin_family = AF_INET;
	servaddr.sin_addr.s_addr = htonl(INADDR_ANY);
	servaddr.sin_port = htons(PORT);
	if (bind(listenfd, (SA *)&servaddr, sizeof(servaddr)) < 0)
		err_sys("bind error");
	if (listen(listenfd, LISTENQ) < 0)
		err_sys("listen error");

	FD_ZERO(&allset);
	FD_SET(listenfd, &allset);
	maxfd = listenfd;

	for (;;) {
		rset = allset; /* select가 집합을 덮어쓰므로 매번 복사한다 */
		if (select(maxfd + 1, &rset, NULL, NULL, NULL) < 0) {
			if (errno == EINTR)
				continue;
			err_sys("select error");
		}

		if (FD_ISSET(listenfd, &rset)) { /* 새 연결 */
			int connfd = accept(listenfd, NULL, NULL);
			for (i = 0; i < MAXCLI && cli[i].fd >= 0; i++)
				;
			if (connfd >= 0 && i < MAXCLI) {
				cli[i].fd = connfd;
				cli[i].len = 0;
				FD_SET(connfd, &allset);
				if (connfd > maxfd)
					maxfd = connfd;
			} else if (connfd >= 0)
				close(connfd); /* 자리가 없으면 끊는다 */
		}

		for (i = 0; i < MAXCLI; i++) {
			struct client *c = &cli[i];
			char *nl;

			if (c->fd < 0 || !FD_ISSET(c->fd, &rset))
				continue;
			n = recv(c->fd, c->buf + c->len, sizeof(c->buf) - 1 - c->len, 0);
			if (n <= 0) { /* 0이면 상대가 연결을 닫았다 */
				FD_CLR(c->fd, &allset);
				close(c->fd);
				c->fd = -1;
				continue;
			}
			c->len += n;
			c->buf[c->len] = '\0';

			/* 바이트 스트림에서 개행까지를 명령 하나로 잘라 처리한다 */
			while ((nl = strchr(c->buf, '\n')) != NULL) {
				*nl = '\0';
				if (nl > c->buf && nl[-1] == '\r')
					nl[-1] = '\0';
				handle(c->buf, out, sizeof(out));
				send(c->fd, out, strlen(out), 0);
				c->len -= nl + 1 - c->buf;
				memmove(c->buf, nl + 1, c->len + 1);
			}
			if (c->len == sizeof(c->buf) - 1)
				c->len = 0; /* 개행 없이 버퍼가 차면 버린다 */
		}
	}
}
```

클라이언트마다 수신 버퍼를 따로 관리하는 이유는 TCP가 메시지 경계를 보존하지 않기 때문이다. `recv(){:c}` 한 번에 `"QUE"`만 오거나 `"POLLING\nPOLLING\n"`이 한꺼번에 올 수 있다. 그래서 명령 끝을 개행으로 정하고, 받은 바이트를 이어 붙인 뒤 개행 위치마다 한 명령씩 잘라 처리한다. 응용 계층에서 메시지 경계를 다시 정하는 이 작업을 프레이밍(framing)이라 한다. 줄 끝에 `\r\n`을 보내는 도구로도 시험할 수 있도록 `\r`도 제거한다.

> [!NOTE] 잠금이 없어도 되는 이유
> `handle(){:c}`은 `temp`, `lower`, `upper`를 잠금 없이 읽고 쓴다. 스레드 하나가 `select(){:c}`이 알려 준 소켓을 차례로 처리하므로 두 명령이 동시에 상태를 바꾸지 않는다. 스레드로 만들었다면 세 변수를 뮤텍스로 보호해야 한다.

두 클라이언트는 연결과 요청-응답 함수를 공유한다. Commander는 표준 입력의 한 줄을, Monitor는 1초마다 `POLLING\n`을 `request(){:c}`로 보낸다.

```c
/* client_common.h */
#include "unp.h"

static inline int connect_coordinator(void) /* 127.0.0.1:8080에 연결 */
{
	int fd;
	struct sockaddr_in addr;

	if ((fd = socket(AF_INET, SOCK_STREAM, 0)) < 0)
		err_sys("socket error");
	memset(&addr, 0, sizeof(addr));
	addr.sin_family = AF_INET;
	addr.sin_port = htons(8080);
	inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
	if (connect(fd, (SA *)&addr, sizeof(addr)) < 0)
		err_sys("connect error");
	return fd;
}

/* 명령을 보내고 개행으로 끝나는 응답 한 줄을 받는다 */
static inline void request(int fd, const char *cmd, char *reply, size_t size)
{
	size_t len = 0;
	int n;

	if (send(fd, cmd, strlen(cmd), 0) < 0)
		err_sys("send error");
	while (len < size - 1) {
		if ((n = recv(fd, reply + len, size - 1 - len, 0)) <= 0)
			err_quit("coordinator closed the connection");
		len += n;
		if (reply[len - 1] == '\n')
			break;
	}
	reply[len] = '\0';
}
```

Commander로 안전 범위를 24~26으로 좁힌 뒤 Monitor를 실행한 결과다. 온도가 23으로 내려간 시각에만 `warning`이 나온다.

```bash
$ ./coordinator &
$ ./commander
QUERY
temp 25, lower -5, upper 30
CONFIGURE LOWER_BOUND 24
Lower bound: 24
CONFIGURE UPPER_BOUND 26
Upper bound: 26

$ ./monitor
safe (temp 24)
warning (temp 23)
safe (temp 24)
safe (temp 25)
```

명령이 TCP 페이로드에 실려 가는지는 Wireshark로 확인한다. `127.0.0.1` 통신은 루프백 인터페이스(macOS `lo0`, 리눅스 `lo`)를 거치므로 그 인터페이스를 캡처하고 `tcp.port == 8080` 필터를 건다. `QUERY` 패킷의 페이로드는 `51 55 45 52 59 0a` 6바이트이고, `CONFIGURE UPPER_BOUND 30`은 24글자에 개행을 더해 25바이트다. Wireshark 사용법은 [Wireshark로 HTTP 트래픽과 TCP 핸드셰이크 분석하기](/memo/net-wireshark-http)에서 다룬다.

> [!WARNING] 평문 제어 프로토콜의 위험
> 이 프로토콜은 인증도 암호화도 없다. 같은 네트워크에서 캡처하면 명령이 그대로 보이고, 8080번 포트에 접속할 수 있는 누구나 `CONFIGURE`로 안전 범위를 바꿀 수 있다. 실제 IoT 기기라면 TLS로 채널을 암호화하고 클라이언트를 인증하며, 최소한 방화벽으로 접속 출발지를 제한한다. 방화벽 규칙은 [방화벽의 종류와 iptables 규칙](/memo/net-firewall)에서 다룬다.

## Winsock으로 메시지를 주고받는 클라이언트·서버

같은 코드를 Windows와 POSIX 양쪽에서 빌드하려면 두 API의 차이를 매크로로 흡수한다. Winsock의 소켓 형은 `SOCKET`, 생성 실패 값은 `INVALID_SOCKET`, 함수 실패 값은 `SOCKET_ERROR`, 닫기는 `closesocket(){:c}`, 오류 코드는 `WSAGetLastError(){:c}`다. 다음은 포트 1007에서 서버와 클라이언트가 메시지를 한 번씩 주고받는 프로그램이다.

```c
/* msg.h */
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
typedef int socklen_t;
#define CLOSESOCKET(s) closesocket(s)
#define SOCKERR() WSAGetLastError()
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <errno.h>
typedef int SOCKET;
#define INVALID_SOCKET (-1)
#define SOCKET_ERROR (-1)
#define CLOSESOCKET(s) close(s)
#define SOCKERR() errno
#endif
#include <stdio.h>
#include <string.h>

#define PORT 1007
#define BUFSIZE 1024

/* 한 줄을 읽어 끝의 개행을 삭제한다 */
static inline int read_line(const char *prompt, char *buf, int size)
{
	printf("%s", prompt);
	fflush(stdout);
	if (fgets(buf, size, stdin) == NULL)
		return -1;
	buf[strcspn(buf, "\r\n")] = '\0';
	return (int)strlen(buf);
}

/* 받은 바이트 수만큼만 문자열로 쓰도록 널 문자를 붙인다 */
static inline int recv_text(SOCKET s, char *buf, int size)
{
	int n = recv(s, buf, size - 1, 0);
	if (n < 0)
		return -1;
	buf[n] = '\0';
	return n;
}
```

`recv(){:c}`는 문자열 끝을 표시하지 않으므로, `recv_text(){:c}`가 받은 바이트 수 위치에 널 문자를 넣는다. 빠뜨리면 버퍼에 남은 이전 내용이 함께 출력된다. 크기보다 1 작게 받는 이유도 널 문자 자리를 남기기 위해서다.

```c
/* server.c */
#include "msg.h"

int main(void)
{
	SOCKET s, cs;
	struct sockaddr_in sin, cli_addr;
	socklen_t cli_size = sizeof(cli_addr);
	char buff[BUFSIZE];

#ifdef _WIN32
	WSADATA wsaData;
	if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
		return 1;
#endif
	s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (s == INVALID_SOCKET) {
		printf("소켓 생성 실패, 에러코드 : %d\n", SOCKERR());
		goto cleanup;
	}
	memset(&sin, 0, sizeof(sin));
	sin.sin_family = AF_INET;
	sin.sin_port = htons(PORT);
	sin.sin_addr.s_addr = htonl(INADDR_ANY);

	if (bind(s, (struct sockaddr *)&sin, sizeof(sin)) == SOCKET_ERROR
	    || listen(s, SOMAXCONN) == SOCKET_ERROR) {
		printf("bind/listen 실패, 에러코드 : %d\n", SOCKERR());
		goto close_listen;
	}
	printf("서버를 시작합니다\n");
	printf("클라이언트로부터의 접속을 기다리고 있습니다 ...\n");

	cs = accept(s, (struct sockaddr *)&cli_addr, &cli_size);
	if (cs == INVALID_SOCKET)
		goto close_listen;
	printf("클라이언트와 연결되었습니다.\n");

	if (read_line("[클라이언트에 보낼 메세지 입력] ", buff, sizeof(buff)) >= 0)
		send(cs, buff, (int)strlen(buff), 0);
	if (recv_text(cs, buff, sizeof(buff)) > 0)
		printf("client-to-server message \"%s\"\n", buff);

	CLOSESOCKET(cs);
close_listen:
	CLOSESOCKET(s);
cleanup:
#ifdef _WIN32
	WSACleanup();
#endif
	printf("서버를 종료합니다.\n");
	return 0;
}
```

클라이언트는 `bind(){:c}`/`listen(){:c}`/`accept(){:c}` 대신 `inet_pton(AF_INET, "127.0.0.1", &sin.sin_addr){:c}`로 주소를 채워 `connect(){:c}`하고, 같은 방식으로 자기 메시지를 먼저 보낸 뒤 `recv_text(){:c}`로 응답을 출력한다. 오류 경로는 `goto`로 해제 단계에 뛰어든다. 획득한 자원의 역순으로 해제 레이블을 배치하면 중첩 `if` 없이 모든 실패 경로가 같은 정리 코드를 지난다.

![Windows 명령 프롬프트 두 개에서 server.exe와 client.exe가 hello client와 hello server를 주고받는 실행 화면](./images/net-socket-programming-25.jpg '서버와 클라이언트가 각자 입력한 메시지를 상대 화면에 출력한다')

두 프로그램 모두 상대 메시지를 기다리기 전에 자기 메시지를 먼저 보낸다. 양쪽이 `recv(){:c}`부터 호출하면 서로 상대 데이터를 기다리며 영원히 블록되는 교착 상태가 생기므로, 주고받는 순서를 프로토콜로 정해야 한다.

## TCP 서버 디버깅

클라이언트를 만들기 전에도 텔넷 클라이언트로 TCP 서버를 시험할 수 있다. Windows에서는 PuTTY의 연결 유형을 Raw로, 호스트를 `localhost`, 포트를 8080으로 지정하면 입력한 줄이 그대로 전송된다. 유닉스 계열에서는 `nc`(netcat)가 같은 역할을 한다.

```bash
$ nc 127.0.0.1 8080
QUERY
temp 25, lower -5, upper 30
POLLING
safe (temp 26)
```

## 정리

이 글의 서버들은 정상적인 클라이언트를 가정했다. 연결 큐를 SYN으로 채우거나, 시퀀스 번호를 맞춰 RST를 끼워 넣거나, 평문 세션에 명령을 주입하는 공격은 소켓 API 아래의 TCP 상태를 노린다. 이 공격과 방어는 [TCP 프로토콜을 겨냥한 공격과 방어](/memo/net-tcp-attacks)에서 다룬다.

## 참고 문헌

- J. Postel, "Daytime Protocol," RFC 867, 1983. <https://www.rfc-editor.org/rfc/rfc867>
- J. Postel, "User Datagram Protocol," RFC 768, 1980. <https://www.rfc-editor.org/rfc/rfc768>
- J. Postel, "Transmission Control Protocol," RFC 793, 1981. <https://www.rfc-editor.org/rfc/rfc793>
- W. Eddy, Ed., "Transmission Control Protocol (TCP)," RFC 9293, 2022. <https://www.rfc-editor.org/rfc/rfc9293>
- J. Postel, "The TCP Maximum Segment Size and Related Topics," RFC 879, 1983. <https://www.rfc-editor.org/rfc/rfc879>
- R. Braden, Ed., "Requirements for Internet Hosts -- Communication Layers," RFC 1122, 1989. <https://www.rfc-editor.org/rfc/rfc1122>
- R. Gilligan et al., "Basic Socket Interface Extensions for IPv6," RFC 3493, 2003. <https://www.rfc-editor.org/rfc/rfc3493>
- The Open Group, "getaddrinfo," _The Open Group Base Specifications Issue 7_. <https://pubs.opengroup.org/onlinepubs/9699919799/functions/getaddrinfo.html>
- Linux man-pages, "listen(2)." <https://man7.org/linux/man-pages/man2/listen.2.html>
- Microsoft, "Getting Started with Winsock." <https://learn.microsoft.com/en-us/windows/win32/winsock/getting-started-with-winsock>
- NIST, "NIST Internet Time Servers." <https://tf.nist.gov/tf-cgi/servers.cgi>
- W. Richard Stevens, Bill Fenner, Andrew M. Rudoff, _UNIX Network Programming, Volume 1: The Sockets Networking API_, 3rd Ed., Addison-Wesley, 2003.
- Michael Kerrisk, _The Linux Programming Interface_, No Starch Press, 2010. <https://man7.org/tlpi/>
- Kevin R. Fall, W. Richard Stevens, _TCP/IP Illustrated, Volume 1: The Protocols_, 2nd Ed., Addison-Wesley, 2011.
