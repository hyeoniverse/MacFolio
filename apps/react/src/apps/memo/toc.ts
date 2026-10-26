// 글의 목차: 본문의 ## · ### 제목. 순수 함수만 둔다 (그리기와 스크롤은 components/MemoToc.tsx)

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
