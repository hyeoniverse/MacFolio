/**
 * 지연 로딩 앱의 코드를 못 불러왔는지. 주로 배포로 파일 이름이 바뀌어, 열려 있던 페이지가 옛 파일을 찾을 때다.
 * 브라우저마다 문구가 다르다: Chrome 'Failed to fetch dynamically imported module',
 * Safari 'Importing a module script failed', Firefox 'error loading dynamically imported module'.
 * 브라우저는 실패한 모듈 주소를 기억해서 다시 import해도 다시 받지 않으므로(Chrome), 고치려면 새로고침해야 한다.
 */
export const isChunkLoadError = (error: unknown) =>
	error instanceof Error &&
	/dynamically imported module|importing a module script failed|unable to preload css/i.test(error.message);
