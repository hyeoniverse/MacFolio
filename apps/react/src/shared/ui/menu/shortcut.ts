// 메뉴 항목의 단축키 (#96). 순수 함수만 둔다.
// 브라우저가 먼저 가져가는 키(⌘N·⌘T·⌘W·⌘Q 등)는 웹페이지가 막을 수 없어서, 대신 ⌥(Option) 조합을 쓴다.
// macOS의 원래 단축키와 같은 글자를 고른다 (⌘N → ⌥N, ⌘W → ⌥W). ⌘F처럼 페이지가 받을 수 있는 키는 그대로 쓴다

export interface Shortcut {
	/** KeyboardEvent.code (KeyN, Digit1, BracketLeft, ArrowUp …). ⌥를 누르면 key가 특수 문자(ø 등)로 바뀌어서 code로 본다 */
	code: string;
	/** ⌘ (Windows·Linux에서는 Ctrl) */
	mod?: boolean;
	/** ⌥ (Windows·Linux에서는 Alt) */
	alt?: boolean;
	/** ⇧ */
	shift?: boolean;
}

/** 이 키보드가 맥인지 (⌘·⌥ 기호로 보이고, ⌘는 metaKey) */
export const isMacPlatform = () =>
	typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const KEY_NAME: Record<string, string> = {
	BracketLeft: '[',
	BracketRight: ']',
	ArrowUp: '↑',
	ArrowDown: '↓',
	ArrowLeft: '←',
	ArrowRight: '→',
	Comma: ',',
	Period: '.',
	Slash: '/',
	Space: 'Space',
};

const keyName = (code: string) =>
	KEY_NAME[code] ?? (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code);

/** 화면에 보일 글자: 맥은 ⌥⇧⌘N 순서의 기호, 그 밖은 Ctrl+Alt+Shift+N */
export function formatShortcut(shortcut: Shortcut, mac: boolean): string {
	const key = keyName(shortcut.code);
	if (mac) return `${shortcut.alt ? '⌥' : ''}${shortcut.shift ? '⇧' : ''}${shortcut.mod ? '⌘' : ''}${key}`;
	return [shortcut.mod && 'Ctrl', shortcut.alt && 'Alt', shortcut.shift && 'Shift', key].filter(Boolean).join('+');
}

/** aria-keyshortcuts 값 (스크린 리더) */
export function ariaShortcut(shortcut: Shortcut, mac: boolean): string {
	const key = keyName(shortcut.code);
	return [shortcut.mod && (mac ? 'Meta' : 'Control'), shortcut.alt && 'Alt', shortcut.shift && 'Shift', key]
		.filter(Boolean)
		.join('+');
}

type KeyEventLike = Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/** 눌린 키가 이 단축키인지. 다른 조합 키가 더 눌려 있으면 아니다 */
export function matchesShortcut(event: KeyEventLike, shortcut: Shortcut, mac: boolean): boolean {
	const mod = mac ? event.metaKey : event.ctrlKey;
	const other = mac ? event.ctrlKey : event.metaKey;
	return (
		event.code === shortcut.code &&
		mod === !!shortcut.mod &&
		event.altKey === !!shortcut.alt &&
		event.shiftKey === !!shortcut.shift &&
		!other
	);
}

/** 글자를 쓰는 칸에서는 ⌘(Ctrl) 없는 단축키를 듣지 않는다 (맥에서 ⌥는 특수 문자 입력에 쓴다) */
export const usableWhileTyping = (shortcut: Shortcut) => !!shortcut.mod;

/** 글자를 쓰는 칸인지 (입력 칸, 글 편집기) */
export const isTypingTarget = (target: EventTarget | null) =>
	target instanceof Element &&
	!!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
