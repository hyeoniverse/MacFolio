// 편집기 안에서 이미지를 보이게 하려고, 글의 상대 경로(./images/a.jpg)를 빌드된 주소로 바꿨다가 저장할 때 되돌린다.
// 순수 함수만 둔다.

/** 본문의 이미지 경로를 편집기에서 보일 주소로. images: content 기준 경로(images/a.jpg) → 빌드된 주소 */
export function toEditorMarkdown(markdown: string, images: Record<string, string>): string {
	return markdown.replace(/(!\[[^\]]*\]\()(\.\/)?(images\/[^)\s]+)/g, (match, head: string, _dot, path: string) =>
		images[path] ? `${head}${images[path]}` : match
	);
}

/** 편집기가 내놓은 Markdown의 이미지 주소를 원래 상대 경로로 되돌린다 */
export function fromEditorMarkdown(markdown: string, images: Record<string, string>): string {
	const back = new Map(Object.entries(images).map(([path, url]) => [url, `./${path}`]));
	return markdown.replace(/(!\[[^\]]*\]\()([^)\s]+)/g, (match, head: string, url: string) =>
		back.has(url) ? `${head}${back.get(url)}` : match
	);
}

/**
 * 표의 왼쪽 정렬 표시(:---)를 정렬 없음(----)으로. 편집기는 모든 열을 왼쪽 정렬로 쓰는데,
 * 왼쪽 정렬은 정렬 없음과 똑같이 보이고, 원래 글들처럼 ---로 두는 편이 읽기 쉽다 (목록 미리 보기에 :가 남지 않는다)
 */
export function plainTableAlign(markdown: string): string {
	return markdown.replace(/^\|(?: *:?-+:? *\|)+ *$/gm, (row) => row.replace(/:(-+)(?=[ |])/g, '-$1'));
}
