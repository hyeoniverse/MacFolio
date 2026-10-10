/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APP_IMAGE_URL?: string;
	readonly VITE_APP_MUSIC_URL?: string;
	readonly VITE_APP_SFX_URL?: string;
	readonly VITE_API_URL?: string;
	readonly VITE_MESSAGES_STORE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

/** public/imgs 아래 폴더마다 그 안의 그림·영상 주소 (vite.config.ts의 publicImagesPlugin) */
declare module 'virtual:public-images' {
	const folders: Record<string, string[]>;
	export default folders;
}
