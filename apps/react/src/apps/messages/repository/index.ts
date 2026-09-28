import { createLocalGuestbookRepository } from './localGuestbookRepository';
import type { GuestbookRepository } from './types';

export type { GuestbookRepository, DeleteResult } from './types';

let repository: GuestbookRepository | null = null;

/** 지금은 localStorage 저장소를 쓴다. API 서버(#9)가 생기면 여기서 구현체를 고른다. */
export function getGuestbookRepository(): GuestbookRepository {
	repository ??= createLocalGuestbookRepository();
	return repository;
}
