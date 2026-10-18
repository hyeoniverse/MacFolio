// 방문자가 끌어다 놓은 파일: 서버에 올리지 않고 이 탭의 메모리에만 둔다 (blob 주소). 새로고침하면 사라진다.
// 관리자가 아니어도 진짜 Finder처럼 놓은 자리에 보이고, 미리보기로 열거나 받을 수 있다
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { DOCUMENT_EXTENSIONS, documentExtension } from '@macfolio/contracts';
import { notify } from '@/desktop/notifications/notificationStore';
import type { FileItem } from './files';

export interface LocalFile extends FileItem {
	/** 놓은 Finder 폴더 id */
	parent: string;
}

const store = createStore<{ files: LocalFile[] }>({ files: [] });
let nextId = 1;
let told = false;

export const useLocalFiles = () => useSyncExternalStore(store.subscribe, () => store.getState().files);

/** 파일들을 그 폴더에 둔다 (이 브라우저에서만) */
export function addLocalFiles(parent: string, files: File[]) {
	if (files.length === 0) return;
	const today = new Date().toISOString().slice(0, 10);
	const added = files.map((file): LocalFile => {
		const ext = documentExtension(file.name);
		return {
			kind: ext ? DOCUMENT_EXTENSIONS[ext] : 'file',
			id: `local:${nextId++}`,
			name: file.name,
			key: URL.createObjectURL(file),
			size: file.size,
			modified: today,
			parent,
		};
	});
	store.setState(({ files: current }) => ({ files: [...current, ...added] }));
	if (!told) {
		told = true;
		notify({
			app: 'finder',
			title: '내 화면에만 추가됨',
			body: '서버에 올리지 않고 이 브라우저에서만 보입니다. 새로고침하면 사라집니다.',
		});
	}
}
