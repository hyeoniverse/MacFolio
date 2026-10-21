import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseResume as checkResume, RESUME_LIMITS } from '@macfolio/contracts';
import { notify } from '@/desktop/notifications/notificationStore';
import { PROJECTS } from '@/shared/profile';
import { getProfile } from '@/shared/site/profileStore';
import { resetResume, saveResume, useResumeState } from '@/shared/site/resumeStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { importProfile, importProject } from '@/apps/finder/resumeImport';
import MarkdownToolbar from './MarkdownToolbar';
import { applyMarkdown, setHeading, type Edit, type MarkdownFormat } from './markdownFormat';

interface Props {
	/** 제목 줄 오른쪽의 자리: 불러오기·되돌리기·저장 (텍스트 편집기 창) */
	actionsSlot: HTMLElement | null;
	/** 제목 줄 아래의 자리: 서식 막대와 눈금자 */
	toolbarSlot: HTMLElement | null;
}

/** 원문 입력칸의 클래스 (편집 › 실행 취소·다시 실행이 찾는다) */
export const RESUME_FIELD = 'finder-resume-editor-field';

/**
 * 관리자의 이력서 편집기: 메모처럼 열면 바로 고친다. 원문은 이력서 Markdown 한 장이고, 저장하면 서버에 남아
 * 모든 방문자의 이력서 문서·PDF·터미널 resume가 바뀐다.
 * - 서식 막대·불러오기도 입력칸에 직접 써서(insertText) 브라우저의 실행 취소(⌘Z)·다시 실행(⇧⌘Z)에 함께 쌓인다
 * - '불러오기'로 시스템 설정의 프로필(이름·연락처)과 프로젝트(이름·기간·구분·기술·설명)를 글에 넣는다. 넣은 뒤로는 이 글의 일부다
 */
const ResumeEditor: React.FC<Props> = ({ actionsSlot, toolbarSlot }) => {
	const { markdown, custom } = useResumeState();
	const [draft, setDraft] = useState(markdown);
	const [cursor, setCursor] = useState(0);
	const [errors, setErrors] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const importButton = useRef<HTMLButtonElement>(null);
	const field = useRef<HTMLTextAreaElement>(null);
	const dirty = draft !== markdown;

	// 저장한 글이 바뀌면(저장·기본으로 되돌리기) 고치지 않은 입력칸은 그 글을 따른다
	const [shown, setShown] = useState(markdown);
	if (shown !== markdown) {
		setShown(markdown);
		if (!dirty || draft === shown) setDraft(markdown);
	}

	/**
	 * 입력칸의 글을 next로 바꾸고 [start, end)를 고른다. 바뀐 부분만 골라 insertText로 덮어써서 실행 취소에 남긴다
	 * (insertText를 못 쓰는 브라우저는 그냥 바꾼다)
	 */
	const write = (next: string, start: number, end: number) => {
		const textarea = field.current;
		if (!textarea) return;
		const current = textarea.value;
		let head = 0;
		while (head < current.length && head < next.length && current[head] === next[head]) head++;
		let tail = 0;
		while (
			tail < current.length - head &&
			tail < next.length - head &&
			current[current.length - 1 - tail] === next[next.length - 1 - tail]
		)
			tail++;
		textarea.focus();
		textarea.setSelectionRange(head, current.length - tail);
		const inserted = next.slice(head, next.length - tail);
		const ok = inserted ? document.execCommand('insertText', false, inserted) : document.execCommand('delete', false);
		if (!ok || textarea.value !== next) setDraft(next);
		textarea.setSelectionRange(start, end);
		setCursor(start);
	};

	const applyEdit = (make: (start: number, end: number) => Edit) => {
		const textarea = field.current;
		if (!textarea) return;
		const edit = make(textarea.selectionStart, textarea.selectionEnd);
		write(edit.text, edit.start, edit.end);
	};
	const applyFormat = (format: MarkdownFormat) => applyEdit((start, end) => applyMarkdown(draft, start, end, format));

	/** 불러온 글로 바꾸고, 처음 달라진 곳으로 커서를 옮긴다 */
	const replaceDraft = (next: string) => {
		const at = Math.max(
			0,
			[...next].findIndex((char, index) => char !== draft[index])
		);
		write(next, at, at);
	};

	const importItems: MenuItem[] = [
		{
			label: '프로필 (이름·연락처)',
			icon: 'fa-solid fa-user',
			hint: '시스템 설정 › 정보의 이름·이메일·GitHub로 머리를 바꿉니다. 직함과 한 줄 소개는 그대로 둡니다',
			onSelect: () => replaceDraft(importProfile(draft, getProfile(), location.host)),
		},
		'separator',
		{ heading: '프로젝트 (시스템 설정 › 프로젝트)' },
		...PROJECTS.map((project): MenuItem => ({
			label: project.name,
			icon: 'fa-solid fa-folder',
			hint: '이름·기간·구분·기술·설명을 넣습니다. 이미 있으면 그 부분만 지금 값으로 바꾸고 성과는 그대로 둡니다',
			onSelect: () => {
				const result = importProject(draft, project);
				replaceDraft(result.markdown);
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
		const result = await saveResume(parsed.value.markdown);
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		setDraft(parsed.value.markdown);
		notify({ app: 'finder', title: '이력서를 저장했습니다', body: '이력서 문서·PDF·터미널 resume에 바로 보입니다.' });
	};

	const reset = async () => {
		setConfirmingReset(false);
		setBusy(true);
		const result = await resetResume();
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
	};

	// 제목 줄: [불러오기] │ [되돌리기] [저장] — 모두 같은 높이의 회색 알약, 저장만 파랗게
	const actions = (
		<span className="textedit-actions">
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
			<button
				type="button"
				className="textedit-action"
				disabled={busy || !dirty}
				title="저장하지 않은 변경을 버리고 저장한 글로 되돌립니다"
				onClick={() => write(markdown, 0, 0)}
			>
				변경 취소
			</button>
			<button type="button" className="textedit-action primary" disabled={busy || !dirty} onClick={() => void save()}>
				{busy ? '저장 중…' : '저장'}
			</button>
		</span>
	);

	const toolbar = (
		<MarkdownToolbar
			text={draft}
			cursor={cursor}
			onFormat={applyFormat}
			onHeading={(next) => applyEdit((start, end) => setHeading(draft, start, end, next))}
		/>
	);

	return (
		<div className="finder-resume-editor">
			{actionsSlot && createPortal(actions, actionsSlot)}
			{toolbarSlot && createPortal(toolbar, toolbarSlot)}
			{errors.length > 0 && (
				<ul className="finder-resume-editor-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}
			<textarea
				ref={field}
				className={RESUME_FIELD}
				aria-label="이력서 Markdown"
				spellCheck={false}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
				onKeyDown={(event) => {
					// ⌘S: 저장
					if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
						event.preventDefault();
						if (dirty && !busy) void save();
					}
				}}
			/>
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
