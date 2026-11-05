// 글의 목차: 본문의 ## · ### · #### 제목. 순수 함수만 둔다 (그리기와 스크롤은 components/MemoToc.tsx의 목차 막대)

export interface TocEntry {
	/** 2(##), 3(###), 4(####) */
	level: 2 | 3 | 4;
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
 * 목차 막대가 이전·다음으로 오가는 절: 본문 제목(entries) 가운데 ## 제목의 번호. ## 제목이 둘 미만이면(### 위주의 글) 모든 제목.
 * ### · #### 제목은 절 안의 하위 제목으로 현재 절 옆에 경로로 함께 보인다 (tocPosition)
 */
export function tocBarItems(entries: readonly TocEntry[]): number[] {
	const sections = entries.flatMap((entry, index) => (entry.level === 2 ? [index] : []));
	return sections.length >= 2 ? sections : entries.map((_, index) => index);
}

/**
 * 지금 읽는 제목(activeHeading의 결과)이 속한 절: 그 제목이거나 그보다 앞선 마지막 항목의 순번. 없으면 -1.
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

export interface TocPosition {
	/** 지금 읽는 절 (본문 제목 번호). 첫 절보다 위면 -1 */
	section: number;
	/**
	 * 지금 읽는 절 안에서 읽는 자리까지의 하위 제목 경로 (본문 제목 번호, 얕은 단계부터).
	 * 예: ## 절 › ### 소제목 › #### 세부 제목을 읽는 중이면 [###, ####]. 절 머리를 읽는 중이면 빈 배열
	 */
	trail: number[];
	/** 이전 절. 없으면 -1 */
	prev: number;
	/** 다음 절. 없으면 -1 (첫 절보다 위면 첫 절) */
	next: number;
}

/**
 * 절 안에서 읽는 제목까지의 하위 제목 경로: 읽는 제목에서 절 머리 쪽으로 거슬러 올라가며, 단계가 더 얕은 제목을 하나씩 모은다.
 * (#### 앞의 가장 가까운 ###가 그 ####의 부모다. 절보다 깊은 단계만 모은다)
 */
function trailOf(entries: readonly TocEntry[], section: number, active: number): number[] {
	const trail: number[] = [];
	let above: number = 5;
	for (let index = active; index > section; index--) {
		const { level } = entries[index];
		if (level < above && level > entries[section].level) {
			trail.unshift(index);
			above = level;
		}
	}
	return trail;
}

/**
 * 목차 막대에 보일 이전·현재(+하위 제목 경로)·다음 절
 * @param items tocBarItems의 결과
 * @param active 지금 읽는 제목의 번호 (activeHeading의 결과)
 */
export function tocPosition(entries: readonly TocEntry[], items: readonly number[], active: number): TocPosition {
	const current = activeBarItem(items, active);
	const section = current >= 0 ? items[current] : -1;
	return {
		section,
		trail: section >= 0 ? trailOf(entries, section, active) : [],
		prev: current > 0 ? items[current - 1] : -1,
		next: items[current + 1] ?? -1,
	};
}

/**
 * 제목 바로 아래 단계의 하위 제목들 (본문 제목 번호): 그 제목 뒤에서 같은 단계 이하의 제목이 나오기 전까지의 제목 가운데 가장 얕은 단계.
 * 예: ## 아래에 ###가 있으면 ###들, ### 없이 ####만 있으면 ####들 (tocSiblings가 부모의 이 목록을 쓴다)
 */
export function tocChildren(entries: readonly TocEntry[], index: number): number[] {
	const parent = entries[index];
	if (!parent) return [];
	const inside: number[] = [];
	for (let next = index + 1; next < entries.length && entries[next].level > parent.level; next++) inside.push(next);
	const level = Math.min(...inside.map((next) => entries[next].level));
	return inside.filter((next) => entries[next].level === level);
}

/** 제목의 부모: 앞으로 거슬러 올라가며 처음 만나는 더 얕은 단계의 제목. 없으면 -1 */
function parentOf(entries: readonly TocEntry[], index: number): number {
	for (let before = index - 1; before >= 0; before--) if (entries[before].level < entries[index].level) return before;
	return -1;
}

/**
 * 같은 계층의 제목들 (그 제목 자신을 포함, 본문 순서): 같은 부모 아래의 바로 아래 단계 제목들.
 * 부모가 없는 맨 위 단계(## 절)면 부모 없는 같은 단계의 제목들. 목차 막대의 경로 제목에 마우스를 올리면 펼치는 목록이다
 */
export function tocSiblings(entries: readonly TocEntry[], index: number): number[] {
	if (!entries[index]) return [];
	const parent = parentOf(entries, index);
	if (parent >= 0) return tocChildren(entries, parent);
	return entries.flatMap((entry, other) =>
		entry.level === entries[index].level && parentOf(entries, other) < 0 ? [other] : []
	);
}
