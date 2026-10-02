// import.meta.env는 이 파일에서만 읽는다.
// 값이 없으면 public/ 폴더의 에셋을 쓴다.
declare global {
	/** E2E 테스트가 가짜 API 주소를 넣는 자리 (빌드를 다시 하지 않고 로그인 흐름을 확인한다) */
	var __MACFOLIO_API_URL__: string | undefined;
	/** E2E 테스트가 메시지 저장소(local | server)를 고르는 자리 */
	var __MACFOLIO_MESSAGES_STORE__: string | undefined;
}

export const env = {
	/** MacFolio API (관리자 로그인). 비어 있으면 로그인 기능을 끈다 */
	apiUrl: (globalThis.__MACFOLIO_API_URL__ ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, ''),
	/**
	 * 메시지 앱의 저장소. local: 이 브라우저(localStorage)에만 저장한다 (개발·화면 확인용).
	 * 그 밖(비우거나 server): 서버에 저장하고, 서버에 닿지 못하면 앱을 열지 않는다 (배포 기본값)
	 */
	messagesStore: ((globalThis.__MACFOLIO_MESSAGES_STORE__ ?? import.meta.env.VITE_MESSAGES_STORE) === 'local'
		? 'local'
		: 'server') as 'local' | 'server',
	imageUrl: import.meta.env.VITE_APP_IMAGE_URL || '/imgs',
	musicUrl: import.meta.env.VITE_APP_MUSIC_URL || '/musics',
	sfxUrl: import.meta.env.VITE_APP_SFX_URL || '/sounds',
};
