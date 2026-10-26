// 본문 이미지의 배치: 정렬(왼쪽·가운데·오른쪽)과 띄우기(글이 이미지 옆으로 흐른다).
// 이미지 주소 끝의 # 조각에 적는다: `![설명](./images/a.jpg#float-right "캡션")`.
// # 조각은 서버에 보내지 않는 부분이라 GitHub·다른 Markdown 뷰어에서도 이미지는 그대로 보인다 (배치만 무시된다).

/** 가운데(center)는 기본값이라 주소에 적지 않는다 */
export const IMAGE_LAYOUTS = ['left', 'center', 'right', 'float-left', 'float-right'] as const;
export type ImageLayout = (typeof IMAGE_LAYOUTS)[number];

const isLayout = (value: string): value is ImageLayout => (IMAGE_LAYOUTS as readonly string[]).includes(value);

/** 이미지 주소에서 배치를 읽는다. 배치가 아닌 # 조각(예: SVG의 #id)은 주소에 그대로 둔다 */
export function imageLayoutOf(src: string): { src: string; layout: ImageLayout } {
	const hash = src.lastIndexOf('#');
	if (hash < 0) return { src, layout: 'center' };
	const fragment = src.slice(hash + 1);
	if (!isLayout(fragment)) return { src, layout: 'center' };
	return { src: src.slice(0, hash), layout: fragment };
}

/** 이미지 주소에 배치를 적는다 (가운데면 # 조각을 지운다) */
export function withImageLayout(src: string, layout: ImageLayout): string {
	const { src: base } = imageLayoutOf(src);
	return layout === 'center' ? base : `${base}#${layout}`;
}
