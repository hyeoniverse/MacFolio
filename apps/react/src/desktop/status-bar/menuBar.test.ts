import { describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@/shared/ui/menu/Menu';
import { buildMenuBar, shortcutList, type MenuBarContext } from './menuBar';

const context = (overrides: Partial<MenuBarContext> = {}): MenuBarContext => ({
	appLabel: '메모',
	appMenus: [],
	hasWindow: true,
	canQuit: true,
	actions: {
		closeWindow: vi.fn(),
		minimize: vi.fn(),
		toggleMaximize: vi.fn(),
		quit: vi.fn(),
	},
	help: [{ label: '키보드 단축키…', onSelect: vi.fn() }],
	...overrides,
});
const titles = (menus: { title: string }[]) => menus.map((menu) => menu.title);
const labels = (items: MenuItem[]) =>
	items.map((item) => (item === 'separator' ? '—' : 'label' in item ? item.label : '?'));

describe('buildMenuBar', () => {
	it('맨 앞은 굵은 앱 이름 메뉴(가리기·종료). 앱이 쓰지 않는 편집·보기·이동은 감춘다', () => {
		const menus = buildMenuBar(context());
		expect(titles(menus)).toEqual(['메모', '파일', '윈도우', '도움말']);
		expect(menus[0]).toMatchObject({ app: true });
		expect(labels(menus[0].items)).toEqual(['메모 가리기', '—', '메모 종료']);
	});

	it('창이 없으면(바탕화면의 Finder) 앱 이름만 남고 가리기는 비활성, 종료할 수 없는 앱은 종료가 없다', () => {
		const menus = buildMenuBar(context({ appLabel: 'Finder', hasWindow: false, canQuit: false }));
		expect(titles(menus)).toEqual(['Finder', '도움말']);
		expect(menus[0].items).toEqual([expect.objectContaining({ label: 'Finder 가리기', disabled: true })]);
	});

	it('보기·윈도우에는 이 앱의 것만: 다크 모드도, 다른 앱의 창 목록도 없다', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [
					{ title: '보기', items: [{ label: '갤러리로 보기', onSelect: vi.fn() }] },
					{ title: '윈도우', items: [{ label: '다음 탭 보기', onSelect: vi.fn() }] },
				],
			})
		);
		expect(labels(menus.find((menu) => menu.title === '보기')!.items)).toEqual(['갤러리로 보기']);
		expect(labels(menus.find((menu) => menu.title === '윈도우')!.items)).toEqual([
			'최소화',
			'확대/축소',
			'—',
			'다음 탭 보기',
		]);
	});

	it('앱 항목은 같은 제목의 공통 항목 위에, 구분선을 두고 합친다', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [{ title: '파일', items: [{ label: '새로운 메모', onSelect: vi.fn() }] }],
				actions: { ...context().actions, copyLink: vi.fn() },
			})
		);
		expect(labels(menus[1].items)).toEqual(['새로운 메모', '—', '링크 복사', '—', '윈도우 닫기']);
	});

	it('앱만의 메뉴(음악의 제어, Safari의 책갈피)는 이동 뒤·윈도우 앞에', () => {
		const menus = buildMenuBar(
			context({
				appMenus: [
					{ title: '제어', items: [{ label: '재생', onSelect: vi.fn() }] },
					{ title: '편집', items: [{ label: '찾기', onSelect: vi.fn() }] },
					{ title: '이동', items: [{ label: '뒤로', onSelect: vi.fn() }] },
				],
			})
		);
		expect(titles(menus)).toEqual(['메모', '파일', '편집', '이동', '제어', '윈도우', '도움말']);
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
				title: '메모',
				items: [
					{ label: '메모 가리기', shortcut: { code: 'KeyH', alt: true } },
					{ label: '메모 종료', shortcut: { code: 'KeyQ', alt: true } },
				],
			},
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
		const file = menus.find((menu) => menu.title === '파일')!;
		expect(file.items.at(-1)).toMatchObject({
			label: '윈도우 닫기',
			shortcut: { code: 'KeyW', alt: true, shift: true },
		});
		expect(
			shortcutList(menus)
				.find((menu) => menu.title === '파일')!
				.items.map((item) => item.label)
		).toEqual(['탭 닫기', '윈도우 닫기']);
	});
});
