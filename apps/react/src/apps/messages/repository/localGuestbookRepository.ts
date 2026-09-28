import type { GuestbookEntry } from '../guestbook';
import type { GuestbookRepository } from './types';

// 브라우저에만 저장하는 구현. 비밀번호는 로컬에서도 평문으로 두지 않고 해시로 저장한다.
export const STORAGE_KEY = 'macfolio:guestbook';

interface StoredEntry extends GuestbookEntry {
	passwordHash?: string;
	salt?: string;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const SEED: StoredEntry[] = [
	{
		id: 'welcome',
		nickname: '김정현',
		message: '방문해 주셔서 감사합니다! 편하게 한마디 남겨 주세요 🙂',
		createdAt: '2026-09-28T00:00:00.000Z',
		isOwner: true,
	},
];

async function hashPassword(password: string, salt: string): Promise<string> {
	const bytes = new TextEncoder().encode(`${salt}:${password}`);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const toPublic = ({ passwordHash: _hash, salt: _salt, ...entry }: StoredEntry): GuestbookEntry => entry;

export function createLocalGuestbookRepository(
	storage: KeyValueStorage = localStorage,
	now: () => Date = () => new Date()
): GuestbookRepository {
	const read = (): StoredEntry[] => {
		try {
			const raw = storage.getItem(STORAGE_KEY);
			return raw ? (JSON.parse(raw) as StoredEntry[]) : SEED;
		} catch {
			return SEED;
		}
	};
	const write = (entries: StoredEntry[]) => {
		try {
			storage.setItem(STORAGE_KEY, JSON.stringify(entries));
		} catch {
			// 저장하지 못해도 이번 화면에서는 보인다
		}
	};

	return {
		async list() {
			return read().map(toPublic);
		},

		async create(input) {
			const salt = crypto.randomUUID();
			const entry: StoredEntry = {
				id: crypto.randomUUID(),
				nickname: input.nickname,
				message: input.message,
				createdAt: now().toISOString(),
				salt,
				passwordHash: await hashPassword(input.password, salt),
			};
			write([...read(), entry]);
			return toPublic(entry);
		},

		async remove(id, password) {
			const entries = read();
			const target = entries.find((entry) => entry.id === id);
			// 주인이 남긴 글은 비밀번호가 없어 방문자가 지울 수 없다
			if (!target || !target.passwordHash || !target.salt) return 'not-found';
			if ((await hashPassword(password, target.salt)) !== target.passwordHash) return 'wrong-password';
			write(entries.filter((entry) => entry.id !== id));
			return 'deleted';
		},
	};
}
