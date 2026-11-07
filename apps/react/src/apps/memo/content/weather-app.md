---
title: Open-Meteo 지오코딩 지연을 내장 도시 목록 우선 검색으로 줄이기
date: 2026-10-10
category: 개발 기록/MacFolio/구조·상태 관리
summary: macOS·iOS 날씨 앱 모양의 날씨 앱을 추가했다. 데이터는 키 없이 쓰는 Open-Meteo에서 브라우저가 직접 조회하고, 한국어 이름을 찾지 못하고 응답에 1~10초 걸리는 지오코딩 대신 내장 도시 211곳을 먼저 검색한다.
---

macOS의 날씨 앱과 같은 모양의 **날씨** 앱을 추가했다. Launchpad와 휴대폰 홈 화면에서 열 수 있고, Dock에는 고정하지 않는다. 2026년 10월 10일 첫 커밋(`1acec758b`) 이후 같은 날 화면 다듬기(`eb038a30b`)와 iOS Safari 밀어서 삭제 수정(`d5f9f6741`), 이튿날 검색 속도 개선(`2536320be`)이 이어졌다.

날씨 앱이 하는 일은 두 가지다. 사용자가 입력한 도시 이름을 위도·경도 좌표로 바꾸고(지오코딩[^geocoding]), 그 좌표의 일기예보를 조회해 화면에 표시한다. 예를 들어 '도쿄'를 검색하면 먼저 `35.69, 139.69` 같은 좌표를 얻고, 그 좌표로 현재 기온과 10일 예보를 요청한다. 문제는 첫 단계에서 생겼다. Open-Meteo 지오코딩은 한국어 이름을 찾지 못하고 응답도 느렸고, 자주 검색하는 도시의 좌표를 코드에 내장해 먼저 검색하는 방식으로 해결했다.

## 데이터: Open-Meteo

