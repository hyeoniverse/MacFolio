import { describe, expect, it, vi } from 'vitest';
import { noteContextItems, phoneNoteItems, toolMenuItems, type NoteActions } from './noteMenus';
import { DEFAULT_ARRANGEMENT, type Post } from '@macfolio/desktop-core/memo';
import type { MenuItem } from '@/shared/ui/menu/Menu';

const post = (extra: Partial<Post> = {}): Post => ({
	slug: 'a',
	title: '글',
	date: '2026-10-08',
	category: '개발기',
	summary: '',
	body: '',
	...extra,
});

const actions = (): NoteActions => ({
	togglePin: vi.fn(),
	toggleLock: vi.fn(),
	remove: vi.fn(),
	restore: vi.fn(),
	purge: vi.fn(),
});

/** 메뉴 항목을 읽기 쉬운 줄로: 글자(못 누르면 [x]), 줄은 '—', 가로 줄은 [a | b] */
const shape = (items: MenuItem[]) =>
	items.map((item) =>
		item === 'separator'
			? '—'
			: 'row' in item
				? `[${item.row.map((entry) => entry.label).join(' | ')}]`
				: 'label' in item
					? `${item.label}${item.disabled ? ' [x]' : ''}`
					: '?'
	);

describe('메모 메뉴', () => {
	it('우클릭: 고정·잠그기·삭제, 고정·잠긴 메모는 해제 글자이고 잠긴 메모는 지울 수 없다', () => {
		expect(shape(noteContextItems(post(), actions()))).toEqual(['메모 고정', '메모 잠그기', '—', '메모 삭제']);
		expect(shape(noteContextItems(post({ pinned: true, locked: true }), actions()))).toEqual([
			'메모 고정 해제',
			'메모 잠금 해제',
			'—',
			'메모 삭제 [x]',
		]);
	});

	it('우클릭: 최근 삭제된 메모는 되돌려 놓기·즉시 삭제, 누르면 그 동작을 부른다', () => {
		const calls = actions();
		const items = noteContextItems(post({ deletedAt: '2026-10-08T00:00:00Z' }), calls);
		expect(shape(items)).toEqual(['되돌려 놓기', '—', '즉시 삭제']);
		(items[2] as { onSelect: () => void }).onSelect();
		expect(calls.purge).toHaveBeenCalledWith(expect.objectContaining({ slug: 'a' }));
	});

	it('휴대폰 •••: 관리자는 고정·잠그기 한 줄, 찾기, 삭제. 방문자와 새 메모는 찾기만', () => {
		const find = vi.fn();
		const options = { canEdit: true, inTrash: false, newDraft: false, onFind: find };
		expect(shape(phoneNoteItems(post(), actions(), options))).toEqual([
			'[메모 고정 | 잠그기]',
			'메모에서 찾기',
			'삭제',
		]);
		expect(shape(phoneNoteItems(post(), actions(), { ...options, canEdit: false }))).toEqual(['메모에서 찾기']);
		expect(shape(phoneNoteItems(post(), actions(), { ...options, newDraft: true }))).toEqual(['메모에서 찾기']);
		expect(shape(phoneNoteItems(post(), actions(), { ...options, inTrash: true }))).toEqual([
			'되돌려 놓기',
			'즉시 삭제',
		]);
	});

	it('도구 •••: 새 메모, 그 글의 일, 링크 공유, 정렬, 보기. 방문자는 공유부터, 게시하지 않은 글은 공유가 없다', () => {
		const base = {
			actions: actions(),
			inTrash: false,
			onNewNote: vi.fn(),
			onShare: vi.fn(),
			arrangement: DEFAULT_ARRANGEMENT,
			onArrange: vi.fn(),
			view: 'list' as const,
			onView: vi.fn(),
		};
		const admin = shape(toolMenuItems({ ...base, selected: post(), canEdit: true }));
		expect(admin.slice(0, 7)).toEqual(['새 메모', '메모 고정', '메모 잠그기', '메모 삭제', '—', '링크 공유', '—']);
		expect(admin.slice(-2)).toEqual(['목록으로 보기', '갤러리로 보기']);
		expect(shape(toolMenuItems({ ...base, selected: post(), canEdit: false })).slice(0, 2)).toEqual(['링크 공유', '—']);
		const draft = post({ status: { draftOnly: true, changed: false, scheduled: null } });
		expect(shape(toolMenuItems({ ...base, selected: draft, canEdit: true }))).not.toContain('링크 공유');
		expect(shape(toolMenuItems({ ...base, selected: post(), canEdit: true, inTrash: true })).slice(0, 4)).toEqual([
			'새 메모',
			'되돌려 놓기',
			'즉시 삭제',
			'—',
		]);
	});
});
