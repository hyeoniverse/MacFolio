import { describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@/shared/ui/menu/Menu';
import { buildMenuBar, shortcutList, type MenuBarContext } from './menuBar';

const context = (overrides: Partial<MenuBarContext> = {}): MenuBarContext => ({
	appMenus: [],
	hasWindow: true,
	actions: {
		closeWindow: vi.fn(),
		minimize: vi.fn(),
		toggleMaximize: vi.fn(),
		toggleDark: vi.fn(),
	},
	dark: false,
	windows: [],
	help: [{ label: 'GitHub 저장소', onSelect: vi.fn() }],
	...overrides,
});
const titles = (menus: { title: string }[]) => menus.map((menu) => menu.title);
const labels = (items: MenuItem[]) =>
	items.map((item) => (item === 'separator' ? '—' : 'label' in item ? item.label : '?'));

describe('buildMenuBar', () => {
	it('앱이 등록한 것이 없으면 쓰는 제목만: 파일·보기·윈도우·도움말 (편집·이동은 감춘다)', () => {
		expect(titles(buildMenuBar(context()))).toEqual(['파일', '보기', '윈도우', '도움말']);
	});

	it('창이 없으면(Finder) 창 항목이 빠지고, 빈 파일·윈도우 메뉴는 감춘다', () => {
		const menus = buildMenuBar(context({ hasWindow: false }));
		expect(titles(menus)).toEqual(['보기', '도움말']);
	});

	it('앱 항목은 같은 제목의 공통 항목 위에, 구분선을 두고 합친다', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [{ title: '파일', items: [{ label: '새로운 메모', onSelect: vi.fn() }] }],
				actions: { ...context().actions, copyLink: vi.fn() },
			})
		);
		expect(labels(menus[0].items)).toEqual(['새로운 메모', '—', '링크 복사', '—', '윈도우 닫기']);
	});

	it('앱이 편집·이동을 등록하면 그 제목이 나타나고, 앱만의 메뉴는 이동 뒤·윈도우 앞에', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [
					{ title: '제어', items: [{ label: '재생', onSelect: vi.fn() }] },
					{ title: '편집', items: [{ label: '찾기', onSelect: vi.fn() }] },
					{ title: '이동', items: [{ label: '뒤로', onSelect: vi.fn() }] },
				],
			})
		);
		expect(titles(menus)).toEqual(['파일', '편집', '보기', '이동', '제어', '윈도우', '도움말']);
	});

	it('윈도우 메뉴: 최소화·확대/축소 아래에 열린 창 목록 (지금 쓰는 창에 체크)', () => {
		const menus = buildMenuBar(
			context({
				windows: [
					{ label: 'Safari', active: false, onSelect: vi.fn() },
					{ label: '메모', active: true, onSelect: vi.fn() },
				],
			})
		);
		const window = menus.find((menu) => menu.title === '윈도우')!;
		expect(labels(window.items)).toEqual(['최소화', '확대/축소', '—', 'Safari', '메모']);
		expect(window.items[4]).toMatchObject({ checked: true });
	});

	it('다크 모드는 지금 상태를 체크로 보여 준다', () => {
		const view = buildMenuBar(context({ dark: true })).find((menu) => menu.title === '보기')!;
		expect(view.items).toEqual([expect.objectContaining({ label: '다크 모드', checked: true })]);
	});

	it('키보드 단축키 목록: 단축키가 있는 항목만, 메뉴 순서대로', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [
					{
						title: '파일',
						items: [
							{ label: '새로운 탭', shortcut: { code: 'KeyT', alt: true }, onSelect: vi.fn() },
							{ label: '단축키 없음', onSelect: vi.fn() },
						],
					},
				],
			})
		);
		expect(shortcutList(menus)).toEqual([
			{
				title: '파일',
				items: [
					{ label: '새로운 탭', shortcut: { code: 'KeyT', alt: true } },
					{ label: '윈도우 닫기', shortcut: { code: 'KeyW', alt: true } },
				],
			},
			{ title: '윈도우', items: [{ label: '최소화', shortcut: { code: 'KeyM', alt: true } }] },
		]);
	});

	it('앱이 ⌥W를 쓰면(Safari의 탭 닫기) 윈도우 닫기는 ⌥⇧W. 목록에는 실제로 듣는 단축키만', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [
					{
						title: '파일',
						items: [
							{ label: '탭 닫기', shortcut: { code: 'KeyW', alt: true }, onSelect: vi.fn() },
							{ label: '겹치는 항목', shortcut: { code: 'KeyW', alt: true }, onSelect: vi.fn() },
						],
					},
				],
			})
		);
		expect(menus[0].items.at(-1)).toMatchObject({
			label: '윈도우 닫기',
			shortcut: { code: 'KeyW', alt: true, shift: true },
		});
		expect(shortcutList(menus)[0].items.map((item) => item.label)).toEqual(['탭 닫기', '윈도우 닫기']);
	});
});
