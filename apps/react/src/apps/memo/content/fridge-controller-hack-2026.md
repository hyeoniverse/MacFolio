---
title: 인터넷에 노출된 냉장 컨트롤러와 기본 비밀번호로 본 IoT·OT 보안
date: 2026-11-21
category: 인사이트/보안
summary: 2026년 10월과 11월, 유럽 슈퍼마켓과 혈액원의 냉장 설비가 원격으로 제상 모드에 들어가 진열대 온도가 50°C 넘게 올랐다. 공격 대상이 된 냉장 컨트롤러가 무엇인지, 공격자가 어떤 경로로 들어갔는지, 2019년부터 나온 경고가 왜 막지 못했는지, CERT-FR 권고를 바탕으로 무엇을 점검해야 하는지 정리했다.
---

## 무슨 일이 있었나

2026년 10월 11일 밤, 프랑스 슈퍼마켓 최대 700곳의 냉장·냉동 설비가 한꺼번에 제상(defrost) 모드로 바뀌었다[^wiki]. 피해 매장에는 Intermarché와 Netto 300곳 이상, Coopérative U와 Carrefour 각각 80곳 안팎이 포함됐다. 6시간 뒤 많은 진열대의 온도가 50°C까지 올랐고, 노르망디의 한 매장에서는 80°C를 기록했다. 진열대에 있던 식품은 전부 폐기됐고, 일부 매장에서는 장비가 녹거나 불이 났다.

3주 뒤인 11월 2일과 3일에는 같은 방식의 공격이 벨기에, 스웨덴, 아일랜드, 에스토니아 등 유럽 최소 9개국으로 번졌다[^euronews][^aljazeera]. 이번에는 프랑스 혈액원(EFS) 3곳도 대상이 됐다. 공격자는 혈장을 보관하는 냉장고를 110°C로 올리려 했지만, 온도 감시 시스템이 경보를 울려 직원이 바로 개입했고 혈장은 지켜졌다[^wiki].

![2019년 경고부터 2026년 11월 귀속 발표까지의 사건 일지](./images/fridge-controller-hack-2026-timeline.svg '2019년 경고, 2025년 패치, 2026년 10월 1차 공격과 11월 2차 공격의 순서')

이 사건에서 눈여겨볼 점은 공격 방식이 매우 단순했다는 것이다. 악성 코드를 심거나 새로운 취약점을 찾지 않았다. 인터넷에 그대로 열려 있던 냉장 설비의 관리 화면에 들어가, 관리자가 평소에 쓰는 제상 기능을 실행했을 뿐이다. 영국 국가사이버보안센터(NCSC)의 Richard Horne은 프랑스의 냉장 설비가 "기본 비밀번호로 인터넷에 직접 연결되어 있었다"고 설명했다[^pbs].

- **공격 대상**: Danfoss AK-SM·AK-SC 시리즈, Copeland XWEB, Dixell XWEB 냉장 원격 컨트롤러[^certfr]
- **피해**: 식품 폐기, 장비 손상과 화재. 피해액은 보도마다 1,000만 유로 이상에서 수천만 유로까지 차이가 있다[^wiki]
- **침투 경로**: 공인 IP로 노출된 웹 관리 화면, 기본·약한 비밀번호, 지원이 끝난 구형 펌웨어[^aljazeera]
- **배후**: 프랑스 정부는 11월 9일 이란 혁명수비대와 연계된 조직을 지목했다. 민간 보안업체 중에는 러시아 쪽 흔적을 언급한 곳도 있어 논쟁이 이어지고 있다[^wiki][^euronews]

## 알아 둘 배경

### 냉장 컨트롤러는 OT 장비다

마트의 냉장 진열대 수십 대는 각각 따로 움직이지 않는다. 매장 한쪽에 있는 **냉장 컨트롤러**(refrigeration controller, 시스템 매니저라고도 부른다)가 진열대마다 달린 온도 센서 값을 모으고, 압축기·팬·히터를 켜고 끄며, 온도가 기준을 벗어나면 경보를 보낸다. Danfoss AK-SM800 같은 장비가 여기에 해당한다.

이런 장비를 **OT**(Operational Technology, 운영 기술)라고 부른다. 메일 서버나 회계 시스템처럼 데이터를 다루는 IT 장비와 달리, OT 장비는 모터·밸브·히터처럼 물리적인 설비를 직접 제어한다. 공장 설비, 수도 처리장 펌프, 건물 공조기, 엘리베이터가 모두 OT다. IT 장비가 공격당하면 데이터가 유출되거나 지워지지만, OT 장비가 공격당하면 물건이 상하고 기계가 망가지며 사람이 다칠 수 있다.

