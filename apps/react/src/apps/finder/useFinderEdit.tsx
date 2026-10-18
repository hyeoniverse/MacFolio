import React, { useState } from 'react';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { notify } from '@/desktop/notifications/notificationStore';
import { messageOf } from '@/shared/api/client';
import { useCanEditMemo } from '@/apps/memo/useCanEditMemo';
import { createStore } from '@macfolio/desktop-core';
import { deleteDocument, renameDocument } from './documents';
import { find, type FinderItem, type FolderItem } from './files';
import {
	canCreateIn,
	canDropInto,
	canRename,
	canTrash,
	createFolder,
	editKind,
	moveChange,
	nameProblem,
	parentOf,
	renameFolderChange,
	resolveAlias,
	trashChange,
	untitledName,
} from './edit';
import { commit, structureNow } from './structure';

/** Finder 항목을 끌 때 dataTransfer에 담는 종류 (안에는 항목 id 배열의 JSON) */
export const FINDER_DRAG_TYPE = 'application/x-macfolio-finder-items';

/**
 * 지금 끌고 있는 항목 id (Finder에서 끌기 시작한 것). dragover 중에는 dataTransfer의 값을 읽을 수 없어서 따로 둔다.
 * 바탕화면과 Finder 창이 함께 본다
 */
export const finderDrag = createStore<{ ids: string[] }>({ ids: [] });

/** 이름을 고치는 중인 항목 (Finder와 바탕화면이 함께 본다: 새 폴더를 만들면 바로 이름 편집) */
export const finderRenaming = createStore<{ id: string | null }>({ id: null });

/** 파일 이름에서 확장자 앞까지 (이름 편집은 macOS처럼 확장자 앞까지를 고른다) */
export const stemLength = (item: FinderItem, name: string) =>
	editKind(item) === 'file' && name.lastIndexOf('.') > 0 ? name.lastIndexOf('.') : name.length;

/**
 * 관리자의 Finder 편집 (새 폴더, 이름 변경, 끌어서 옮기기, 휴지통으로 이동). Finder 창과 바탕화면이 함께 쓴다.
 * 이름이 겹치는 등 문제가 있으면 macOS처럼 경고창(alert)을 띄운다. 관리자가 아니면 모든 동작이 아무 일도 하지 않는다
 */
