// import.meta.env는 이 파일에서만 읽는다.
// 값이 없으면 public/ 폴더의 에셋을 쓴다.
export const env = {
	imageUrl: import.meta.env.VITE_APP_IMAGE_URL || '/imgs',
	musicUrl: import.meta.env.VITE_APP_MUSIC_URL || '/musics',
	sfxUrl: import.meta.env.VITE_APP_SFX_URL || '/sounds',
};
