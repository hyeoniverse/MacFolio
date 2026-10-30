import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useCanEditMemo } from '@/apps/memo/useCanEditMemo';
import DocView from '@/apps/finder/DocView';
import { downloadResume, resumeFileName } from '@/apps/finder/resumeDownload';
import { withExtension } from '@/apps/finder/files';
import { parseResume, resumeLangOf } from '@/apps/finder/resumeModel';
import { useResume } from '@/shared/site/resumeStore';
import { useProfile } from '@/shared/site/profileStore';
import { useResolvedTheme } from '@/shared/settings/settingsStore';
import OpenPanel, { type OpenPanelApp } from '@/apps/preview/OpenPanel';
import { requestOpen } from '@/shared/lib/openRequest';
import MarkdownToolbar from './MarkdownToolbar';
import ResumeEditor, { type EditHistory } from './ResumeEditor';
import { resetTextEdit, stepTextEdit, useTextEdit, openInTextEdit } from './textEditStore';
import { fileNameOf, isRemoteFile } from '@/shared/lib/fileApps';
import './TextEdit.css';

let mounted = 0;

/** 문서 없이 열면 뜨는 열기 창: Markdown 문서(저장소 문서·이력서)만 고를 수 있다 */
const OPEN_APP: OpenPanelApp = {
	name: '텍스트 편집기',
	icon: '/imgs/textedit.svg',
	canOpen: (item) => item.kind === 'doc',
};

/**
 * 텍스트 편집기 (macOS TextEdit). Finder에서 Markdown 문서(.md)를 열면 뜬다: 저장소 문서(README, docs/…)와 이력서.
 * - 보기: Markdown을 서식 있는 문서처럼 그린다 (DocView). 문서 링크는 이 창 안에서 옮겨 가고, 보기 › 뒤로·앞으로(⌘[ ⌘])로 돌아온다
 * - 이력서(국문·영문): PDF 다운로드(파일 › PDF로 내보내기…). 관리자는 메모처럼 열면 서식대로 바로 고친다
 *   (실행 취소·다시 실행, ⌘S 저장, 보기 › Markdown 원문 보기)
 * - 문서 없이 열면 미리보기·QuickTime Player처럼 열기 창이 뜬다
 * - 저장소 문서는 코드 파일이라 읽기만 한다. 휴대폰은 파일 앱 안에서 읽는다 (iOS에는 텍스트 편집기가 없다)
 */
const TextEdit: React.FC = () => {
	const { path, canBack, canForward } = useTextEdit();
	const { apps, openApp, closeApp, bringAppToFront } = useAppState();
	const admin = useCanEditMemo();
	const profile = useProfile();
	const dark = useResolvedTheme() === 'dark';
	// 보기 › Markdown 원문 보기 (관리자가 이력서를 서식 없이 고칠 때)
	const [source, setSource] = useState(false);
	const [editHistory, setEditHistory] = useState<EditHistory | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [actionsSlot, setActionsSlot] = useState<HTMLSpanElement | null>(null);
	const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
	// 이력서 문서면 그 언어 (국문 ko, 영문 en)
	const lang = resumeLangOf(path);
	const resume = lang !== null;
	const englishName = parseResume(useResume('en')).name;
	// 관리자는 이력서를 열면 바로 서식대로 고친다 (메모처럼)
	const editing = resume && admin;

	// 다른 문서로 가면 원문 보기를 끈다
	const [shownPath, setShownPath] = useState(path);
	if (shownPath !== path) {
		setShownPath(path);
		setSource(false);
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
		void downloadResume(lang ?? 'ko').finally(() => setDownloading(false));
	};

	useAppMenus('textedit', [
		{
			title: '파일',
			items: [{ label: 'PDF로 내보내기…', disabled: !resume || downloading, onSelect: download }],
		},
		{
			title: '편집',
			items: [
				{
					label: '실행 취소',
					disabled: !editHistory,
					shortcut: { code: 'KeyZ', mod: true },
					onSelect: () => editHistory?.undo(),
				},
				{
					label: '다시 실행',
					disabled: !editHistory,
					shortcut: { code: 'KeyZ', mod: true, shift: true },
					onSelect: () => editHistory?.redo(),
				},
			],
		},
		{
			title: '보기',
			items: [
				{
					label: source ? '서식대로 보기' : 'Markdown 원문 보기',
					disabled: !editing,
					onSelect: () => setSource((on) => !on),
				},
				'separator',
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

	// 문서 이름: Finder와 같다 (이력서는 이름에, 저장소 문서는 경로에서 확장자를 그대로)
	const name = !path
		? '텍스트 편집기'
		: lang
			? withExtension({
					kind: 'doc',
					id: path,
					path,
					name: resumeFileName(lang, lang === 'en' ? englishName : profile.name),
				}).name
			: isRemoteFile(path)
				? fileNameOf(path)
				: path.split('/').at(-1)!;
	// macOS처럼 제목 뒤에 문서 상태를 붙인다 (저장소 문서는 잠긴 문서)
	const status = !path ? '' : resume ? (source ? '원문' : '') : '잠김';
	const title = status ? `${name} — ${status}` : name;

	if (!path)
		return (
			<AppWindow title="텍스트 편집기" appName="textedit">
				<OpenPanel
					app={OPEN_APP}
					onOpen={(item) => item.kind === 'doc' && openInTextEdit(item.path)}
					onCancel={() => closeApp('textedit')}
				/>
			</AppWindow>
		);

	return (
		<AppWindow title={title} appName="textedit" chrome="unified">
			<div className="textedit">
				<header className="textedit-head">
					{/* 제목 줄: 신호등 옆에 문서 이름, 오른쪽에 문서 단위 버튼 */}
					<div className="textedit-titlebar">
						<h1 className="textedit-title">{title}</h1>
						{resume && (
							<span className="textedit-actions">
								<button
									type="button"
									className="textedit-action"
									aria-label={downloading ? 'PDF 만드는 중' : 'PDF 다운로드'}
									title="이력서를 PDF로 내려받습니다"
									disabled={downloading}
									onClick={download}
								>
									<i
										className={downloading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-file-arrow-down'}
										aria-hidden="true"
									/>
									PDF
								</button>
							</span>
						)}
						{/* 편집 중: 편집기가 불러오기·변경 취소·저장을 여기에 둔다 */}
						{editing && <span className="textedit-actions-divider" aria-hidden="true" />}
						<span ref={setActionsSlot} className="textedit-actions-slot" />
					</div>
					{/* 서식 막대와 눈금자: 편집 중에는 편집기가 채우고, 읽기에는 꺼진 채로 (잠긴 문서) */}
					<div ref={setToolbarSlot} className="textedit-toolbar-slot">
						{!editing && <MarkdownToolbar />}
					</div>
				</header>
				<div className="textedit-body">
					{editing ? (
						<ResumeEditor
							key={lang}
							lang={lang ?? 'ko'}
							source={source}
							actionsSlot={actionsSlot}
							toolbarSlot={toolbarSlot}
							onHistory={setEditHistory}
						/>
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
