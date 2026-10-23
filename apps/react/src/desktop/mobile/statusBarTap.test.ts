import { describe, expect, it, vi } from 'vitest';
import { activate, interactiveUnder } from './statusBarTap';

/** closest·matches만 흉내 낸 요소: 조상 사슬과 각자 맞는 선택자 */
function fake(name: string, matches: (selector: string) => boolean, parent: FakeElement | null = null): FakeElement {
	const element: FakeElement = {
		name,
		parent,
		matches: (selector) => matches(selector),
		closest: (selector) => {
			for (let at: FakeElement | null = element; at; at = at.parent) if (at.matches(selector)) return at;
			return null;
		},
		click: vi.fn(),
		focus: vi.fn(),
	};
	return element;
}
interface FakeElement {
	name: string;
	parent: FakeElement | null;
	matches: (selector: string) => boolean;
	closest: (selector: string) => FakeElement | null;
	click: () => void;
	focus: () => void;
}
const isApp = (selector: string) => selector === '[data-app]';
const isInteractive = (selector: string) => selector.includes('button');

const app = fake('app', isApp);
const button = fake('button', isInteractive, app);
const icon = fake('icon', () => false, button);
const plain = fake('plain', () => false, app);
const home = fake('home', () => false);
const homeButton = fake('home-button', isInteractive, home);
const bar = fake('bar', () => false);
const barText = fake('bar-text', () => false, bar);
const statusBar = { contains: (other: Element | null) => other === (bar as never) || other === (barText as never) };

const under = (...stack: FakeElement[]) => interactiveUnder(stack as never, statusBar);

describe('상태 표시줄 밑의 누를 수 있는 것', () => {
	it('상태 표시줄을 건너뛰고 바로 밑의 버튼(그 안의 아이콘을 눌러도)을 찾는다', () => {
		expect(under(barText, bar, icon, button, app)).toBe(button);
	});

	it('밑이 빈 곳이면 null (제어 센터를 연다)', () => {
		expect(under(bar, plain, app)).toBeNull();
	});

	it('홈 화면(앱 밖)의 버튼은 가로채지 않는다', () => {
		expect(under(bar, homeButton, home)).toBeNull();
	});

	it('바로 밑만 본다: 빈 곳 밑에 깔린 버튼은 누르지 않는다', () => {
		expect(under(bar, plain, button, app)).toBeNull();
	});
});

describe('activate', () => {
	it('버튼은 누르고, 글자 칸은 초점만 준다', () => {
		const target = fake('b', () => false);
		activate(target as never);
		expect(target.click).toHaveBeenCalled();
		const field = fake('input', (selector) => selector.startsWith('input'));
		activate(field as never);
		expect(field.focus).toHaveBeenCalled();
		expect(field.click).not.toHaveBeenCalled();
	});
});
