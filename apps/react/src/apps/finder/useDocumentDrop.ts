import { useState, type DragEvent } from 'react';
import { useCanEditMemo } from '@/apps/memo/useCanEditMemo';
import { notify } from '@/desktop/notifications/notificationStore';
import { messageOf } from '@/shared/api/client';
import { uploadDocument, uploadProblem } from './documents';
import { placeFileChange, uploadPlan } from './edit';
import { find, type FinderItem } from './files';
import { commit, structureNow } from './structure';

export interface UploadRow {
	id: number;
	name: string;
	/** 놓은 폴더 이름 */
	place: string;
	/** 0~1 */
	progress: number;
}

export const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

let nextId = 1;

/** 놓은 파일들을 차례로 올리고, 놓은 자리가 올린 문서 폴더가 아니면 그 자리를 Finder 구조에 적는다 */
export async function uploadInto(
	roots: FinderItem[],
	targetId: string,
	files: File[],
	onRows: (update: (rows: UploadRow[]) => UploadRow[]) => void = () => undefined
): Promise<void> {
	const plan = uploadPlan(roots, find(roots, targetId));
	if (!plan) return;
	const place = find(roots, plan.target)?.name ?? '';
	const rows = files.map((file) => ({ id: nextId++, name: file.name, place, progress: 0, file }));
	const rejected = rows.filter((row) => uploadProblem(row.file));
	for (const row of rejected) notify({ app: 'finder', title: '올리지 못함', body: uploadProblem(row.file)! });
	const queue = rows.filter((row) => !rejected.includes(row));
	onRows((current) => [...current, ...queue.map(({ id, name, progress }) => ({ id, name, place, progress }))]);
	for (const row of queue) {
		const update = (progress: number) =>
			onRows((current) => current.map((item) => (item.id === row.id ? { ...item, progress } : item)));
		try {
			const created = await uploadDocument(plan.folder, row.file, update);
			if (plan.place) await commit(placeFileChange(structureNow().layout, created.key, plan.place));
		} catch (error) {
			notify({ app: 'finder', title: `${row.name} 올리지 못함`, body: messageOf(error, '올리지 못했습니다.') });
		} finally {
			onRows((current) => current.filter((item) => item.id !== row.id));
		}
	}
}

/**
 * 관리자가 컴퓨터의 파일을 Finder에 끌어다 놓아 올린다 (macOS처럼 파일을 받을 수 있는 폴더면 어디든: 문서·데스크탑·프로젝트·만든 폴더).
 * 놓을 곳은 포인터 아래의 폴더 아이콘(data-folder-target), 없으면 지금 연 폴더. target은 놓을 Finder 폴더 id.
 * 여러 개를 놓으면 차례로 올리고, 올리는 동안 진행률을 보인다. 관리자가 아니면 아무 일도 하지 않는다
 */
export function useDocumentDrop(roots: FinderItem[], currentFolder: string | null) {
	const admin = useCanEditMemo();
	const [target, setTarget] = useState<string | null>(null);
	const [uploads, setUploads] = useState<UploadRow[]>([]);

	/** 포인터 아래의 폴더 아이콘, 없으면 지금 연 폴더 (파일을 받을 수 있는 곳만) */
	const folderAt = (event: DragEvent): string | null => {
		const icon = (event.target as Element).closest?.('[data-folder-target]')?.getAttribute('data-folder-target');
		// 사이드바의 빈 곳은 아무 데도 아니다 (열린 폴더로 올리지 않는다)
		const id = icon ?? ((event.target as Element).closest?.('nav') ? null : currentFolder);
		const plan = id ? uploadPlan(roots, find(roots, id)) : null;
		return plan ? id : null;
	};

	const handlers = admin
		? {
				onDragOver: (event: DragEvent) => {
					if (!hasFiles(event)) return;
					// 받을 수 없는 곳이어도 막는다 (브라우저가 파일을 열어 사이트를 떠나지 않게)
					event.preventDefault();
					const folder = folderAt(event);
					setTarget(folder);
					event.dataTransfer.dropEffect = folder ? 'copy' : 'none';
				},
				onDragLeave: (event: DragEvent) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
				},
				onDrop: (event: DragEvent) => {
					if (!hasFiles(event)) return;
					event.preventDefault();
					const folder = folderAt(event);
					setTarget(null);
					if (!folder) return;
					void uploadInto(roots, folder, [...event.dataTransfer.files], setUploads);
				},
			}
		: {};

	return {
		admin,
		target,
		uploads,
		handlers,
		canUpload: (id: string | null | undefined) => !!id && !!uploadPlan(roots, find(roots, id)),
	};
}
