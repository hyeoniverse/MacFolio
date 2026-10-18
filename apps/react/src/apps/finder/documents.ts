// 문서 파일 목록 (이슈 #20). 파일 자체는 R2 버킷(macfolio-files)에 있고, 사이트가 같은 주소(/files/<key>)로 내준다
// (apps/react/worker/files.ts). 목록은 API의 /documents에 있고, 관리자가 Finder에 끌어다 놓아 올린다 (uploadDocument).
// 올리기 전에 전화번호·주소·생년월일·주민등록번호 같은 번호를 지운다.
import { useSyncExternalStore } from 'react';
import {
	DOCUMENT_FOLDERS,
	documentExtension,
	type DocumentFile,
	type DocumentFolder,
	type DocumentUploadTicket,
	MAX_DOCUMENT_BYTES,
} from '@macfolio/contracts';
import { createStore } from '@macfolio/desktop-core';
import { api } from '@/shared/api/client';
import { env } from '@/shared/config/env';

export { DOCUMENT_FOLDERS, type DocumentFolder };

/** Finder에 보일 파일 하나. 시험용 목록은 id·크기·날짜를 빼도 된다 */
export type DocumentEntry = Pick<DocumentFile, 'folder' | 'name' | 'key' | 'kind'> &
	Partial<Pick<DocumentFile, 'id' | 'size' | 'updated'>>;

declare global {
	/** E2E 테스트가 넣는 시험용 파일 목록 (서버 대신) */
	var __MACFOLIO_DOCUMENTS__: DocumentEntry[] | undefined;
}

interface State {
	status: 'idle' | 'loading' | 'ready' | 'error';
	list: DocumentEntry[];
}

const store = createStore<State>({ status: 'idle', list: [] });
let pending: Promise<void> | null = null;

/** 목록을 받는다. force면 이미 받았어도 다시 (올리기·지우기 뒤) */
export function loadDocuments(force = false): Promise<void> {
	if (globalThis.__MACFOLIO_DOCUMENTS__ || !env.apiUrl) return Promise.resolve();
	if (!force && store.getState().status === 'ready') return Promise.resolve();
	pending ??= (async () => {
		if (store.getState().status !== 'ready') store.setState({ status: 'loading' });
		try {
			store.setState({ status: 'ready', list: await api<DocumentFile[]>('/documents') });
		} catch {
			if (store.getState().status !== 'ready') store.setState({ status: 'error' });
		} finally {
			pending = null;
		}
	})();
	return pending;
}

/** 지금 보일 파일 목록. 시험에서는 window.__MACFOLIO_DOCUMENTS__가 대신한다 */
export function useDocumentEntries(): DocumentEntry[] {
	const { list } = useSyncExternalStore(store.subscribe, store.getState);
	return globalThis.__MACFOLIO_DOCUMENTS__ ?? list;
}

/** 올릴 수 있는 파일인지. 안 되면 까닭 */
export function uploadProblem(file: File): string | null {
	if (!documentExtension(file.name)) return `${file.name}: PDF, PNG, JPG, WebP 파일만 올릴 수 있습니다.`;
	if (file.size === 0) return `${file.name}: 빈 파일입니다.`;
	if (file.size > MAX_DOCUMENT_BYTES) return `${file.name}: 20MB까지 올릴 수 있습니다.`;
	return null;
}

/** R2에 PUT (진행률을 알리려고 XMLHttpRequest. fetch는 올리는 진행률을 주지 않는다) */
function put(url: string, file: File, onProgress: (ratio: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('PUT', url);
		request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
		request.onload = () =>
			request.status >= 200 && request.status < 300
				? resolve()
				: reject(new Error(`저장소에 올리지 못했습니다 (${request.status}).`));
		request.onerror = () => reject(new Error('저장소에 연결하지 못했습니다. 버킷의 CORS 설정을 확인해 주세요.'));
		request.send(file);
	});
}

/**
 * 관리자: 파일 하나를 폴더에 올린다. 서버에서 서명 주소를 받아 R2에 바로 올리고, 다 올리면 목록에 더한다.
 * 실패하면 까닭을 담은 Error
 */
export async function uploadDocument(
	folder: DocumentFolder,
	file: File,
	onProgress: (ratio: number) => void = () => undefined
): Promise<DocumentFile> {
	const problem = uploadProblem(file);
	if (problem) throw new Error(problem);
	const request = { folder, name: file.name, size: file.size };
	const ticket = await api<DocumentUploadTicket>('/documents/uploads', { method: 'POST', json: request });
	await put(ticket.url, file, onProgress);
	const created = await api<DocumentFile>('/documents', { method: 'POST', json: { ...request, key: ticket.key } });
	await loadDocuments(true);
	return created;
}

/** 관리자: 파일을 지운다 (R2에서도) */
export async function deleteDocument(id: string): Promise<void> {
	await api(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
	await loadDocuments(true);
}

/** 관리자: 이름을 바꾼다 (확장자는 그대로) */
export async function renameDocument(id: string, name: string): Promise<void> {
	await api(`/documents/${encodeURIComponent(id)}`, { method: 'PATCH', json: { name } });
	await loadDocuments(true);
}

/**
 * 파일 주소 (/files/<key>). download면 내려받기(attachment).
 * 키가 이미 주소(/imgs/…, https://…)면 그대로: 사진 앱의 사진처럼 R2가 아니라 사이트에 있는 파일
 */
export const fileUrl = (key: string, download = false) =>
	key.startsWith('/') || /^https?:\/\//.test(key)
		? key
		: `/files/${key.split('/').map(encodeURIComponent).join('/')}${download ? '?download=1' : ''}`;

/** 파일을 내려받는다 (?download=1이라 브라우저가 저장한다) */
export function downloadFile(key: string, name: string) {
	const link = document.createElement('a');
	link.href = fileUrl(key, true);
	link.download = name;
	document.body.append(link);
	link.click();
	link.remove();
}

/** 파일을 브라우저의 새 탭에서 연다 */
export const openFileInNewTab = (key: string) => window.open(fileUrl(key), '_blank', 'noopener,noreferrer');

/** 크기 보기 (예: 1.2 MB) */
export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
