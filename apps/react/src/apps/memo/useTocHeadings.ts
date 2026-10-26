import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { TocEntry } from './toc';

/**
 * 목차가 읽는 제목. 읽기 화면은 본문(.memo-markdown)의 맨 위 단계, 편집 화면은 편집기(.ProseMirror)의 맨 위 단계
 * ## · ### 제목이다 (접기 블록·각주 안의 제목은 뺀다)
 */
const headingsIn = (body: HTMLElement | null, editor: boolean) =>
	body
		? [
				...body.querySelectorAll<HTMLHeadingElement>(
					editor ? '.ProseMirror > h2, .ProseMirror > h3' : ':scope > h2, :scope > h3'
				),
			]
		: [];

const sameEntries = (a: TocEntry[], b: TocEntry[]) =>
	a.length === b.length && a.every((entry, index) => entry.level === b[index].level && entry.text === b[index].text);

/**
 * 본문의 제목을 읽는다. 본문을 감싼 컴포넌트(ReaderBody, PostWriter)에서 부른다:
 * React는 형제 요소 순서대로 ref를 붙이므로, 본문보다 앞에 그리는 목차 안에서는 본문 ref가 아직 비어 있다.
 * 부모의 layout effect는 자식의 ref가 모두 붙은 뒤라 첫 그림 전에 읽는다 (목차가 늦게 끼어들어 본문을 밀지 않게)
 * @param editor 편집 화면: 편집기는 늦게 불러와지고 입력할 때마다 제목이 바뀌므로, 본문의 DOM 변화를 지켜보고 다시 읽는다
 */
export function useTocHeadings(bodyRef: RefObject<HTMLDivElement | null>, revision: string, editor = false) {
	const [entries, setEntries] = useState<TocEntry[]>([]);
	const headings = useRef<HTMLHeadingElement[]>([]);
	useLayoutEffect(() => {
		const read = () => {
			headings.current = headingsIn(bodyRef.current, editor);
			const next = headings.current.map((heading) => ({
				level: heading.tagName === 'H3' ? (3 as const) : (2 as const),
				text: heading.textContent?.trim() ?? '',
			}));
			setEntries((current) => (sameEntries(current, next) ? current : next));
		};
		read();
		const body = bodyRef.current;
		if (!editor || !body) return;
		let frame = 0;
		const observer = new MutationObserver(() => {
			if (!frame)
				frame = requestAnimationFrame(() => {
					frame = 0;
					read();
				});
		});
		observer.observe(body, { childList: true, subtree: true, characterData: true });
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [bodyRef, revision, editor]);
	return { entries, headings };
}
