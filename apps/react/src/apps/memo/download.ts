// 이미지 내려받기. 다른 주소(API, Unsplash 등)의 그림은 <a download>가 듣지 않아서 받아 와 파일로 저장한다.

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/svg+xml': 'svg',
};

/** 저장할 파일 이름: 설명(없으면 주소의 파일 이름) + 형식에 맞는 확장자. 파일 이름에 쓸 수 없는 글자는 뺀다 */
export function imageFileName(alt: string, src: string, type: string): string {
	const fromUrl = decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() ?? '').replace(/\.[^.]+$/, '');
	// eslint-disable-next-line no-control-regex -- 파일 이름에 쓸 수 없는 제어 문자를 뺀다
	const base = (alt.trim() || fromUrl || 'image').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 80) || 'image';
	const extension =
		EXTENSIONS[type] ?? src.match(/\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'png';
	return `${base}.${extension}`;
}

/** 받아 와서 파일로 저장한다. 받지 못하면(CORS 등) 새 탭에서 연다 */
export async function downloadImage(src: string, alt: string) {
	try {
		const response = await fetch(src);
		if (!response.ok) throw new Error(String(response.status));
		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = imageFileName(alt, src, blob.type);
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	} catch {
		window.open(src, '_blank', 'noopener,noreferrer');
	}
}
