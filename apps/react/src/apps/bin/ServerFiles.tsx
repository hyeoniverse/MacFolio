import { useState } from 'react';
import { notify } from '@/desktop/notifications/notificationStore';
import { env } from '@/shared/config/env';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import { deleteServerFile, formatSize, type ServerFile } from './filesApi';
import type { useServerFiles } from './useServerFiles';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

/**
 * 서버 파일 (관리자): 글에 넣은 이미지·첨부와 배경화면. 쓰는 곳이 없는 파일을 지운다.
 * 지금 글이나 배경화면이 쓰는 파일은 지울 수 없다 (서버도 막는다)
 */
/** 무엇이 여기 보이는지. 블로그 글의 이미지는 대부분 저장소에 있어 사이트와 함께 배포되므로 여기 없다 */
const SCOPE_NOTE =
	'메모 편집기로 올린 이미지·첨부 파일과 시스템 설정에서 올린 배경화면이 여기 보입니다. 저장소 글(Markdown)의 이미지는 사이트와 함께 배포되어 서버에 없습니다.';

const ServerFiles = ({ files }: { files: ReturnType<typeof useServerFiles> }) => {
	const { loaded, rows, reload } = files;
	const [confirm, setConfirm] = useState<ServerFile[] | null>(null);
	const removable = rows.filter((row) => row.usage.removable).map((row) => row.file);

	const remove = async (targets: ServerFile[]) => {
		setConfirm(null);
		const results = await Promise.all(targets.map((file) => deleteServerFile(env.apiUrl, file.id)));
		const failed = results.find((result) => !result.ok);
		if (failed && !failed.ok) notify({ app: 'bin', title: '지우지 못한 파일이 있음', body: failed.reason });
		reload();
	};

	if (!loaded) return <p className="bin-empty-note">불러오는 중…</p>;
	if (rows.length === 0)
		return (
			<div className="bin-empty-note">
				<p>서버에 올린 파일이 없습니다.</p>
				<p className="bin-files-note">{SCOPE_NOTE}</p>
			</div>
		);
	return (
		<div className="bin-files">
			<div className="bin-files-summary">
				<span>
					쓰는 곳이 없는 파일 {removable.length}개 · {formatSize(removable.reduce((sum, file) => sum + file.size, 0))}
				</span>
				{removable.length > 0 && (
					<Button tone="danger" onClick={() => setConfirm(removable)}>
						쓰지 않는 파일 지우기
					</Button>
				)}
			</div>
			<p className="bin-files-note">{SCOPE_NOTE}</p>
			<ul className="bin-file-list" aria-label="서버 파일">
				{rows.map(({ file, usage }) => (
					<li key={file.id} className={`bin-file${usage.removable ? ' removable' : ''}`}>
						{file.image ? (
							<img className="bin-file-thumb" src={`${env.apiUrl}${file.path}`} alt="" loading="lazy" />
						) : (
							<i className="bin-file-thumb fa-regular fa-file" aria-hidden="true" />
						)}
						<span className="bin-file-name">{file.name}</span>
						<span className="bin-file-meta">
							{formatSize(file.size)} · {formatDate(file.createdAt)}
						</span>
						<span className="bin-file-usage">{usage.label}</span>
						{usage.removable && (
							<Button className="bin-file-remove" onClick={() => setConfirm([file])}>
								지우기
							</Button>
						)}
					</li>
				))}
			</ul>
			{confirm && (
				<AlertDialog
					title={
						confirm.length === 1
							? `'${confirm[0].name}'을 서버에서 지우겠습니까?`
							: `쓰지 않는 파일 ${confirm.length}개를 서버에서 지우겠습니까?`
					}
					message="이 동작은 취소할 수 없습니다. 예전 버전에서만 쓰던 파일이면 그 버전으로 되돌릴 때 그 자리가 빕니다."
					confirmLabel="지우기"
					onConfirm={() => void remove(confirm)}
					onCancel={() => setConfirm(null)}
				/>
			)}
		</div>
	);
};

export default ServerFiles;