[Open-Meteo](https://open-meteo.com/)는 API 키 없이 쓰는 공개 날씨 API다(데이터 라이선스 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). API 키는 서비스가 호출자를 식별하고 호출 횟수를 제한하려고 발급하는 문자열이다. 키를 웹 페이지 코드에 넣으면 방문자 누구나 개발자 도구로 읽을 수 있으므로, 키가 필요한 API는 보통 서버가 키를 보관하고 대신 호출한다. Open-Meteo는 키가 없으므로 사이트의 API 서버를 거치지 않고 브라우저가 직접 호출한다.

- [일기예보](https://open-meteo.com/en/docs) `api.open-meteo.com/v1/forecast`: 현재 날씨, 시간별(이틀), 일별(10일)을 요청 한 번으로 조회한다. `timezone=auto`면 시각이 그 장소의 시간대로 오고, `wind_speed_unit=ms`면 풍속이 m/s 단위로 온다.
- [지오코딩](https://open-meteo.com/en/docs/geocoding-api) `geocoding-api.open-meteo.com/v1/search`: 이름으로 장소를 검색해 좌표, 국가, 행정 구역, 인구를 응답한다.

다른 데이터 출처와 비교한 결과는 다음과 같다.

| 데이터                       | 키        | 브라우저에서 바로 | 버린 이유 / 고른 이유                                            |
| ---------------------------- | --------- | ----------------- | ---------------------------------------------------------------- |
| 기상청 공공데이터 API        | 필요      | 불가              | 키를 숨기려면 서버를 거쳐야 한다. 해외 도시가 없다               |
| OpenWeatherMap 같은 상용 API | 필요      | 불가              | 키를 숨기려면 서버를 거쳐야 하고, 무료 호출 한도를 관리해야 한다 |
| Open-Meteo                   | 필요 없음 | 가능              | 서버 코드가 필요 없다. 출처(CC BY 4.0)만 표시한다                |

![키가 필요한 API는 사이트 API 서버가 중계해야 하고, Open-Meteo는 브라우저가 두 주소로 직접 요청하는 구조 비교](./images/weather-app-direct-call.svg '두 경로의 비교. Open-Meteo는 중계 서버 없이 브라우저가 바로 요청한다')

==공개된 날씨 정보를 표시하기 위해 API 서버에 중계 코드를 추가하지 않는 것==이 목표였다. API 서버 없이 정적 사이트만 실행한 경우(`pnpm dev`)에도 날씨 앱은 동작해야 한다. 키가 필요 없는 Open-Meteo는 이 조건을 만족한다.

사이트의 CSP[^csp]는 [`connect-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)에 등록된 주소로만 `fetch` 요청을 허용한다. 그래서 두 주소를 `worker/securityHeaders.ts`에 추가하고, 보안 헤더 시험에도 추가했다. 화면 맨 아래에는 데이터 출처를 표시한다.

서울의 일기예보 요청은 다음과 같다(`weatherApi.ts`의 `fetchForecast`가 만드는 주소를 읽기 쉽게 줄을 나누고 일부 필드를 `…`로 줄였다). 응답의 `weather_code`는 WMO 날씨 코드[^wmo]로, 화면의 아이콘과 하늘 색을 정하는 데 쓴다.

```text
GET https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978
    &current=temperature_2m,relative_humidity_2m,…,weather_code,…
    &hourly=temperature_2m,weather_code,precipitation_probability,is_day
    &daily=weather_code,temperature_2m_max,temperature_2m_min,…,wind_gusts_10m_max
    &timezone=auto&forecast_days=10&wind_speed_unit=ms
```

## 한국어 이름 검색

먼저 지오코딩 API를 직접 호출해 결과를 확인했다.

| 검색어  | 결과                                            |
| ------- | ----------------------------------------------- |
| `서울`  | 없음                                            |
| `부산`  | 경상북도 의성군의 마을 'Pusan'이 먼저           |
| `Busan` | 부산광역시 (행정 중심지, 인구 3,285,147)가 먼저 |
| `Tokyo` | 도쿄 (수도)가 먼저, 그다음 파푸아뉴기니의 Tokyo |

==한국어로 검색하면 결과가 없거나 엉뚱한 장소가 먼저 나온다.== 그래서 자주 검색할 도시 39곳(국내 17, 해외 22)을 한국어 이름과 영어 별칭과 함께 코드에 내장했다(`places.ts`의 `CITIES`). 검색 순서는 다음과 같다.

1. 내장 도시: 한국어·영어 이름에 검색어가 포함되면 즉시 표시한다 (`주` → 광주, 청주, 전주, 제주).
2. Open-Meteo: 입력이 0.3초 멈춘 뒤 호출하고(디바운스[^debounce]), 결과를 수도(`PPLC`) → 행정 중심지(`PPLA`) → 인구 순으로 재정렬한다[^pplc].
3. 같은 장소(약 1km 이내)는 한 번만, 최대 8개까지 표시한다.

## 검색이 느린 문제

실제로 사용해 보니 장소 검색 응답이 느렸다. 측정해 보니 Open-Meteo 지오코딩 응답 시간이 요청당 **1~10초**였다(같은 검색어도 요청마다 달랐고, 일기예보 API는 1초 남짓). 옵션(`language`, `count`)을 바꿔도 같았다. 여기에 입력이 멈출 때마다 0.3초 뒤 다시 요청했고, 한글은 조합 중인 글자마다 요청을 보냈다.

한글 입력은 IME(입력기)가 자모를 모아 한 글자로 조합하는 과정을 거친다. 조합하는 동안에도 입력 칸의 값은 바뀌고 입력 이벤트가 발생하므로, 이벤트마다 검색하면 '농', '노워'처럼 사용자가 의도하지 않은 중간 값으로도 요청한다. 브라우저는 이 상태를 [`compositionstart`](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event)·[`compositionend`](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event) 이벤트와 [`InputEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/isComposing) 속성으로 알려 준다.

![노원을 입력하는 동안 입력 칸 값이 ㄴ, 노, 농, 노워, 노원으로 바뀌고 isComposing이 참인 동안의 요청을 수정 전후로 비교](./images/weather-app-ime.svg '조합 중인 값과 요청 시점. 수정 후에는 조합이 끝난 값으로만 Open-Meteo에 요청한다')

외부 서버의 응답 시간은 개선할 수 없으므로 ==대기가 필요한 경우를 줄였다==(`2536320be`).

| 변경                             | 내용                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 내장 도시를 39곳에서 211곳으로   | 국내 시·군과 서울의 구 25개, 해외 주요 도시를 넣었다. 지오코딩은 '노원구'·'강남구' 같은 구 이름을 찾지 못하고 '성남'은 같은 이름의 마을을 먼저 반환해서, 국내 좌표는 직접 입력했다(도시는 중심, 구는 구청 근처. 날씨 격자 간격이 수 km라 이 정도 오차는 결과에 영향이 없다). 대부분의 검색은 이제 입력 즉시 결과가 나온다 |
| 정렬 순서                        | 이름이 검색어로 시작하는 장소 → 이름에 검색어가 포함된 장소 → 지역 이름에 포함된 장소. '서울'을 입력하면 서울 다음에 서울특별시의 구 25개가 나온다                                                                                                                                                                        |
| Open-Meteo는 후순위로 호출       | 두 글자 이상 입력 후 0.25초(`SEARCH_DELAY_MS = 250`) 멈추면 요청하고, 응답을 기다리는 동안 목록 아래에 '더 찾는 중…'을 표시한다. 내장 결과는 그동안에도 그대로 보인다                                                                                                                                                     |
| 한글 조합 중에는 요청하지 않음   | 조합이 끝나면 요청한다. 조합 종료 이벤트(`compositionend`)를 보내지 않는 키보드도 있어서 입력 이벤트마다 `isComposing`으로 조합 상태를 다시 확인한다                                                                                                                                                                      |
| 같은 검색어는 다시 요청하지 않음 | 응답을 메모리에 캐시해, 다른 검색어를 입력했다가 돌아와도 즉시 표시한다                                                                                                                                                                                                                                                   |
| 8초 뒤 요청 중단                 | 8초(`SEARCH_TIMEOUT_MS = 8000`)가 지나면 [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)로 요청을 중단한다. 결과가 하나도 없으면 '결과 없음'을 표시한다                                                                                                                             |

내장 도시 검색 코드는 짧다. 이름이 검색어로 시작하면 0, 포함하면 1, 지역 이름에 포함하면 2로 순위를 매기고, 같은 순위는 목록 순서(큰 도시 먼저)를 따른다.

```ts
// apps/react/src/apps/weather/places.ts
const rank = (city: (typeof CITIES)[number]) => {
	const names = [city.name.toLowerCase(), ...city.aliases];
	if (names.some((name) => name.startsWith(q))) return 0;
	if (names.some((name) => name.includes(q))) return 1;
	if (city.region.includes(q)) return 2;
	return null;
};
```

예를 들어 '중'을 입력하면 이름이 '중'으로 시작하는 중구·중랑구가 순위 0, 지역 이름이 '중국'인 베이징·상하이 같은 도시가 순위 2가 된다. '서울특별시'를 입력하면 지역 이름이 일치하는 서울의 구 25개가 순위 2로 표시된다.

![글자를 치면 내장 도시를 바로 보여 주고, 조건이 맞을 때만 Open-Meteo에 묻는 흐름](./images/weather-app-search-flow.svg '장소 찾기 흐름')

### 같은 장소로 판정하는 거리

내장 결과와 Open-Meteo 결과에는 같은 도시가 중복으로 들어올 수 있다. 그래서 두 장소의 위도 차와 경도 차가 모두 기준보다 작으면 같은 장소로 판정해 한 번만 표시한다. 위도 1도는 약 111km이고, 서울 위도에서 경도 1도는 약 88km다. 처음 기준 0.01도는 약 1km에 해당한다.

> [!WARNING] 기준이 넓으면 가까운 다른 장소가 빠진다
> 목록을 확장한 뒤 '서울'을 검색하니 종로구가 결과에서 빠져 있었다. 서울(시청)과 종로구(구청)가 약 0.78km 떨어져 있어 1km 기준 안에 들어갔기 때문이다. 기준을 약 500m(위도·경도 차 0.005도)로 좁히고 이 경우를 시험에 추가했다.

![서울 시청 좌표를 중심으로 0.01도와 0.005도 판정 범위를 그리고, 종로구 구청 좌표가 0.01도 범위 안, 0.005도 범위 밖에 있는 모습](./images/weather-app-same-place.svg '판정 범위와 두 좌표. 위도 차 0.007도가 두 기준 사이에 있다')

```ts
/** 두 장소가 같은 곳인지 (약 500m 안). 1km로 두었더니 서울(시청)과 종로구(구청)가 같은 곳이 되어 종로구가 찾기에서 빠졌다 */
export const samePlace = (a: Place, b: Place) =>
	Math.abs(a.latitude - b.latitude) < 0.005 && Math.abs(a.longitude - b.longitude) < 0.005;
```

## 화면

- **왼쪽:** 장소 카드. 카드마다 그 장소의 하늘 색, 이름, 현지 시각, 날씨, 기온, 최고·최저 기온을 표시한다. 마우스를 올리면 나타나는 ×로 삭제한다(마지막 하나는 삭제할 수 없다).
- **오른쪽:** 선택한 장소의 하늘 색 배경 위에 이름, 큰 기온, 날씨, 최고·최저 기온.
  - 시간별 일기예보: 현재부터 24칸, 강수 확률은 30% 이상인 칸에만 표시한다.
  - 10일간의 일기예보: 10일 동안의 최저·최고 기온을 눈금 범위로 삼아 날마다 기온 범위 막대를 렌더링하고, 오늘 막대에는 현재 기온 점을 표시한다.
  - 상세 칸: 체감 온도, 습도, 바람(방향), 자외선 지수(기상청 단계), 일출·일몰, 강수량.

하늘 색은 WMO 날씨 코드를 맑음·구름 조금·흐림·안개·이슬비·비·눈·뇌우 여덟 가지로 분류하고, 낮·밤으로 나눠 정한다. 예를 들어 코드 0은 맑음, 61~65는 비, 95는 뇌우로 분류한다. macOS 날씨 앱도 화면 모드와 상관없이 하늘 색을 쓰므로 다크 모드에서도 색이 같다.

추가한 장소 목록은 브라우저의 localStorage에 저장한다. 기본값은 서울 하나다. 휴지통의 '내 브라우저 데이터'에도 '날씨 장소'로 표시되어 삭제할 수 있다(휴지통 시험이 코드가 사용하는 저장 키를 모두 등록했는지 검사하므로, 누락하면 시험이 실패한다).

> [!NOTE] 현재 위치 기능을 넣지 않은 이유
> 현재 위치 기능은 구현하지 않았다. 사이트의 [`Permissions-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy)가 위치 권한을 차단하고 있고, 위치 권한을 요청하기보다 방문자가 도시를 검색해 추가하는 방식이 개인정보 수집을 줄인다.

![데스크톱 날씨 창: 왼쪽에 서울·도쿄·제주 카드, 오른쪽에 큰 기온과 시간별·10일 일기예보, 상세 칸](./images/weather-app-desktop.jpg '맥의 날씨 창 (Open-Meteo 응답은 시험용 가짜 데이터)')

## 실제 앱과 비교해 다시 조정하기

첫 화면을 실제 macOS·iOS 날씨 앱 스크린샷과 나란히 비교해, 다른 부분을 다음과 같이 수정했다(`eb038a30b`, `d5f9f6741`).

### 맥 (넓은 창)

- 하늘 색 배경이 창 전체를 채우고, 사이드바는 그 위에 떠 있는 둥근 반투명 패널이다. 사이드바 오른쪽 위의 버튼으로 접고, 접으면 신호등 옆에 버튼이 나타난다.
- 장소는 카드를 오른쪽 클릭해 '삭제'로 삭제한다(마우스를 올리면 보이던 ×는 제거했다).
- 장소 이름 위에 지역 이름(대한민국)을 작은 글자로 추가하고 글자 크기를 줄였다.
- 시간별 일기예보 아래는 2단 배치다. 왼쪽은 10일 일기예보, 오른쪽은 상세 칸이다.
- 밤에는 남색 하늘에 별을 배치하고, 칸 배경을 어둡고 투명하게 한다.

> [!WARNING] `backdrop-filter`가 만든 쌓임 맥락
> 사이드바에 블러([`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter))를 적용하자 그 안의 사이드바 버튼이 클릭되지 않았다. `backdrop-filter`가 새 [쌓임 맥락(stacking context)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)을 만들어서, 버튼의 z-index를 올려도 창 상단의 끌기 영역(z-index 3) 아래에 놓였다. 사이드바 전체의 z-index를 올리면 이번에는 사이드바가 신호등 버튼을 덮는다. 그래서 사이드바 상자는 클릭을 통과시키고([`pointer-events: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)) 내부 요소만 클릭을 받게 했다. 신호등 클릭 시험을 추가해 이 문제를 검출했다. 같은 원리의 문제는 [position sticky가 만든 쌓임 맥락에 갇힌 z-index](/memo/sticky-stacking-context)에 자세히 정리했다.

쌓임 맥락은 z-index 비교가 이루어지는 범위다. 어떤 요소가 쌓임 맥락을 만들면, 그 안의 자식은 z-index를 아무리 크게 지정해도 부모 요소의 층 안에서만 순서가 정해진다. 위 경우 사이드바 버튼에 z-index 100을 지정해도, 버튼이 속한 사이드바 전체가 끌기 영역(3)보다 아래 층이면 버튼도 아래에 그려진다.

### 아이폰 (좁은 창)

- 홈으로 가는 버튼을 제거했다(iOS 날씨처럼 홈 바 제스처로 나간다).
- 하단에 떠 있는 막대: 가운데 장소 점, 오른쪽 목록 버튼. 화면을 가로로 밀면 이전·다음 장소로 이동한다(가로 스크롤하는 시간별 칸은 제외). 장소가 하나면 이동할 대상이 없으므로 점 막대를 렌더링하지 않는다(수정 전에는 점 하나만 있는 막대가 표시되어, 눌러도 동작이 없는 요소가 되었다).
- 시간별 일기예보 위에 요약 문장: 날씨가 처음 바뀌는 시각과 오늘 돌풍의 최대 풍속(예: '오전 12시쯤 구름 조금 상태가 예상됩니다. 돌풍의 풍속은 최대 3m/s입니다.'). 돌풍은 Open-Meteo의 `wind_gusts_10m_max` 값을 쓴다.
- 목록 화면: 큰 '날씨' 제목, ••• 메뉴(목록 편집, °C 섭씨, °F 화씨), 카드의 '시각 • 지역' 표기, 하단에 떠 있는 알약 모양 검색 칸, 맨 아래 데이터 출처.
- 아이콘에 색을 적용했다. 해는 노랑, 비는 하늘색이다.
- 팝업(••• 메뉴, 카드의 오른쪽 클릭 메뉴)은 사이트 공통 메뉴의 흰 배경이 어두운 하늘 배경과 대비가 지나치게 커서, 날씨 앱에서만 어두운 반투명 배경으로 바꿨다. ••• 메뉴는 iOS처럼 크고 둥글게, 오른쪽 클릭 메뉴는 휴지통 아이콘과 '삭제'만 있는 작은 알약 모양으로 만들었다.

#### 카드를 밀어 삭제하기

카드를 왼쪽으로 밀면 빨간 휴지통 버튼이 나타난다. 목록 편집 상태에서는 모든 카드에 항상 표시된다. 구현은 [포인터 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)로 했다. 포인터 이벤트는 마우스·터치·펜 입력을 `pointerdown`(누름) → `pointermove`(이동) → `pointerup`(뗌) 하나의 순서로 통일해 전달한다.

1. 마우스로 밀면 버튼을 놓는 순간 `click` 이벤트가 이어져 방금 연 카드를 다시 닫았다. 밀기 직후의 `click`은 무시하게 했다.
2. 그래도 실제 iPhone에서는 카드가 열리지 않았다. iOS Safari는 미는 손가락이 세로로 조금만 흔들려도 스크롤로 판단해 [`pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)을 보내는데, 코드가 이 이벤트를 '닫기'(`setOffset(0)`)로 처리하고 있었다.
3. 수정 후에는 `pointercancel`에서도 민 거리로 열기·닫기를 결정하고, 가로로 밀기 시작하면 카드가 포인터를 점유하며([`setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)), 목록에는 세로 스크롤만 브라우저가 처리하도록 [`touch-action: pan-y`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)를 지정한다. 시험도 마우스가 아니라 세로로 흔들리는 실제 터치 이벤트로 카드를 민다.

![카드 밀어 삭제의 포인터 이벤트 처리. pointercancel을 닫기로 처리하던 수정 전과, 민 거리 42px 기준으로 열기·닫기를 정하는 수정 후 비교](./images/weather-app-swipe.svg '카드 밀어 삭제: pointercancel 처리 전후 (components/PlaceCard.tsx)')

### 기온 단위

화씨를 선택하면 Open-Meteo에 `temperature_unit=fahrenheit`로 다시 요청한다(화면에서 변환 계산하지 않는다). 선택한 단위는 브라우저에 저장되고, 휴지통의 '날씨 장소'에서 장소와 함께 삭제할 수 있다. 맥 화면에서는 메뉴 막대의 보기 메뉴에 있다.

![아이폰 크기의 날씨: 큰 기온, 시간별 위의 요약 문장, 10일 일기예보, 아래의 장소 점과 목록 버튼](./images/weather-app-phone.jpg '휴대폰의 날씨 (iOS 모양, 가짜 데이터)')

## 좁은 창과 휴대폰

창 폭이 640px보다 좁으면([컨테이너 쿼리](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)) 위의 아이폰 모양으로 바뀐다. 컨테이너 쿼리는 화면 전체 폭이 아니라 특정 부모 요소의 폭을 조건으로 스타일을 바꾸는 CSS 기능이다. 기준이 창 폭이므로 맥에서 창을 좁혀도 같은 모양이 된다. '오후 12시'가 잘리던 시간별 칸은 글자 너비만큼 넓어지게 했다.

## 시험

시험 코드는 `forecast.test.ts`(126줄), `places.test.ts`(86줄)와 `e2e/weather.spec.ts`에 있다. E2E에서는 Open-Meteo 응답을 Playwright의 [`page.route`](https://playwright.dev/docs/network)로 가짜 응답으로 대체한다(`e2e/fakeWeather.ts`). 실제 API를 호출하면 응답에 1~10초씩 걸리고 날씨가 매일 달라 시험 결과가 일정하지 않다.

<details>
<summary>시험 항목 전체</summary>

- 단위: 내장 도시 검색(구까지, 한국어·영어, 시작하는 장소 먼저, 지역 이름으로도), WMO 코드 → 한국어·아이콘(낮·밤), 시각·바람 방향, 자외선 단계, 현재부터 24시간·오늘부터 10일, 장소 검색(내장 도시, 큰 도시 먼저, 같은 장소 한 번), 저장(손상된 값이면 서울)
- E2E (Open-Meteo는 가짜 응답): Open-Meteo가 느려도(1.5초) 내장 도시는 바로, 기다리는 동안 '더 찾는 중', 같은 말은 다시 묻지 않음, '결과 없음' / 시간별 위 문장과 돌풍 / 화씨로 바꾸면 다시 묻고 남음 / 오른쪽 클릭 삭제 / 사이드바 접고 펴기, 신호등은 그대로 눌림 / 휴대폰: 홈 버튼 없음, 점으로 넘기기, 옆으로 밀어 넘기기, 목록 편집으로 지우기, 카드 밀어 휴지통, 화씨 / 서울의 지금 날씨·시간별 24칸·10일·상세 칸·출처 / 한국어로 찾아 더하고 다시 열어도 남음 / 영어로 찾으면 수도가 먼저, 이미 있는 곳은 더하지 않음 / 지우기와 마지막 하나 / 불러오지 못하면 다시 시도 / 휴대폰에서 목록 열고 골라 돌아오기

</details>

## 크기

날씨 앱은 같은 날 세 커밋으로 추가되었다(첫 앱, 실제 앱 모양으로 조정, iOS Safari 밀어서 삭제 수정). 그 시각 `apps/react/src/apps/weather/` 폴더는 8개 파일 2,497줄이었다. 이후 `Weather.tsx`는 훅 3개와 장소 카드·상세 칸 컴포넌트를 분리해 682줄에서 324줄로 줄었다([#300](https://github.com/hyeoniverse/MacFolio/pull/300)).

| 파일            | 줄  | 하는 일                               |
| --------------- | --- | ------------------------------------- |
| `Weather.css`   | 958 | 하늘 색, 데스크톱·iOS 두 모양         |
| `Weather.tsx`   | 680 | 화면 전체                             |
| `forecast.ts`   | 261 | WMO 코드, 시간별 24칸·10일, 요약 문장 |
| `cities.ts`     | 218 | 내장 도시 211곳                       |
| `places.ts`     | 105 | 검색·병합·저장                        |
| `weatherApi.ts` | 63  | Open-Meteo 두 주소                    |

## 남은 과제와 정리

- 현재 위치 기능은 구현하지 않았다. 사이트의 `Permissions-Policy`가 `geolocation=()`으로 위치 권한을 차단하고 있고, 날씨 앱 하나를 위해 이 정책을 완화하지 않았다.
- 내장 도시 좌표는 수동으로 입력한 값이다. 국내 시·군은 모두 넣었지만 해외는 주요 도시뿐이라, 그 밖의 장소는 응답이 느린 Open-Meteo 검색에 의존한다.
- 외부 API의 응답 시간은 개선할 수 없다. 대신 내장 데이터로 즉시 결과를 표시하고 외부 응답은 도착하는 대로 추가하면, 대부분의 검색에서 대기 시간이 사라진다.
- 실제 기기(iOS Safari)의 터치 입력은 시험 브라우저의 마우스 입력과 다르다. 손가락이 세로로 조금만 흔들려도 `pointercancel`이 발생한다. 시험도 이 터치 동작을 재현해야 한다.
- 창 폭 641~767px에서 레이아웃이 어긋난 문제는 이후 별도로 수정했다([useIsMobile과 ResizeObserver로 정하는 data-compact 레이아웃 기준](/memo/weather-layout-fixes)).

## 관련 글

- 날씨 앱의 레이아웃 문제 세 가지를 수정한 일: [useIsMobile과 ResizeObserver로 정하는 data-compact 레이아웃 기준](/memo/weather-layout-fixes)
- 휴대폰 앱을 iOS 모양으로 맞춘 일: [휴대폰 앱들을 메모처럼 - 함께 쓰는 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style)
- 쌓임 맥락 때문에 버튼이 클릭되지 않던 일: [position sticky가 만든 쌓임 맥락에 갇힌 z-index](/memo/sticky-stacking-context)
- Weather.tsx 분리 PR: [#300](https://github.com/hyeoniverse/MacFolio/pull/300)

[^geocoding]: 장소 이름을 위도·경도 좌표로 변환하는 일. 반대로 좌표를 주소로 바꾸는 일은 역지오코딩(reverse geocoding)이라고 한다.

[^csp]: Content Security Policy. 페이지가 어느 출처의 스크립트를 실행하고 어느 주소에 요청할 수 있는지 서버가 응답 헤더로 지정하는 브라우저 보안 규칙이다. 목록에 없는 주소로의 요청은 브라우저가 차단한다.

[^debounce]: 연속으로 발생하는 이벤트를 모아, 마지막 이벤트 뒤 일정 시간 동안 새 이벤트가 없으면 한 번만 처리하는 기법. 입력 칸에서는 글자를 입력할 때마다가 아니라 입력이 멈춘 뒤에만 요청을 보낸다.

[^pplc]: `PPLC`, `PPLA`는 Open-Meteo 지오코딩이 사용하는 [GeoNames 지형 코드](https://www.geonames.org/export/codes.html)다. `PPLC`는 수도, `PPLA`는 1차 행정 구역의 중심지를 뜻한다.

[^wmo]: 세계기상기구(WMO)가 정한 현재 날씨 코드. Open-Meteo는 `weather_code` 필드에 0(맑음)~99(우박을 동반한 뇌우) 범위의 값으로 반환한다.

<details>
<summary>참고 문헌</summary>

- Open-Meteo, [Weather Forecast API](https://open-meteo.com/en/docs), [Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- GeoNames, [Feature Codes](https://www.geonames.org/export/codes.html)
- MDN, [CSP: connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)
- MDN, [CompositionEvent](https://developer.mozilla.org/en-US/docs/Web/API/CompositionEvent), [InputEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/isComposing)
- MDN, [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- MDN, [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)
- MDN, [Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)

</details>

#MacFolio #프론트엔드 #날씨 #macOS
