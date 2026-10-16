// RPG 대화창(DialoguePage, DialogueTown)이 키를 받을지 정한다. 키는 window에서 듣되, 이 페이지가 열린 Safari 창 안에서
// 눌린 키만 받는다. 탭을 눌러 페이지를 열면 포커스는 탭 단추에 남는데(페이지를 다시 누르지 않는 한), 그때도 Z·X·방향 키가
// 바로 먹어야 한다. 글 상자, 다른 앱 창, 단축키(⌘·Ctrl·Alt)는 건드리지 않고, 페이지 밖 단추의 Enter·Space는 그 단추가 받는다

/** 글을 쓰는 곳인지 */
const typing = (el: HTMLElement) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;

/**
 * root(.dl)가 이 키를 받는지: 포커스가 페이지 안, 문서 바탕(body), 또는 같은 앱 창(탭 막대·도구 막대) 안에 있고
 * 페이지가 보일 때만. 페이지 밖 단추·링크에서 누른 Enter·Space는 그 단추의 것이라 받지 않는다
 */
export function acceptsGameKey(event: KeyboardEvent, root: Element | null | undefined): boolean {
	if (!root || !root.isConnected) return false;
	if (event.metaKey || event.ctrlKey || event.altKey) return false;
	const target = event.target instanceof HTMLElement ? event.target : null;
	// 포커스가 어디에도 없으면(바탕): 이 앱 창이 맨 앞일 때만
	if (!target || target === document.body || target === document.documentElement) return isShown(root) && isFront(root);
	if (typing(target)) return false;
	if (root.contains(target)) return true;
	const app = root.closest('[data-app]');
	if (!app || !app.contains(target)) return false;
	if ((event.key === 'Enter' || event.key === ' ') && target.closest('button, a, [role="button"]')) return false;
	return isShown(root);
}

/** 이 페이지가 든 앱 창이 바탕 화면의 창들 중 맨 앞인지 (창이 하나뿐이거나 창 밖이면 맨 앞으로 친다) */
function isFront(root: Element) {
	const app = root.closest<HTMLElement>('[data-app]');
	if (!app?.parentElement) return true;
	const z = (el: Element) => Number((el as HTMLElement).style.zIndex) || 0;
	const mine = z(app);
	return [...app.parentElement.querySelectorAll(':scope > [data-app]')].every(
		(other) => other === app || z(other) <= mine || !isShown(other)
	);
}

/** 페이지가 화면에 보이는지 (숨은 탭·최소화한 창이면 크기가 없다) */
function isShown(root: Element) {
	const rect = root.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

/** 자판 위치(event.code)로 읽는 글쇠: 한글 입력 상태에서는 Z가 'ㅋ'(또는 IME의 'Process')로 오므로 key 대신 위치로 본다 */
const CODE_KEYS: Readonly<Record<string, string>> = {
	KeyZ: 'z',
	KeyX: 'x',
	KeyW: 'w',
	KeyA: 'a',
	KeyS: 's',
	KeyD: 'd',
};

/**
 * 게임이 쓰는 키 이름: Z·X·WASD는 자판 위치로(입력기·자판 배열과 상관없이), 그 밖의 글자는 소문자로, 나머지는 key 그대로
 * (Enter, Escape, 방향 키, 숫자)
 */
export function gameKey(event: KeyboardEvent): string {
	const byCode = CODE_KEYS[event.code];
	if (byCode) return byCode;
	return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}