냉장 컨트롤러에는 대부분 **웹 관리 화면**이 들어 있다. 브라우저로 장비의 IP 주소에 접속하면 진열대별 온도 그래프, 경보 기록, 설정 메뉴가 나온다. 냉장 설비 업체는 이 화면으로 원격 점검을 하고, 매장 관리자는 퇴근 후에도 휴대폰으로 온도를 확인한다. 편리하게 쓰려고 이 화면을 인터넷에서 바로 열리게 해 둔 매장이 많았다.

### 제상(defrost)이란

냉동·냉장 진열대의 냉각기(증발기)에는 공기 중 수분이 얼어붙어 성에가 낀다. 성에가 두꺼워지면 찬 공기가 잘 나오지 않아 냉각 효율이 떨어진다. 그래서 냉장 설비는 정해진 시각마다 히터를 잠깐 켜거나 냉각을 멈춰 성에를 녹이는데, 이 동작이 **제상**이다. 보통 하루에 몇 번, 한 번에 수십 분 정도 돌고 다시 냉각으로 돌아간다.

![정상 제상은 짧게 온도가 오르고 다시 냉각으로 돌아가지만 공격 시에는 계속 올라가는 온도 곡선 도식](./images/fridge-controller-hack-2026-defrost.svg '정상 제상과 공격자가 건 제상의 비교. 실제 측정값이 아닌 도식이다')

제상은 장비가 원래 가진 정상 기능이다. 공격자는 이 기능을 진열대에 식품이 가득 찬 상태에서 실행하고, 끝나는 조건이나 목표 온도를 바꿔 히터가 계속 돌게 했다[^aljazeera]. 장비 입장에서는 관리자가 내린 명령과 구별할 수 없다. 백신 프로그램이나 침입 탐지 시스템이 잡아내기 어려운 이유다.

### Shodan과 인터넷 노출

**Shodan**은 웹 페이지 대신 인터넷에 연결된 장비를 찾는 검색 엔진이다. 전 세계의 공인 IP 주소에 차례로 접속해 어떤 포트가 열려 있고, 그 포트에서 어떤 장비가 응답하는지 기록한다. 예를 들어 웹 관리 화면의 제목이나 응답 헤더에 장비 모델명이 들어 있으면, 검색창에 모델명만 넣어도 그 장비가 설치된 IP 목록이 나온다. 보도에 따르면 이번 공격자도 Shodan으로 대상을 찾았다[^aljazeera].

IP 주소를 숨긴다고 안전해지지는 않는다는 뜻이다. 공인 IP로 열린 관리 화면은 누군가 주소를 알려 주지 않아도 며칠 안에 검색 엔진과 공격자의 스캐너에 잡힌다.

### 기본 비밀번호

장비는 공장에서 나올 때 모든 제품에 같은 초기 계정을 넣어 출고하는 경우가 많다. 설치 기사가 처음 로그인해 설정을 마치려면 계정이 하나는 있어야 하기 때문이다. 이 값은 보통 설명서에 그대로 적혀 있고, 설명서는 제조사 홈페이지에서 누구나 내려받을 수 있다. 설치 후에 비밀번호를 바꾸지 않으면, 같은 모델을 쓰는 모든 장비가 같은 열쇠로 열린다.

이번 사건에서 거론된 기본 계정은 출처마다 다르다. Euronews는 사용자 이름 "Supervisor"와 비밀번호 "12345" 같은 공장 기본값을 언급했고[^euronews], 위키백과는 사용자 이름 admin에 장비의 현재 날짜를 비밀번호로 쓰는 방식을 소개했다[^wiki]. 장비 모델마다 방식이 달랐을 가능성이 있다. 어느 쪽이든 공격자가 추측하거나 문서에서 찾을 수 있는 값이었다는 점은 같다.

### 지원 종료(EOL) 장비

제조사는 제품마다 보안 업데이트를 내주는 기간을 정해 두고, 그 기간이 끝나면 **지원 종료**(End of Life, EOL)를 선언한다. 지원이 끝난 장비에서 새 취약점이 발견되면 패치가 나오지 않는다. Danfoss는 AK-SC355를 2016년에, AK-SM800을 2021년 5월에 지원 종료했다[^wiki]. Danfoss는 공격받은 시스템 대부분이 더 이상 보안 업데이트를 받지 않는 구형 제품이었다고 밝혔다[^pbs].

냉장 설비는 한 번 설치하면 10년 넘게 쓰는 경우가 흔하다. 냉장 성능에 문제가 없으니 컨트롤러를 바꿀 이유가 없어 보이고, 그사이 소프트웨어 지원은 끝난다. 이번 사건의 장비 상당수가 이런 상태였다.

