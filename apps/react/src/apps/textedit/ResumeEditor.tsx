import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseResume as checkResume, RESUME_LIMITS } from '@macfolio/contracts';
import { notify } from '@/desktop/notifications/notificationStore';
import { PROJECTS } from '@/shared/profile';
import { getProfile } from '@/shared/site/profileStore';
import { resetResume, saveResume, useResumeState, type ResumeLang } from '@/shared/site/resumeStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { importProfile, importProject } from '@/apps/finder/resumeImport';
import MarkdownToolbar from './MarkdownToolbar';
import { EMPTY_RICH_STATE, type RichControls, type RichState } from './richControls';

const ResumeRichEditor = lazy(() => import('./ResumeRichEditor'));

/** 편집 › 실행 취소·다시 실행이 부를 명령 */
export interface EditHistory {
	undo: () => void;
	redo: () => void;
}

interface Props {
	/** 고칠 이력서: 국문 ko, 영문 en */
	lang: ResumeLang;
	/** 보기 › Markdown 원문 보기: 서식 없이 원문을 고친다 */
	source: boolean;
	/** 제목 줄 오른쪽의 자리: 불러오기·변경 취소·저장 (텍스트 편집기 창) */
	actionsSlot: HTMLElement | null;
	/** 제목 줄 아래의 자리: 서식 막대와 눈금자 */
	toolbarSlot: HTMLElement | null;
	/** 편집 › 실행 취소·다시 실행이 쓸 명령 (편집 방식이 바뀔 때마다 알린다) */
	onHistory: (history: EditHistory | null) => void;
}

/** 원문 입력칸의 클래스 */
export const RESUME_FIELD = 'finder-resume-editor-field';

/**
 * 관리자의 이력서 편집기: 메모처럼 열면 서식이 입혀진 그대로 고친다 (Milkdown). 원문은 이력서 Markdown 한 장이고,
 * 저장하면 서버에 남아 모든 방문자의 이력서 문서·PDF·터미널 resume가 바뀐다.
 * - 서식 막대·단축키(⌘B ⌘I)로 서식을, ⌘Z·⇧⌘Z로 실행 취소·다시 실행(불러오기와 변경 취소도 되돌린다), ⌘S로 저장
 * - '불러오기'(국문만)로 시스템 설정의 프로필과 프로젝트를 글에 넣는다. 넣은 뒤로는 이 글의 일부다
 * - 보기 › Markdown 원문 보기로 서식 없이 원문을 직접 고칠 수 있다
 */
