// 상태 표시줄을 누른 자리 밑에 앱의 버튼이 있으면 그것을 누른다.
// 상태 표시줄은 앱 위에 겹쳐 그리고(투명) 눌림을 받으므로, 그대로 두면 그 밑의 버튼·링크·입력 칸은 보이기만 하고 눌리지 않는다.

/** 누를 수 있는 것: 버튼·링크·입력 칸과 그 역할(role)을 가진 요소 */
export const INTERACTIVE =
	'button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"])';

/** 글자를 넣는 칸: 누르는 대신 초점을 준다 */
const TEXT_FIELD =
	'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"]), select, textarea';

/**
 * 누른 자리 바로 밑(상태 표시줄을 뺀 가장 위의 요소)에서 앱 안의 누를 수 있는 것을 찾는다. 없으면 null (빈 곳, 홈 화면).
 * @param stack `document.elementsFromPoint(x, y)`: 위에 그려진 것부터
 */
export function interactiveUnder(stack: readonly Element[], bar: Pick<Element, 'contains'>): HTMLElement | null {
	const below = stack.find((element) => !bar.contains(element));
	const hit = below?.closest<HTMLElement>(INTERACTIVE);
	return hit?.closest('[data-app]') ? hit : null;
}

/** 찾은 것을 누른다. 글자를 넣는 칸은 초점만 준다 */
export function activate(element: HTMLElement) {
	if (element.matches(TEXT_FIELD)) element.focus();
	else element.click();
}