## 공격은 어떻게 이루어졌나

![검색, 접속, 로그인, 설정 변경, 물리 피해로 이어지는 공격 경로와 VPN 뒤에 둔 권고 구성 비교](./images/fridge-controller-hack-2026-attack-path.svg '위는 공격 경로, 아래는 노출된 구성과 CERT-FR이 권고한 구성의 비교')

공개된 자료를 종합하면 공격은 다섯 단계로 정리할 수 있다.

1. **검색**: Shodan 같은 검색 엔진으로 Danfoss·Copeland·Dixell 컨트롤러의 웹 관리 화면이 열린 IP를 찾는다
2. **접속**: 브라우저나 스크립트로 해당 IP의 관리 화면에 접속한다. VPN도 방화벽도 없어 로그인 화면이 바로 나온다
3. **로그인**: 기본 계정이나 약한 비밀번호로 들어간다. 패치하지 않은 장비는 이미 알려진 취약점으로 인증을 우회할 수도 있었다[^euronews]
4. **설정 변경**: 제상을 실행하고 종료 조건이나 목표 온도를 바꾼다
5. **물리 피해**: 냉각이 멈추고 히터가 계속 돌아 진열대 온도가 오른다

프랑스 사이버보안청(ANSSI)의 Vincent Strubel은 원인을 세 가지로 요약했다[^aljazeera]. 공용 인터넷에 직접 노출된 장비, 약하거나 기본값 그대로인 로그인, 지원이 끝난 구형 장비다. 셋 중 하나만 없었어도 공격은 훨씬 어려웠다. 보안 업체 Lupovis의 CEO Xavier Bellekens는 관리 화면을 VPN 뒤에 두었다면 위험이 거의 사라졌을 것이라고 말했다[^euronews]. 보안 업체 Darktrace의 Nicole Carignan은 AI가 쓰였다는 증거는 없고, 쓸 필요도 없는 기법이었다고 평가했다[^pbs].

1차와 2차 공격 사이에는 정찰 흔적도 있었다. Lupovis가 유럽에 설치한 허니팟(공격자를 유인해 행동을 기록하는 가짜 장비)에는 10월 20일부터 30일까지 냉장 시스템을 노린 접속 시도가 276건 이상 기록됐고, 10월 26일에 가장 많았다[^euronews]. 같은 기간 남미·아프리카·북미·아시아의 센서에는 이런 시도가 없었다. 무작위로 인터넷 전체를 훑는 자동화 도구보다는 유럽을 겨냥해 계획한 작전에 가깝다는 해석이 나온 이유다.

## 2019년에 이미 나온 경고

이 공격 방식은 새롭지 않다. 2019년 2월, 보안 연구 팀 Safety Detectives는 영국 업체 Resource Data Management(RDM)의 냉장 관리 시스템이 인터넷에 대량으로 노출되어 있다고 공개했다[^techcrunch][^securityweek]. 내용은 이번 사건과 거의 같다.

| 항목        | 2019년 RDM 사례                                  | 2026년 유럽 사건                     |
| ----------- | ------------------------------------------------ | ------------------------------------ |
| 대상        | 식당·병원·슈퍼마켓·제약사의 냉장 관리 시스템     | 슈퍼마켓·혈액원의 냉장 원격 컨트롤러 |
| 노출 방식   | 웹 관리 화면이 인터넷에 열려 있음 (HTTP 9000 등) | 웹 관리 화면이 공인 IP로 열려 있음   |
| 인증        | 제조사 문서에 적힌 기본 사용자 이름과 비밀번호   | 기본·약한 비밀번호, 알려진 취약점    |
| 가능했던 일 | 설정·경보 변경, 원격 제상                        | 원격 제상, 목표 온도 변경            |
| 결과        | 연구자의 공개 보고에 그침                        | 유럽 10여 개국 실제 피해             |

당시 SecurityWeek는 Shodan으로 7,400대 이상의 장비가 확인됐다고 전했다[^securityweek]. RDM은 "설명서에 설치 시 기본 비밀번호를 반드시 바꾸라고 명시했다"며, 비밀번호 변경은 설치 업체의 책임이라고 답했다[^techcrunch]. 비밀번호를 바꾸지 않아도 장비는 정상으로 동작했고, 바꾸라고 강제하는 장치는 없었다.

