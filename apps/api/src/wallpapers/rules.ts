// 배경화면 규칙 (DB CHECK 제약과 같다)

export const NAME_MAX = 40;

/** 이름 다듬기: 확장자와 제어 문자를 빼고 앞뒤 공백을 지운 뒤 40자까지. 비면 null */
export function cleanWallpaperName(name: unknown): string | null {
	if (typeof name !== 'string') return null;
	const cleaned = name
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f]/g, '')
		.trim()
		.replace(/\.(jpe?g|png|gif|webp|heic)$/i, '')
		.trim();
	return cleaned ? Array.from(cleaned).slice(0, NAME_MAX).join('') : null;
}
