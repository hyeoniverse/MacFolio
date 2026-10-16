import { describe, expect, it } from 'vitest';
import { gameKey } from './dialogueKeys';

const press = (key: string, code: string) => ({ key, code }) as KeyboardEvent;

describe('gameKey', () => {
	it('한글 입력 상태에서도 Z·X·WASD를 자판 위치로 읽는다', () => {
		expect(gameKey(press('ㅋ', 'KeyZ'))).toBe('z');
		expect(gameKey(press('ㅌ', 'KeyX'))).toBe('x');
		expect(gameKey(press('Process', 'KeyX'))).toBe('x');
		expect(gameKey(press('ㅈ', 'KeyW'))).toBe('w');
		expect(gameKey(press('ㅁ', 'KeyA'))).toBe('a');
		expect(gameKey(press('ㄴ', 'KeyS'))).toBe('s');
		expect(gameKey(press('ㅇ', 'KeyD'))).toBe('d');
	});

	it('그 밖의 키는 key 그대로 읽고, 글자는 소문자로 바꾼다', () => {
		expect(gameKey(press('Z', 'KeyZ'))).toBe('z');
		expect(gameKey(press('Enter', 'Enter'))).toBe('Enter');
		expect(gameKey(press('Escape', 'Escape'))).toBe('Escape');
		expect(gameKey(press('ArrowUp', 'ArrowUp'))).toBe('ArrowUp');
		expect(gameKey(press('3', 'Digit3'))).toBe('3');
	});
});