2025년 3월에는 보안 업체 Claroty가 Danfoss 컨트롤러의 취약점을 찾아 제조사가 권고를 발표했고, 그해 8월 AK-SM800A용 4.3.1 버전으로 패치가 나왔다[^wiki]. 경고와 패치는 모두 공격보다 먼저 있었다. 문제는 그 정보가 냉장 설비를 실제로 운영하는 매장까지 닿지 않았다는 점이다. 매장 입장에서 냉장 설비는 "업체가 알아서 관리하는 기계"였고, 업체 입장에서 비밀번호와 네트워크는 "매장이 관리할 일"이었다. 책임이 비어 있는 자리로 공격이 들어왔다.

## 무엇을 점검해야 하나

### CERT-FR 권고

프랑스 정부 침해사고대응팀(CERT-FR)은 1차 공격 다음 날인 10월 12일 경보 CERTFR-2026-ALE-012를 내고, 13일과 16일에 내용을 보강했다[^certfr]. 아직 침해되지 않은 장비에 대한 권고는 다음과 같다.

1. 해당 장비를 포함해 공인 IP를 가진 모든 장비의 인터넷 노출을 없앤다. 냉장 업체로 데이터를 보내는 연결을 끊기 전에 보험 계약 조건을 확인한다
2. 설정 전체를 점검한다. 특히 제상 시간대가 바뀌지 않았는지 본다
3. 원격 접속은 VPN이나 보호된 네트워크를 통해서만 다시 연다. 급하면 방화벽에서 업체 IP만 허용할 수 있지만 임시 조치일 뿐이다
4. 제조사 권고를 적용한다. 펌웨어를 갱신하고, Danfoss 장비는 보안 수준을 Strict로 설정하며, 기본 비밀번호가 바뀌었는지 확인한다

이미 침해된 장비는 위 조치에 더해 재부팅이나 공장 초기화 후 다시 설정해야 한다. 다만 CERT-FR은 공장 초기화만으로는 충분하지 않다고 덧붙였다. 인터넷에 노출된 상태로 두면 다시 침해당하기 때문이다. 특히 지원이 끝난 장비를 인터넷에 노출하는 것은 침해 가능성이 매우 높은 상태로 두는 것이라고 경고했다.

### 장비를 운영하는 쪽의 점검 항목

냉장 설비뿐 아니라 매장·사무실·건물에 있는 관리용 장비(CCTV 녹화기, 출입 통제기, 공조 컨트롤러, 무선 공유기, 프린터)에 똑같이 적용할 수 있다.

| 점검 항목          | 확인 방법                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| 인터넷 노출 여부   | 회사 공인 IP를 Shodan이나 Censys에서 검색해 관리 화면이 나오는지 본다    |
| 기본 비밀번호      | 설명서의 초기 계정으로 로그인되는지 직접 시도해 본다                     |
| 원격 접속 경로     | 업체가 어떤 방식(VPN, 원격 지원 도구, 포트 포워딩)으로 접속하는지 묻는다 |
| 펌웨어와 지원 기간 | 현재 펌웨어 버전과 제조사의 지원 종료 일정을 확인한다                    |
| 이상 탐지          | 온도·전력 같은 물리 값이 기준을 벗어나면 사람에게 경보가 가는지 확인한다 |

마지막 항목이 혈액원을 지켰다. 공격자는 장비 설정을 바꾸는 데 성공했지만, 별도의 온도 감시 시스템이 이상을 잡아 직원이 개입할 시간을 벌었다. 컨트롤러 하나가 뚫려도 다른 경로로 이상을 알아차릴 수 있게 하는 것, 즉 방어를 여러 겹으로 두는 심층 방어(defense in depth)의 예다.

### 제조사와 제도 쪽의 변화

기본 비밀번호 문제를 사용자 책임으로만 두지 않으려는 규제도 생기고 있다. 영국은 2024년부터 공통 기본 비밀번호를 넣은 소비자용 스마트 기기의 판매를 금지했고[^wiki], 미국 캘리포니아는 2020년부터 기기마다 다른 비밀번호를 넣거나 첫 사용 시 비밀번호를 새로 만들게 하도록 요구한다[^techcrunch]. 다만 이런 규정은 대부분 새로 파는 소비자 기기에 적용된다. 이미 설치된 업무용 장비, 특히 10년 넘게 쓰는 OT 장비에는 소급되지 않는다. 이번 사건의 장비가 바로 그 빈틈에 있었다.

## 정리

이번 사건은 새로운 해킹 기술 없이도 큰 물리적 피해를 낼 수 있다는 것을 보여 줬다. 공격자가 한 일은 검색 엔진으로 열린 관리 화면을 찾고, 기본 비밀번호로 들어가, 제상 버튼을 누른 것이다. 그 결과 유럽 10여 개국의 마트가 식품을 버렸고, 혈액원은 혈장을 잃을 뻔했다.

