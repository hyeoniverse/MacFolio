// 글의 목차: 본문의 ## · ### 제목. 순수 함수만 둔다 (그리기와 스크롤은 components/MemoToc.tsx의 한 줄 목차 막대)

export interface TocEntry {
	/** 2(##) 또는 3(###) */
	level: 2 | 3;
	text: string;
}

/**
 * 목차를 보이는 최소 제목 수. 제목이 두 개 이하인 글은 한 화면 안에서 훑어볼 수 있어 목차가 본문보다 길어 보인다.
 * 2026-10-27 저장소 글 238편은 모두 셋 이상이라, 관리자가 사이트에서 쓴 짧은 글을 위한 기준이다
 */
export const TOC_MIN_HEADINGS = 3;

/** 목차를 보일지 */
export const showsToc = (entries: readonly TocEntry[]) => entries.length >= TOC_MIN_HEADINGS;

/**
 * 지금 읽는 절: 스크롤 영역 위에서 offset 아래에 걸친 마지막 제목. 첫 제목보다 위면 -1.
 * @param tops 제목마다 스크롤 영역 위에서 잰 거리 (화면 기준 top - 영역 top), 본문 순서
 * @param offset 영역 위에서 이만큼 내려온 선을 지난 제목을 읽는 중으로 본다
 */
export function activeHeading(tops: readonly number[], offset: number): number {
	let active = -1;
	for (let index = 0; index < tops.length; index++) {
		if (tops[index] <= offset) active = index;
		else break;
	}
	return active;
}

/**
 * 목차 막대에 놓을 항목: 본문 제목(entries) 가운데 ## 제목의 번호. ## 제목이 둘 미만이면(### 위주의 글) 모든 제목을 놓는다.
 * 막대는 한 줄이라 ### 까지 늘어놓으면 대부분 화면 밖으로 밀리므로, 절의 큰 단위인 ##만 보인다
 */
export function tocBarItems(entries: readonly TocEntry[]): number[] {
	const sections = entries.flatMap((entry, index) => (entry.level === 2 ? [index] : []));
	return sections.length >= 2 ? sections : entries.map((_, index) => index);
}

/**
 * 지금 읽는 제목(activeHeading의 결과)이 속한 막대 항목: 그 제목이거나 그보다 앞선 마지막 항목의 순번. 없으면 -1.
 * @param items tocBarItems의 결과 (본문 제목 번호, 오름차순)
 * @param active 지금 읽는 제목의 번호 (첫 제목보다 위면 -1)
 */
export function activeBarItem(items: readonly number[], active: number): number {
	let current = -1;
	for (let index = 0; index < items.length; index++) {
		if (items[index] <= active) current = index;
		else break;
	}
	return current;
}