const ResumeEditor: React.FC<Props> = ({ lang, source, actionsSlot, toolbarSlot, onHistory }) => {
	const { markdown, custom } = useResumeState(lang);
	const [draft, setDraft] = useState(markdown);
	const [richState, setRichState] = useState<RichState>(EMPTY_RICH_STATE);
	const [errors, setErrors] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const importButton = useRef<HTMLButtonElement>(null);
	const field = useRef<HTMLTextAreaElement>(null);
	const controls = useRef<RichControls | null>(null);
	// 원문 보기에서 돌아오면(또는 기본 이력서로 되돌리면) 서식 편집기를 그 글로 새로 만든다
	const [richKey, setRichKey] = useState(0);
	const [wasSource, setWasSource] = useState(source);
	if (wasSource !== source) {
		setWasSource(source);
		if (!source) setRichKey((key) => key + 1);
	}
	const dirty = draft.trim() !== markdown.trim();

	// 기본 이력서로 되돌린 뒤에는 고치지 않은 입력도 그 글을 따른다
	const [shown, setShown] = useState(markdown);
	if (shown !== markdown) {
		setShown(markdown);
		if (draft.trim() === shown.trim()) {
			setDraft(markdown);
			setRichKey((key) => key + 1);
		}
	}

	// 실행 취소·다시 실행: 서식 편집기는 그 기록, 원문은 브라우저의 입력칸 기록
	useEffect(() => {
		if (source) {
			const native = (command: 'undo' | 'redo') => () => {
				field.current?.focus();
				document.execCommand(command);
			};
			onHistory({ undo: native('undo'), redo: native('redo') });
		} else onHistory({ undo: () => controls.current?.undo(), redo: () => controls.current?.redo() });
		return () => onHistory(null);
	}, [source, onHistory]);

	/** 글 전체를 바꾼다 (불러오기, 변경 취소). 서식 편집기에서는 실행 취소로 되돌릴 수 있다 */
	const replace = (next: string) => {
		setDraft(next);
		if (!source) controls.current?.replace(next);
	};

	const importItems: MenuItem[] = [
		{
			label: '프로필 (이름·연락처)',
			icon: 'fa-solid fa-user',
			hint: '시스템 설정 › 정보의 이름·이메일·GitHub로 머리를 바꿉니다. 직함과 한 줄 소개는 그대로 둡니다',
			onSelect: () => replace(importProfile(draft, getProfile(), location.host)),
		},
		'separator',
		{ heading: '프로젝트 (시스템 설정 › 프로젝트)' },
		...PROJECTS.map((project): MenuItem => ({
			label: project.name,
			icon: 'fa-solid fa-folder',
			hint: '이름·기간·구분·기술·설명을 넣습니다. 이미 있으면 그 부분만 지금 값으로 바꾸고 성과는 그대로 둡니다',
			onSelect: () => {
				const result = importProject(draft, project);
				replace(result.markdown);
				notify({
					app: 'finder',
					title: result.replaced ? `${project.name}을(를) 지금 값으로 바꿨습니다` : `${project.name}을(를) 넣었습니다`,
					body: result.replaced ? '성과 줄은 그대로 두었습니다.' : '프로젝트 절 끝에 넣었습니다. 성과를 써 주세요.',
				});
			},
		})),
		...(custom
			? (['separator', { label: '기본 이력서로 되돌리기…', onSelect: () => setConfirmingReset(true) }] as MenuItem[])
			: []),
	];

	const save = async () => {
		// 서버와 같은 규칙으로 먼저 확인한다 (서버도 다시 확인한다)
		const parsed = checkResume({ markdown: draft });
		if ('errors' in parsed) return setErrors(parsed.errors);
		setErrors([]);
		setBusy(true);
		const result = await saveResume(parsed.value.markdown, lang);
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		setDraft(parsed.value.markdown);
		notify({ app: 'finder', title: '이력서를 저장했습니다', body: '이력서 문서·PDF·터미널 resume에 바로 보입니다.' });
	};

	const reset = async () => {
		setConfirmingReset(false);
		setBusy(true);
		const result = await resetResume(lang);
		setBusy(false);
		if (!result.ok) setErrors(result.errors);
	};

	const saveKey = (event: React.KeyboardEvent) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			if (dirty && !busy) void save();
		}
	};

	// 제목 줄: [불러오기 ▾] │ [변경 취소] [저장] — 모두 같은 높이의 회색 알약, 저장만 파랗게
	const actions = (
		<span className="textedit-actions">
			{lang === 'ko' && (
				<>
					<button
						ref={importButton}
						type="button"
						className="textedit-action"
						aria-haspopup="menu"
						aria-expanded={menu !== null}
						onClick={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							setMenu(menu ? null : { x: rect.left, y: rect.bottom + 4 });
						}}
					>
						<i className="fa-solid fa-file-import" aria-hidden="true" />
						불러오기
						<i className="fa-solid fa-chevron-down textedit-action-caret" aria-hidden="true" />
					</button>
					<span className="textedit-actions-divider" aria-hidden="true" />
				</>
			)}
			<button
				type="button"
				className="textedit-action"
				disabled={busy || !dirty}
				title="저장하지 않은 변경을 버리고 저장한 글로 되돌립니다"
				onClick={() => replace(markdown)}
			>
				변경 취소
			</button>
			<button type="button" className="textedit-action primary" disabled={busy || !dirty} onClick={() => void save()}>
				{busy ? '저장 중…' : '저장'}
			</button>
		</span>
	);

	// 서식 막대: 원문 보기에서는 꺼진 채로 (원문은 Markdown 기호를 직접 쓴다)
	const toolbar = source ? (
		<MarkdownToolbar />
	) : (
		<MarkdownToolbar
			state={richState}
			onFormat={(format) => controls.current?.format(format)}
			onHeading={(level) => controls.current?.heading(level)}
		/>
	);

	return (
		<div className="finder-resume-editor" onKeyDown={saveKey}>
			{actionsSlot && createPortal(actions, actionsSlot)}
			{toolbarSlot && createPortal(toolbar, toolbarSlot)}
			{errors.length > 0 && (
				<ul className="finder-resume-editor-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}
			{source ? (
				<textarea
					ref={field}
					className={RESUME_FIELD}
					aria-label="이력서 Markdown"
					spellCheck={false}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
			) : (
				<div className="textedit-rich-scroll">
					<Suspense fallback={null}>
						<ResumeRichEditor
							key={richKey}
							markdown={draft}
							onChange={setDraft}
							onState={setRichState}
							onReady={(next) => (controls.current = next)}
						/>
					</Suspense>
				</div>
			)}
			{/* 글자 수: 오른쪽 아래 구석에 작게 */}
			<span className="finder-resume-editor-count" aria-live="polite">
				{dirty && <span className="finder-resume-editor-dirty">저장 안 됨 · </span>}
				{draft.length.toLocaleString('ko-KR')} / {RESUME_LIMITS.markdown.toLocaleString('ko-KR')}자
			</span>
			{menu && (
				<Menu label="불러오기" anchor={menu} items={importItems} trigger={importButton} onClose={() => setMenu(null)} />
			)}
			{confirmingReset && (
				<AlertDialog
					title="기본 이력서로 되돌릴까요?"
					message="저장한 이력서를 지우고, 코드에 적힌 기본 이력서를 다시 보여 줍니다."
					confirmLabel="되돌리기"
					onConfirm={() => void reset()}
					onCancel={() => setConfirmingReset(false)}
				/>
			)}
		</div>
	);
};

export default ResumeEditor;
