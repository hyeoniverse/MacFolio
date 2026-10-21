import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useCanEditMemo } from '@/apps/memo/useCanEditMemo';
import DocView from '@/apps/finder/DocView';
import { downloadResume } from '@/apps/finder/resumeDownload';
import { RESUME_DOC } from '@/apps/finder/resumeModel';
import { useProfile } from '@/shared/site/profileStore';
import { useResumeState } from '@/shared/site/resumeStore';
import { useResolvedTheme } from '@/shared/settings/settingsStore';
import IconButton from '@/shared/ui/button/IconButton';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import Toolbar from '@/shared/ui/toolbar/Toolbar';
import { requestOpen } from '@/shared/lib/openRequest';
import ResumeEditor from './ResumeEditor';
import { resetTextEdit, stepTextEdit, useTextEdit, openInTextEdit } from './textEditStore';
import './TextEdit.css';

let mounted = 0;

/**
 * 텍스트 편집기 (macOS TextEdit). Finder에서 Markdown 문서(.md)를 열면 뜬다: 저장소 문서(README, docs/…)와 이력서.
 * - 보기: Markdown을 정리된 모양으로 그린다 (DocView). 문서 링크는 이 창 안에서 옮겨 가고, 뒤로·앞으로 돌아온다
 * - 이력서: PDF 다운로드(파일 › PDF로 내보내기…), 관리자는 편집(편집 › 이력서 편집)으로 원본 Markdown을 고친다
 * - 저장소 문서는 코드 파일이라 읽기만 한다. 휴대폰은 파일 앱 안에서 읽는다 (iOS에는 텍스트 편집기가 없다)
 */
const TextEdit: React.FC = () => {
	const { path, canBack, canForward } = useTextEdit();
	const { apps, openApp, bringAppToFront } = useAppState();
	const admin = useCanEditMemo();
	const profile = useProfile();
	const { custom } = useResumeState();
	const dark = useResolvedTheme() === 'dark';
	const [editing, setEditing] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const resume = path === RESUME_DOC;

	// 다른 문서로 가면 편집을 끝낸다
	const [shownPath, setShownPath] = useState(path);
	if (shownPath !== path) {
		setShownPath(path);
		setEditing(false);
	}

	// 빨간 버튼으로 창을 닫으면 열린 문서를 비운다 (다음에는 새로 연 문서부터)
	const running = apps.textedit.isRunning;
	const wasRunning = useRef(running);
	useEffect(() => {
		if (wasRunning.current && !running) resetTextEdit();
		wasRunning.current = running;
	}, [running]);
	// 앱을 끄면 컴포넌트가 내려간다. 개발 모드의 두 번 마운트에 지우지 않게, 다시 마운트되지 않았을 때만 비운다
	useEffect(() => {
		mounted += 1;
		return () => {
			mounted -= 1;
			queueMicrotask(() => mounted === 0 && resetTextEdit());
		};
	}, []);

	const download = () => {
		setDownloading(true);
		void downloadResume().finally(() => setDownloading(false));
	};

	useAppMenus('textedit', [
		{
			title: '파일',
			items: [{ label: 'PDF로 내보내기…', disabled: !resume || downloading, onSelect: download }],
		},
		{
			title: '편집',
			items: [{ label: '이력서 편집', disabled: !resume || !admin || editing, onSelect: () => setEditing(true) }],
		},
		{
			title: '보기',
			items: [
				{
					label: '뒤로',
					disabled: !canBack,
					shortcut: { code: 'BracketLeft', mod: true },
					onSelect: () => stepTextEdit(-1),
				},
				{
					label: '앞으로',
					disabled: !canForward,
					shortcut: { code: 'BracketRight', mod: true },
					onSelect: () => stepTextEdit(1),
				},
			],
		},
	]);

	const name = !path ? '텍스트 편집기' : resume ? `${profile.name}_이력서` : path.split('/').at(-1)!;
	const subtitle = !path ? '' : resume ? (custom ? '이력서 · 저장한 내용' : '이력서') : 'Markdown 문서 · 읽기 전용';

	return (
		<AppWindow title={name} appName="textedit" chrome="unified">
			<div className="textedit">
				<Toolbar as="header" className="textedit-toolbar">
					<span className="textedit-nav" role="group" aria-label="이동">
						<IconButton
							icon="fa-solid fa-chevron-left"
							label="뒤로"
							disabled={!canBack}
							onClick={() => stepTextEdit(-1)}
						/>
						<IconButton
							icon="fa-solid fa-chevron-right"
							label="앞으로"
							disabled={!canForward}
							onClick={() => stepTextEdit(1)}
						/>
					</span>
					<div className="textedit-title">
						<h1>{name}</h1>
						{subtitle && <p>{subtitle}</p>}
					</div>
					{resume && !editing && (
						<span className="textedit-tools">
							{admin && <IconButton icon="fa-solid fa-pen" label="이력서 편집" onClick={() => setEditing(true)} />}
							<IconButton
								icon={downloading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-file-arrow-down'}
								label={downloading ? 'PDF 만드는 중' : 'PDF 다운로드'}
								disabled={downloading}
								onClick={download}
							/>
						</span>
					)}
				</Toolbar>
				<div className="textedit-body">
					{!path ? (
						<EmptyState className="textedit-empty">Finder에서 Markdown 문서를 열면 여기에서 읽습니다.</EmptyState>
					) : resume && editing ? (
						<ResumeEditor onDone={() => setEditing(false)} />
					) : (
						<DocView
							path={path}
							dark={dark}
							onOpenDoc={openInTextEdit}
							onOpenProject={(id) => {
								openApp('safari');
								bringAppToFront('safari');
								requestOpen('safari', id);
							}}
						/>
					)}
				</div>
			</div>
		</AppWindow>
	);
};

export default TextEdit;
