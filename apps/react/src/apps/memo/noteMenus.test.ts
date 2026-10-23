import { describe, expect, it, vi } from 'vitest';
import { noteContextItems, phoneNoteItems, toolMenuItems, type NoteActions } from './noteMenus';
import { DEFAULT_ARRANGEMENT, type Post, type PostSlug } from '@macfolio/desktop-core/memo';
import type { MenuItem } from '@/shared/ui/menu/Menu';

const post = (extra: Partial<Post> = {}): Post => ({
	slug: 'a' as PostSlug,
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
	toggleSecret: vi.fn(),
	remove: vi.fn(),
	restore: vi.fn(),
	purge: vi.fn(),
	revert: vi.fn(),
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
	it('서버에서 고친 저장소 글에만 저장소 글로 되돌리기가 있다 (잠긴 메모는 누를 수 없다)', () => {
		const overrides = post({ status: { draftOnly: false, changed: false, scheduled: null, overridesRepo: true } });
		expect(shape(noteContextItems(overrides, actions()))).toEqual([
			'메모 고정',
			'메모 잠그기',
			'비밀 글로 지정 [x]',
			'—',
			'저장소 글로 되돌리기',
			'메모 삭제',
		]);
		expect(shape(noteContextItems({ ...overrides, locked: true }, actions()))).toContain('저장소 글로 되돌리기 [x]');
		const act = actions();
		const item = noteContextItems(overrides, act).find(
			(entry) => entry !== 'separator' && 'label' in entry && entry.label === '저장소 글로 되돌리기'
		) as { onSelect: () => void };
		item.onSelect();
		expect(act.revert).toHaveBeenCalledWith(overrides);
		// 저장소에 없는 서버 글이나 고치지 않은 저장소 글에는 없다
		expect(shape(noteContextItems(post(), actions()))).not.toContain('저장소 글로 되돌리기');
	});

	it('우클릭: 고정·잠그기·삭제, 고정·잠긴 메모는 해제 글자이고 잠긴 메모는 지울 수 없다', () => {
		expect(shape(noteContextItems(post(), actions()))).toEqual([
			'메모 고정',
			'메모 잠그기',
			'비밀 글로 지정 [x]',
			'—',
			'메모 삭제',
		]);
		expect(shape(noteContextItems(post({ pinned: true, locked: true }), actions()))).toEqual([
			'메모 고정 해제',
			'메모 잠금 해제',
			'비밀 글로 지정 [x]',
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
			'비밀 글로 지정 [x]',
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
		expect(admin.slice(0, 8)).toEqual([
			'새 메모',
			'메모 고정',
			'메모 잠그기',
			'비밀 글로 지정 [x]',
			'메모 삭제',
			'—',
			'링크 공유',
			'—',
		]);
		expect(admin.slice(-2)).toEqual(['목록으로 보기', '갤러리로 보기']);
		expect(shape(toolMenuItems({ ...base, selected: post(), canEdit: false })).slice(0, 2)).toEqual(['링크 공유', '—']);
		const draft = post({ status: { draftOnly: true, changed: false, scheduled: null } });
		expect(shape(toolMenuItems({ ...base, selected: draft, canEdit: true }))).not.toContain('링크 공유');
		// 비밀 글은 다른 사람에게 열리지 않으므로 공유가 없다
		const secret = post({ status: { draftOnly: false, changed: false, scheduled: null, secret: true } });
		expect(shape(toolMenuItems({ ...base, selected: secret, canEdit: true }))).not.toContain('링크 공유');
		expect(shape(toolMenuItems({ ...base, selected: post(), canEdit: true, inTrash: true })).slice(0, 4)).toEqual([
			'새 메모',
			'되돌려 놓기',
			'즉시 삭제',
			'—',
		]);
	});

	it('비밀 글: 서버에만 있는 글만 지정·해제한다. 저장소 글·잠긴 메모는 이유를 보이며 막는다', () => {
		const serverOnly = post({ status: { draftOnly: false, changed: false, scheduled: null } });
		const secretOf = (items: MenuItem[]) =>
			items.find((item) => item !== 'separator' && 'label' in item && item.label.startsWith('비밀 글')) as {
				label: string;
				disabled?: boolean;
				hint?: string;
				onSelect: () => void;
			};
		const act = actions();
		const item = secretOf(noteContextItems(serverOnly, act));
		expect(item).toMatchObject({ label: '비밀 글로 지정', disabled: false });
		item.onSelect();
		expect(act.toggleSecret).toHaveBeenCalledWith(serverOnly);

		const secret = { ...serverOnly, status: { ...serverOnly.status!, secret: true } };
		expect(secretOf(noteContextItems(secret, actions())).label).toBe('비밀 글 해제');
		// 저장소 글(게시 상태 없음)과 저장소 글을 고친 글은 공개 저장소에 원문이 있다
		expect(secretOf(noteContextItems(post(), actions())).hint).toContain('공개 저장소');
		const overrides = post({ status: { draftOnly: false, changed: false, scheduled: null, overridesRepo: true } });
		expect(secretOf(noteContextItems(overrides, actions()))).toMatchObject({ disabled: true });
		expect(secretOf(noteContextItems({ ...serverOnly, locked: true }, actions()))).toMatchObject({
			disabled: true,
			hint: '잠긴 메모는 바꿀 수 없습니다',
		});
	});
});
