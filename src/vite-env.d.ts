/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APP_IMAGE_URL?: string;
	readonly VITE_APP_MUSIC_URL?: string;
	readonly VITE_APP_SFX_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
