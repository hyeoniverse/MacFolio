// 신문·잡지 모양 프로젝트 페이지의 한글 명조 (Noto Serif KR, 조각마다 unicode-range, 첫 화면 기준 약 440KB).
// 바탕화면은 Safari 창이 처음부터 열려 있어, 이 CSS를 정적으로 불러오면 모든 첫 방문자가 받는다.
// 그래서 Safari를 실제로 보는 시각(창을 누르거나 스크롤, 탭을 고름, 프로젝트 주소로 들어옴, 휴대폰에서 앱을 엶)에 한 번 불러온다.
// 그 전까지 제목의 한글은 --font-serif의 다음 글꼴인 Pretendard로 그린다 (styles/fonts.css). 라틴 명조는 처음부터 있다
let requested = false;

export function loadSerifKorean() {
	if (requested) return;
	requested = true;
	void import('@fontsource-variable/noto-serif-kr/wght.css');
}
