// content 폴더의 이미지를 빌드에 포함하고, content 기준 경로(images/a.png) → 빌드된 주소로 묶는다.
const files = import.meta.glob<string>('./content/**/*.{png,jpg,jpeg,gif,webp,avif,svg}', {
	query: '?url',
	import: 'default',
	eager: true,
});

export const CONTENT_IMAGES: Record<string, string> = Object.fromEntries(
	Object.entries(files).map(([path, url]) => [path.replace(/^\.\/content\//, ''), url])
);
