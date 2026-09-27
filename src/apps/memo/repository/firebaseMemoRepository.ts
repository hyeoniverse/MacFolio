import { ref, get, push, set, remove } from 'firebase/database';
import { database } from '@/shared/lib/firebase';
import type { MemoRecord, MemoRepository, MemoSnapshot } from './types';

const FOLDERS_PATH = 'memos/folders';
const MEMOS_PATH = 'memos/memo';

export const createFirebaseMemoRepository = (): MemoRepository => ({
	async load(): Promise<MemoSnapshot> {
		const [folders, memos] = await Promise.all([get(ref(database, FOLDERS_PATH)), get(ref(database, MEMOS_PATH))]);
		return {
			folders: folders.exists() ? folders.val() : {},
			memos: memos.exists() ? memos.val() : {},
		};
	},

	async create(memo: MemoRecord): Promise<string> {
		const newRef = push(ref(database, MEMOS_PATH));
		await set(newRef, memo);
		return newRef.key ?? '';
	},

	async remove(id, password) {
		const memoRef = ref(database, `${MEMOS_PATH}/${id}`);
		const snapshot = await get(memoRef);
		if (!snapshot.exists()) return 'not-found';
		if ((snapshot.val() as MemoRecord).password !== password) return 'wrong-password';
		await remove(memoRef);
		return 'deleted';
	},
});