export function useFinderEdit(locations: FolderItem[], scope: 'window' | 'screen' = 'window') {
	const admin = useCanEditMemo();
	const [dialog, setDialog] = useState<
		| { kind: 'alert'; title: string; message?: string }
		| { kind: 'trash'; title: string; message: string; run: () => void }
		| null
	>(null);
	const alert = (title: string, message?: string) => setDialog({ kind: 'alert', title, message });

	/** 폴더 안에 새 폴더 (이름 없는 폴더, 2, 3 …). 만든 폴더의 id, 못 만들면 null */
	const newFolder = (folder: FolderItem | null): string | null => {
		if (!admin || !folder || !canCreateIn(folder)) return null;
		const change = createFolder(folder, untitledName(folder.children), structureNow());
		void commit(change);
		finderRenaming.setState({ id: change.id });
		return change.id;
	};

	/** 이름을 바꾼다. 바뀐 항목의 id (블로그 폴더는 경로가 id라 바뀐다) */
	const rename = async (item: FinderItem, draft: string): Promise<string | null> => {
		finderRenaming.setState({ id: null });
		const name = draft.trim();
		if (!admin || !canRename(item) || name === item.name) return item.id;
		const siblings = parentOf(locations, item.id)?.children ?? [];
		const problem = nameProblem(siblings, name, item.id);
		if (problem) {
			alert(problem.includes('이미 사용 중') ? problem : '이름을 바꿀 수 없습니다.', problem);
			return null;
		}
		if (editKind(item) === 'file' && 'documentId' in item) {
			// 확장자는 그대로 (서버가 바꾸지 못하게 한다). 지웠으면 다시 붙인다
			const ext = item.name.slice(item.name.lastIndexOf('.'));
			const next = name.toLowerCase().endsWith(ext.toLowerCase()) ? name : `${name}${ext}`;
			try {
				await renameDocument(item.documentId!, next);
			} catch (error) {
				alert('이름을 바꾸지 못했습니다.', messageOf(error));
			}
			return item.id;
		}
		const change = renameFolderChange(item, name, structureNow(), siblings);
		if (change.error) {
			alert('이름을 바꿀 수 없습니다.', change.error);
			return null;
		}
		void commit(change);
		return editKind(item) === 'blog-folder' ? item.id.replace(/[^/]+$/, name) : item.id;
	};

	/** 놓을 수 있는지 (끄는 중 강조) */
	const canDrop = (ids: string[], target: FinderItem | null) => {
		if (!admin || !target) return false;
		const items = ids.map((id) => find(locations, id)).filter((item): item is FinderItem => item !== null);
		return items.length === ids.length && canDropInto(locations, items, target);
	};

	/** 항목들을 폴더로 옮긴다. 같은 이름이 이미 있으면 macOS처럼 알리고 옮기지 않는다 */
	const move = (ids: string[], targetItem: FinderItem) => {
		if (!canDrop(ids, targetItem)) return false;
		const items = ids.map((id) => find(locations, id)!);
		const target = resolveAlias(locations, targetItem) as FolderItem;
		const clash = items.find((item) =>
			target.children.some((child) => child.name.toLowerCase() === item.name.toLowerCase())
		);
		if (clash) {
			alert(
				`‘${clash.name}’ 이름의 항목이 이미 이 위치에 있습니다.`,
				`‘${target.name}’ 폴더에 같은 이름이 있어 옮기지 않았습니다. 이름을 바꾼 뒤 다시 옮기십시오.`
			);
			return false;
		}
		void commit(moveChange(locations, items, target, structureNow()));
		return true;
	};

	/** 휴지통으로 이동: 만든 폴더는 안의 것까지, 올린 파일은 서버에서도 지운다 (확인을 받고) */
	const trash = (items: FinderItem[], onDone?: () => void) => {
		const targets = items.filter(canTrash);
		if (!admin || targets.length === 0) return;
		const change = trashChange(targets, structureNow());
		const run = () => {
			const before = structureNow();
			const layoutChanged = JSON.stringify(change.layout) !== JSON.stringify(before.layout);
			const orgChanged = JSON.stringify(change.organization) !== JSON.stringify(before.organization);
			void commit({
				layout: layoutChanged ? change.layout : undefined,
				organization: orgChanged ? change.organization : undefined,
			});
			for (const id of change.documents)
				deleteDocument(id).catch((error) => notify({ app: 'finder', title: '지우지 못함', body: messageOf(error) }));
			onDone?.();
		};
		// 지울 파일이 없으면(빈 폴더, 가상본) 묻지 않는다 (macOS도 휴지통으로 바로 보낸다)
		if (change.documents.length === 0) return run();
		const label = targets.length === 1 ? `‘${targets[0].name}’` : `${targets.length}개의 항목`;
		setDialog({
			kind: 'trash',
			title: `${label}을(를) 휴지통으로 이동하겠습니까?`,
			message: `안에 있는 파일 ${change.documents.length}개도 저장소에서 지워집니다. 이 동작은 취소할 수 없습니다.`,
			run,
		});
	};

	const element = dialog ? (
		<AlertDialog
			title={dialog.title}
			message={dialog.message}
			confirmLabel={dialog.kind === 'trash' ? '휴지통으로 이동' : '확인'}
			cancelLabel={dialog.kind === 'trash' ? '취소' : null}
			onConfirm={() => {
				if (dialog.kind === 'trash') dialog.run();
				setDialog(null);
			}}
			onCancel={() => setDialog(null)}
			scope={scope}
		/>
	) : null;

	return { admin, newFolder, rename, canDrop, move, trash, dialog: element as React.ReactElement | null };
}
