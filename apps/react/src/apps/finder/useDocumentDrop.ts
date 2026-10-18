import { useState, type DragEvent } from 'react';
import { DOCUMENT_FOLDERS, type DocumentFolder } from '@macfolio/contracts';
import { useCanEditMemo } from '@/apps/memo/useCanEditMemo';
import { notify } from '@/desktop/notifications/notificationStore';
import { messageOf } from '@/shared/api/client';
import { uploadDocument, uploadProblem } from './documents';

export interface UploadRow {
	id: number;
	name: string;
	folder: DocumentFolder;
	/** 0~1 */
	progress: number;
}

const isDocumentFolder = (name: string | null | undefined): name is DocumentFolder =>
	(DOCUMENT_FOLDERS as readonly string[]).includes(name ?? '');

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

let nextId = 1;

/**
 * 관리자가 파일을 Finder에 끌어다 놓아 올린다. 놓을 곳: 이력서·포트폴리오·자격증 폴더 안, 또는 그 폴더 아이콘 위
 * (data-drop-folder). 여러 개를 놓으면 차례로 올리고, 올리는 동안 진행률을 보인다. 관리자가 아니면 아무 일도 하지 않는다
 */
export function useDocumentDrop(currentFolder: string | null) {
	const admin = useCanEditMemo();
	const [target, setTarget] = useState<DocumentFolder | null>(null);
	const [uploads, setUploads] = useState<UploadRow[]>([]);

	/** 포인터 아래의 폴더 아이콘, 없으면 지금 연 폴더 */
	const folderAt = (event: DragEvent): DocumentFolder | null => {
		const icon = (event.target as Element).closest?.('[data-drop-folder]')?.getAttribute('data-drop-folder');
		if (isDocumentFolder(icon)) return icon;
		return isDocumentFolder(currentFolder) ? currentFolder : null;
	};

	const start = async (folder: DocumentFolder, files: File[]) => {
		const rows = files.map((file) => ({ id: nextId++, name: file.name, folder, progress: 0, file }));
		const rejected = rows.filter((row) => uploadProblem(row.file));
		for (const row of rejected) notify({ app: 'finder', title: '올리지 못함', body: uploadProblem(row.file)! });
		const queue = rows.filter((row) => !rejected.includes(row));
		setUploads((current) => [...current, ...queue.map(({ id, name, progress }) => ({ id, name, folder, progress }))]);
		for (const row of queue) {
			const update = (progress: number) =>
				setUploads((current) => current.map((item) => (item.id === row.id ? { ...item, progress } : item)));
			try {
				await uploadDocument(folder, row.file, update);
			} catch (error) {
				notify({ app: 'finder', title: `${row.name} 올리지 못함`, body: messageOf(error, '올리지 못했습니다.') });
			} finally {
				setUploads((current) => current.filter((item) => item.id !== row.id));
			}
		}
	};

	const handlers = admin
		? {
				onDragOver: (event: DragEvent) => {
					if (!hasFiles(event)) return;
					const folder = folderAt(event);
					setTarget(folder);
					if (!folder) return;
					event.preventDefault();
					event.dataTransfer.dropEffect = 'copy';
				},
				onDragLeave: (event: DragEvent) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
				},
				onDrop: (event: DragEvent) => {
					const folder = folderAt(event);
					setTarget(null);
					if (!folder || !hasFiles(event)) return;
					event.preventDefault();
					void start(folder, [...event.dataTransfer.files]);
				},
			}
		: {};

	return { admin, target, uploads, handlers };
}
