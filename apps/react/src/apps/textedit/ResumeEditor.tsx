import { useRef, useState } from 'react';
import { parseResume as checkResume, RESUME_LIMITS } from '@macfolio/contracts';
import { notify } from '@/desktop/notifications/notificationStore';
import { PROJECTS } from '@/shared/profile';
import { getProfile } from '@/shared/site/profileStore';
import { resetResume, saveResume, useResumeState } from '@/shared/site/resumeStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { importProfile, importProject } from '@/apps/finder/resumeImport';
import { applyMarkdown, type MarkdownFormat } from './markdownFormat';

/** Markdown 도구 막대의 버튼: [형식, 이름, 아이콘(Font Awesome) 또는 글자] */
const TOOLS: [MarkdownFormat, string, string][] = [
	['heading', '제목', 'fa-solid fa-heading'],
	['bold', '굵게', 'fa-solid fa-bold'],
	['italic', '기울임', 'fa-solid fa-italic'],
	['code', '코드(기술 칩)', 'fa-solid fa-code'],
	['link', '링크', 'fa-solid fa-link'],
	['list', '목록', 'fa-solid fa-list-ul'],
	['quote', '인용(한 줄 소개)', 'fa-solid fa-quote-left'],
];

interface Props {
	/** 저장하거나 취소하면 보기로 돌아간다 */
	onDone: () => void;
}

/**
 * 관리자의 이력서 편집기: 이력서 Markdown 한 장을 그 자리에서 고친다 (메모 앱처럼 보는 화면이 곧 편집하는 화면).
 * 저장하면 서버에 남아 모든 방문자의 이력서 문서·PDF·터미널 resume가 바뀐다.
 * '불러오기'로 시스템 설정의 프로필(이름·연락처)과 프로젝트(이름·기간·구분·기술·설명)를 글에 넣는다. 넣은 뒤로는 이 글의 일부다
 */
const ResumeEditor: React.FC<Props> = ({ onDone }) => {
	const { markdown, custom } = useResumeState();
	const [draft, setDraft] = useState(markdown);
	const [errors, setErrors] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const importButton = useRef<HTMLButtonElement>(null);
	const field = useRef<HTMLTextAreaElement>(null);

	/** 불러온 글로 바꾸고, 바뀐 곳(처음 달라진 줄)으로 커서를 옮긴다 */
	const replaceDraft = (next: string) => {
		setDraft(next);
		const at = [...next].findIndex((char, index) => char !== draft[index]);
		requestAnimationFrame(() => {
			const textarea = field.current;
			if (!textarea) return;
			textarea.focus();
			textarea.setSelectionRange(Math.max(0, at), Math.max(0, at));
		});
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
	];

	const save = async () => {
		// 서버와 같은 규칙으로 먼저 확인한다 (서버도 다시 확인한다)
		const parsed = checkResume({ markdown: draft });
		if ('errors' in parsed) return setErrors(parsed.errors);
		setBusy(true);
		const result = await saveResume(parsed.value.markdown);
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		notify({ app: 'finder', title: '이력서를 저장했습니다', body: '이력서 문서·PDF·터미널 resume에 바로 보입니다.' });
		onDone();
	};

	const reset = async () => {
		setConfirmingReset(false);
		setBusy(true);
		const result = await resetResume();
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		onDone();
	};

	/** 고른 글자에 Markdown 서식을 넣고, 바꾼 범위를 다시 고른다 */
	const applyFormat = (format: MarkdownFormat) => {
		const textarea = field.current;
		if (!textarea) return;
		const edit = applyMarkdown(draft, textarea.selectionStart, textarea.selectionEnd, format);
		setDraft(edit.text);
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(edit.start, edit.end);
		});
	};

	return (
		<div className="finder-resume-editor">
			<div className="finder-resume-editor-bar" role="toolbar" aria-label="이력서 편집">
				<Button
					ref={importButton}
					icon="fa-solid fa-file-import"
					aria-haspopup="menu"
					aria-expanded={menu !== null}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						setMenu(menu ? null : { x: rect.left, y: rect.bottom + 4 });
					}}
				>
					불러오기
				</Button>
				{custom && (
					<Button disabled={busy} onClick={() => setConfirmingReset(true)}>
						기본 이력서로 되돌리기
					</Button>
				)}
				<span className="finder-resume-editor-count" aria-live="polite">
					{draft.length.toLocaleString('ko-KR')} / {RESUME_LIMITS.markdown.toLocaleString('ko-KR')}
				</span>
				<Button disabled={busy} onClick={onDone}>
					취소
				</Button>
				<Button tone="primary" disabled={busy || draft === markdown} onClick={() => void save()}>
					저장
				</Button>
			</div>
			{errors.length > 0 && (
				<ul className="finder-resume-editor-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}
			<div className="textedit-md-tools" role="toolbar" aria-label="Markdown 서식">
				{TOOLS.map(([format, label, icon]) => (
					<button
						key={format}
						type="button"
						className="textedit-md-tool"
						aria-label={label}
						title={label}
						// 누르는 동안 입력칸의 선택이 풀리지 않게
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => applyFormat(format)}
					>
						<i className={icon} aria-hidden="true" />
					</button>
				))}
			</div>
			<textarea
				ref={field}
				className="finder-resume-editor-field"
				aria-label="이력서 Markdown"
				spellCheck={false}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
			/>
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
