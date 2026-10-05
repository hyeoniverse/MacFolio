/**
 * 정적 파일에 없는 주소를 어떻게 답할지.
 * - 앱 주소(/memo/<글>, /safari/<프로젝트> 등)는 사이트 첫 화면(index.html)을 돌려준다. 앱이 시작할 때 주소를 읽는다
 * - 빌드 결과(/assets/…)나 확장자가 있는 파일 주소는 404. 배포로 이름이 바뀐 옛 코드 파일을 찾는 페이지에
 *   index.html을 200으로 주면, 브라우저는 "코드가 아니다"라는 엉뚱한 오류를 낸다
 */
export const isAppRoute = (pathname: string) => {
	if (pathname.startsWith('/assets/')) return false;
	const last = pathname.split('/').pop() ?? '';
	return !last.includes('.');
};
