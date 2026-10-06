import { describe, expect, it } from 'vitest';
import { ariaShortcut, formatShortcut, matchesShortcut, type Shortcut } from './shortcut';

const press = (code: string, keys: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => ({
	code,
	metaKey: !!keys.meta,
	ctrlKey: !!keys.ctrl,
	altKey: !!keys.alt,
	shiftKey: !!keys.shift,
});

describe('단축키', () => {
	const newItem: Shortcut = { code: 'KeyN', alt: true };
	const find: Shortcut = { code: 'KeyF', mod: true };
	const prevTab: Shortcut = { code: 'BracketLeft', alt: true, shift: true };

	it('맥은 ⌥⇧⌘ 기호로, 그 밖은 Ctrl+Alt+Shift로 보인다', () => {
		expect(formatShortcut(newItem, true)).toBe('⌥N');
		expect(formatShortcut(find, true)).toBe('⌘F');
		expect(formatShortcut(prevTab, true)).toBe('⌥⇧[');
		expect(formatShortcut({ code: 'ArrowUp', alt: true }, true)).toBe('⌥↑');
		expect(formatShortcut({ code: 'Digit2', alt: true }, true)).toBe('⌥2');
		expect(formatShortcut(find, false)).toBe('Ctrl+F');
		expect(formatShortcut(prevTab, false)).toBe('Alt+Shift+[');
		expect(ariaShortcut(find, true)).toBe('Meta+F');
		expect(ariaShortcut(newItem, false)).toBe('Alt+N');
	});

	it('같은 조합만 맞는다: 키는 code로 보고(⌥를 누르면 key가 특수 문자가 된다), 다른 조합 키가 더 눌리면 아니다', () => {
		expect(matchesShortcut(press('KeyN', { alt: true }), newItem, true)).toBe(true);
		expect(matchesShortcut(press('KeyN', { alt: true, shift: true }), newItem, true)).toBe(false);
		expect(matchesShortcut(press('KeyN', { alt: true, meta: true }), newItem, true)).toBe(false);
		expect(matchesShortcut(press('KeyN'), newItem, true)).toBe(false);
		// ⌘는 맥에서 metaKey, 그 밖에서 ctrlKey
		expect(matchesShortcut(press('KeyF', { meta: true }), find, true)).toBe(true);
		expect(matchesShortcut(press('KeyF', { ctrl: true }), find, true)).toBe(false);
		expect(matchesShortcut(press('KeyF', { ctrl: true }), find, false)).toBe(true);
		expect(matchesShortcut(press('BracketLeft', { alt: true, shift: true }), prevTab, true)).toBe(true);
	});
});