인터넷에 연결되는 장비가 늘어날수록 공격받을 수 있는 대상도 늘어난다. 냉장고, 보일러, 엘리베이터처럼 보안과 거리가 멀어 보이는 기계도 웹 관리 화면이 있고 인터넷에 연결되어 있다면 똑같이 공격 대상이다. 관리 화면을 인터넷에서 치우고, 기본 비밀번호를 바꾸고, 지원이 끝난 장비를 교체하는 일은 어렵지 않지만, 누가 할 일인지 정해 두지 않으면 아무도 하지 않는다.

## 관련 글

- [스니핑·스푸핑·서비스 거부 공격의 원리와 방화벽·IDS·IPS 대응](/memo/csintro-network-security): 방화벽과 침입 탐지 시스템의 역할
- [시스템 보안: 계정·접근 제어·권한·로그·취약점 관리](/memo/csintro-system-security): 계정 관리와 패치 관리의 기본
- [PHP 업로드 취약점 유출 사태로 본 AI 시대의 보안 유지보수](/memo/php-upload-vulnerability-ai-era): 패치가 나온 뒤에도 남는 유지보수 문제

<details>
<summary>참고 문헌</summary>

- CERT-FR, [CERTFR-2026-ALE-012: Incident de sécurité ciblant les contrôleurs à distance des installations de réfrigération](https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-012) (2026년 10월 12일 최초 발행, 16일 갱신)
- Wikipedia, [2026 European refrigerator hacks](https://en.wikipedia.org/wiki/2026_French_supermarket_refrigerator_hack) (2026년 11월 20일 판 기준)
- Euronews, [Hackers probed Europe's fridge systems weeks before cyberattacks](https://www.euronews.com/2026/11/07/hackers-probed-europes-fridge-systems-weeks-before-cyberattacks-who-did-it-and-what-could-) (2026년 11월 7일)
- PBS NewsHour (AP), [Here's what to know about another cyberattack on European supermarket fridges](https://www.pbs.org/newshour/world/heres-what-to-know-about-another-cyberattack-on-european-supermarket-fridges) (2026년 11월 3일)
- Al Jazeera, [If hackers can take over a supermarket fridge, what else is at risk?](https://www.aljazeera.com/news/2026/11/11/if-hackers-can-take-over-a-supermarket-fridge-what-else-is-at-risk) (2026년 11월 11일)
- TechCrunch, [Internet-connected industrial refrigerators can be remotely defrosted, thanks to default passwords](https://techcrunch.com/2019/02/08/industrial-refrigerators-defrost-flaw/) (2019년 2월 8일)
- SecurityWeek, [Refrigeration Systems Used in Supermarkets, Hospitals Left Exposed Online](https://www.securityweek.com/refrigeration-systems-used-supermarkets-hospitals-left-exposed-online/) (2019년 2월 8일)

</details>

[^wiki]: [Wikipedia: 2026 European refrigerator hacks](https://en.wikipedia.org/wiki/2026_French_supermarket_refrigerator_hack). 매장 수는 리드 문장의 "최대 700곳" 기준이다. 피해액은 정보 상자에 1,000만 유로 이상, 본문에 수천만 유로로 적혀 있다.

[^euronews]: [Euronews, 2026년 11월 7일](https://www.euronews.com/2026/11/07/hackers-probed-europes-fridge-systems-weeks-before-cyberattacks-who-did-it-and-what-could-). 2차 공격 국가 목록은 매체마다 조금씩 다르다.

[^aljazeera]: [Al Jazeera, 2026년 11월 11일](https://www.aljazeera.com/news/2026/11/11/if-hackers-can-take-over-a-supermarket-fridge-what-else-is-at-risk). ANSSI Vincent Strubel의 프랑스 상원 발언(10월 21일)을 인용했다.

[^pbs]: [PBS NewsHour (AP), 2026년 11월 3일](https://www.pbs.org/newshour/world/heres-what-to-know-about-another-cyberattack-on-european-supermarket-fridges)

[^certfr]: [CERT-FR CERTFR-2026-ALE-012](https://cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-012). 제조사가 위험도를 밝히지 않았다고 적었고, CVE 번호는 나열하지 않았다.

[^techcrunch]: [TechCrunch, 2019년 2월 8일](https://techcrunch.com/2019/02/08/industrial-refrigerators-defrost-flaw/)

[^securityweek]: [SecurityWeek, 2019년 2월 8일](https://www.securityweek.com/refrigeration-systems-used-supermarkets-hospitals-left-exposed-online/)

#보안 #IoT #OT보안 #기본비밀번호
