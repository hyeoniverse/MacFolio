import { isFirebaseConfigured } from '@/shared/config/env';
import { createLocalMemoRepository } from './localMemoRepository';
import type { MemoRepository } from './types';

export type { MemoRecord, MemoRepository, DeleteResult } from './types';

let repository: Promise<MemoRepository> | null = null;

/**
 * Firebase가 설정되어 있으면 Firebase를, 아니면 localStorage를 쓴다.
 * Firebase SDK는 설정이 있을 때만 불러온다.
 */
export const getMemoRepository = (): Promise<MemoRepository> => {
	repository ??= isFirebaseConfigured
		? import('./firebaseMemoRepository').then((m) => m.createFirebaseMemoRepository())
		: Promise.resolve(createLocalMemoRepository());
	return repository;
};
