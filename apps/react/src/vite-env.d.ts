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

/** 저장소의 최근 글 (vite.config.ts의 recentPostsPlugin). 위젯이 메모 앱의 글 묶음 없이 쓴다 */
declare module 'virtual:recent-posts' {
	const posts: { slug: string; title: string; date: string; category: string }[];
	export default posts;
}

/** 글 slug → 올린 때 (ISO, git에 처음 더한 커밋. vite.config.ts의 recentPostsPlugin). 같은 날 글의 순서를 정한다 */
declare module 'virtual:post-created' {
	const created: Record<string, string>;
	export default created;
}

/** 저장소의 모든 글, 최신 글이 먼저 (vite.config.ts의 recentPostsPlugin). 메모 위젯의 인기글·랜덤이 그때 불러온다 */
declare module 'virtual:post-index' {
	const posts: { slug: string; title: string; date: string; category: string }[];
	export default posts;
}
