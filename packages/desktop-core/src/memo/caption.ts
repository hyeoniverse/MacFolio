// 이미지 캡션: `![설명](주소 "캡션")`의 캡션 안에 [글자](https://…) 링크를 쓸 수 있다 (사진 출처 표시).
// 읽기 화면(MarkdownImage)과 편집기(이미지 블록)가 같은 규칙으로 나눈다.

export interface CaptionPart {
	text: string;
	/** 링크면 주소 (http·https만) */
	href?: string;
}

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function captionParts(caption: string): CaptionPart[] {
	const parts: CaptionPart[] = [];
	let last = 0;
	for (const match of caption.matchAll(LINK)) {
		if (match.index > last) parts.push({ text: caption.slice(last, match.index) });
		parts.push({ text: match[1], href: match[2] });
		last = match.index + match[0].length;
	}
	if (last < caption.length) parts.push({ text: caption.slice(last) });
	return parts;
}
