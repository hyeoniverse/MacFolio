import { createLocalMemoRepository } from './localMemoRepository';
import type { MemoRepository } from './types';

export type { MemoRecord, MemoRepository, DeleteResult } from './types';

let repository: Promise<MemoRepository> | null = null;

/** 지금은 localStorage 저장소를 쓴다. API 서버(#9)가 생기면 여기서 구현체를 고른다. */
export const getMemoRepository = (): Promise<MemoRepository> => {
	repository ??= Promise.resolve(createLocalMemoRepository());
	return repository;
};
