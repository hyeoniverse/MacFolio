import type { MemoRecord, MemoRepository, MemoSnapshot } from './types';

// Firebase 설정이 없을 때 쓰는 저장소. 브라우저 localStorage에 저장한다.
const STORAGE_KEY = 'macfolio:memos';

const seed = (): MemoSnapshot => ({
	folders: { '1': '모든 메모', '2': '메모' },
	memos: {
		'1': {
			title: 'MacFolio에 오신 것을 환영합니다',
			content: '이 메모는 브라우저에만 저장됩니다. 새 메모를 작성해 보세요.',
			folder_id: '2',
			created_at: new Date(0).toISOString(),
		},
	},
});

// 시크릿 모드 등에서는 localStorage 접근 자체가 예외를 던질 수 있어 메모리로 대신한다.
let memoryFallback: MemoSnapshot | null = null;

const read = (): MemoSnapshot => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as MemoSnapshot;
	} catch {
		if (memoryFallback) return memoryFallback;
	}
	return memoryFallback ?? seed();
};

const write = (snapshot: MemoSnapshot) => {
	memoryFallback = snapshot;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
	} catch {
		// 메모리에만 남긴다.
	}
};

export const createLocalMemoRepository = (): MemoRepository => ({
	async load() {
		return read();
	},

	async create(memo: MemoRecord) {
		const snapshot = read();
		// 기존 정렬(id 숫자 내림차순)에 맞춰 시간 기반 숫자 id를 쓴다.
		const id = String(Date.now());
		write({ ...snapshot, memos: { ...snapshot.memos, [id]: memo } });
		return id;
	},

	async remove(id, password) {
		const snapshot = read();
		const memo = snapshot.memos[id];
		if (!memo) return 'not-found';
		if (memo.password !== password) return 'wrong-password';
		const { [id]: _removed, ...rest } = snapshot.memos;
		write({ ...snapshot, memos: rest });
		return 'deleted';
	},
});
