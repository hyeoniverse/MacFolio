import type { ReactNode } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import FormatTools from '../writer/FormatTools';

/**
 * 관리자 도구 (본문 위 도구 막대, 좁은 창의 본문 위 줄): 새 메모, 서식, 버전 기록, 지우기.
 * 최근 삭제된 메모면 지우기 대신 되돌려 놓기·즉시 삭제 (본문 위 안내 상자에도 같은 단추). 고치기는 본문에서 바로 한다
 */
const AuthorTools = ({
	className,
	onNewNote,
	revisions,
	deleted,
	remove,
}: {
	className: string;
	/** 새 메모 단추 (사이드바가 닫혀 있을 때만. 열려 있으면 사이드바 위쪽에 있다) */
	onNewNote: (() => void) | null;
	/** 버전 기록 단추 (고칠 수 있는 글을 열었을 때. 창을 여는 자리를 재야 해서 부르는 쪽이 만든다) */
	revisions: ReactNode;
	/** 최근 삭제된 메모를 열었을 때 */
	deleted: { onRestore: () => void; onPurge: () => void } | null;
	/** 지우기 (잠긴 메모는 지울 수 없다) */
	remove: { locked: boolean; onRemove: () => void } | null;
}) => (
	<>
		{onNewNote && (
			<IconButton className={className} label="새 메모" onClick={onNewNote} icon="fa-regular fa-pen-to-square" />
		)}
		{/* 본문 서식 (편집기가 열려 있을 때만) */}
		<span className={`memo-format-tools ${className}`}>
			<FormatTools />
		</span>
		{revisions}
		{deleted && (
			<>
				<IconButton
					className={className}
					label="되돌려 놓기"
					onClick={deleted.onRestore}
					icon="fa-solid fa-rotate-left"
				/>
				<IconButton
					className={className}
					label="메모 즉시 삭제"
					onClick={deleted.onPurge}
					icon="fa-regular fa-trash-can"
				/>
			</>
		)}
		{remove && (
			<IconButton
				className={className}
				label="메모 삭제"
				title={remove.locked ? '잠긴 메모는 지울 수 없습니다' : undefined}
				disabled={remove.locked}
				onClick={remove.onRemove}
				icon="fa-regular fa-trash-can"
			/>
		)}
	</>
);

export default AuthorTools;
