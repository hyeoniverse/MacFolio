import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { TocEntry } from './toc';

/** 본문의 맨 위 단계 ## · ### 제목 (접기 블록·각주 안의 제목은 뺀다) */
const headingsIn = (body: HTMLElement | null) =>
	body ? [...body.querySelectorAll<HTMLHeadingElement>(':scope > h2, :scope > h3')] : [];

/**
 * 본문의 제목을 읽는다. 본문을 감싼 컴포넌트(ReaderBody)에서 부른다:
 * React는 형제 요소 순서대로 ref를 붙이므로, 본문보다 앞에 그리는 목차 안에서는 본문 ref가 아직 비어 있다.
 * 부모의 layout effect는 자식의 ref가 모두 붙은 뒤라 첫 그림 전에 읽는다 (목차가 늦게 끼어들어 본문을 밀지 않게)
 */
export function useTocHeadings(bodyRef: RefObject<HTMLDivElement | null>, revision: string) {
	const [entries, setEntries] = useState<TocEntry[]>([]);
	const headings = useRef<HTMLHeadingElement[]>([]);
	useLayoutEffect(() => {
		headings.current = headingsIn(bodyRef.current);
		setEntries(
			headings.current.map((heading) => ({
				level: heading.tagName === 'H3' ? 3 : 2,
				text: heading.textContent?.trim() ?? '',
			}))
		);
	}, [bodyRef, revision]);
	return { entries, headings };
}
