// 편집기 안에서 이미지를 보이게 하려고, 글의 상대 경로(./images/a.jpg)를 빌드된 주소로 바꿨다가 저장할 때 되돌린다.
// 순수 함수만 둔다.

/** 본문의 이미지 경로를 편집기에서 보일 주소로. images: content 기준 경로(images/a.jpg) → 빌드된 주소 */
export function toEditorMarkdown(markdown: string, images: Record<string, string>): string {
	// 끝의 배치 표기(#float-right 등)는 빌드된 주소 뒤에 그대로 붙인다 (desktop-core의 imageLayout.ts)
	return markdown.replace(
		/(!\[[^\]]*\]\()(\.\/)?(images\/[^)\s#]+)(#[^)\s]*)?/g,
		(match, head: string, _dot, path: string, hash = '') => (images[path] ? `${head}${images[path]}${hash}` : match)
	);
}

/** 편집기가 내놓은 Markdown의 이미지 주소를 원래 상대 경로로 되돌린다 */
export function fromEditorMarkdown(markdown: string, images: Record<string, string>): string {
	const back = new Map(Object.entries(images).map(([path, url]) => [url, `./${path}`]));
	return markdown.replace(/(!\[[^\]]*\]\()([^)\s#]+)(#[^)\s]*)?/g, (match, head: string, url: string, hash = '') =>
		back.has(url) ? `${head}${back.get(url)}${hash}` : match
	);
}

/**
 * 표의 왼쪽 정렬 표시(:---)를 정렬 없음(----)으로. 편집기는 모든 열을 왼쪽 정렬로 쓰는데,
 * 왼쪽 정렬은 정렬 없음과 똑같이 보이고, 원래 글들처럼 ---로 두는 편이 읽기 쉽다 (목록 미리 보기에 :가 남지 않는다)
 */
export function plainTableAlign(markdown: string): string {
	return markdown.replace(/^\|(?: *:?-+:? *\|)+ *$/gm, (row) => row.replace(/:(-+)(?=[ |])/g, '-$1'));
}

/**
 * 편집기가 줄 맨 앞의 태그(#프론트엔드)를 \#로 이스케이프한 것을 되돌린다. Markdown 제목은 # 뒤에 공백이 있어야 하므로
 * # 바로 뒤에 글자가 오면 이스케이프하지 않아도 제목이 되지 않는다. 그대로 두면 첫 태그를 태그로 읽지 못한다 (desktop-core의 tags.ts).
 * 목록·인용 기호 뒤의 태그도 같고, 코드 블록 안은 건드리지 않는다
 */
export function unescapeTags(markdown: string): string {
	let fence: string | null = null;
	return markdown
		.split('\n')
		.map((line) => {
			const marker = /^\s*(```|~~~)/.exec(line)?.[1];
			if (marker) {
				if (fence === null) fence = marker;
				else if (fence === marker) fence = null;
				return line;
			}
			if (fence !== null) return line;
			return line.replace(/^((?:\s*(?:[-*+]|\d+[.)])\s+|\s*>\s*)*)\\#(?=[\p{L}\p{N}_-])/u, '$1#');
		})
		.join('\n');
}
