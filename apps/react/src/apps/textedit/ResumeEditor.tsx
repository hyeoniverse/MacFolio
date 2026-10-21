import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseResume as checkResume, RESUME_LIMITS } from '@macfolio/contracts';
import { notify } from '@/desktop/notifications/notificationStore';
import { PROJECTS } from '@/shared/profile';
import { getProfile } from '@/shared/site/profileStore';
import { resetResume, saveResume, useResumeState } from '@/shared/site/resumeStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { importProfile, importProject } from '@/apps/finder/resumeImport';
import { applyMarkdown, headingAt, setHeading, type Edit, type MarkdownFormat } from './markdownFormat';

/** Markdown 서식 막대 (macOS 텍스트 편집기의 서식 막대 모양): 묶음마다 [형식, 이름, 아이콘 또는 글자] */
const TEXT_TOOLS: [MarkdownFormat, string, string][] = [
	['bold', '굵게', 'B'],
	['italic', '기울임', 'I'],
	['strike', '취소선', 'S'],
	['code', '코드(기술 칩)', '</>'],
];
const LINE_TOOLS: [MarkdownFormat, string, string][] = [
	['list', '글머리 목록', 'fa-solid fa-list-ul'],
	['ordered', '번호 목록', 'fa-solid fa-list-ol'],
	['quote', '인용(한 줄 소개)', 'fa-solid fa-quote-left'],
];
const HEADINGS = ['본문', '제목 1', '제목 2', '제목 3'];
/** 눈금자 숫자: 1칸(1cm)은 늘 같은 너비라, 창을 넓히면 숫자가 더 보일 뿐 간격은 그대로다 (넘치는 숫자는 잘린다) */
const RULER = Array.from({ length: 26 }, (_, index) => index * 2);
const RULER_CM = 38;

interface Props {
	/** 저장하거나 취소하면 보기로 돌아간다 */
	onDone: () => void;
	/** 불러오기·저장 같은 문서 단위 버튼을 둘 제목 줄의 자리 (텍스트 편집기 창). 없으면 서식 막대 끝에 둔다 */
	actionsSlot?: HTMLElement | null;
}

/**
 * 관리자의 이력서 편집기: 이력서 Markdown 한 장을 그 자리에서 고친다 (메모 앱처럼 보는 화면이 곧 편집하는 화면).
 * 저장하면 서버에 남아 모든 방문자의 이력서 문서·PDF·터미널 resume가 바뀐다.
 * '불러오기'로 시스템 설정의 프로필(이름·연락처)과 프로젝트(이름·기간·구분·기술·설명)를 글에 넣는다. 넣은 뒤로는 이 글의 일부다
 */
const ResumeEditor: React.FC<Props> = ({ onDone, actionsSlot }) => {
	const [level, setLevel] = useState(0);
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

	/** 입력칸의 글을 바꾸고, 바꾼 범위를 다시 고른다 */
	const applyEdit = (make: (start: number, end: number) => Edit) => {
		const textarea = field.current;
		if (!textarea) return;
		const edit = make(textarea.selectionStart, textarea.selectionEnd);
		setDraft(edit.text);
		setLevel(headingAt(edit.text, edit.start));
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(edit.start, edit.end);
		});
	};
	const applyFormat = (format: MarkdownFormat) => applyEdit((start, end) => applyMarkdown(draft, start, end, format));
	/** 커서가 옮겨 가면 문단 스타일 팝업도 그 줄을 따른다 */
	const followCursor = () => {
		const textarea = field.current;
		if (textarea) setLevel(headingAt(textarea.value, textarea.selectionStart));
	};

	const tool = ([format, label, face]: [MarkdownFormat, string, string]) => (
		<button
			key={format}
			type="button"
			className={`textedit-tool textedit-tool-${format}`}
			aria-label={label}
			title={label}
			// 누르는 동안 입력칸의 선택이 풀리지 않게
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => applyFormat(format)}
		>
			{face.startsWith('fa-') ? <i className={face} aria-hidden="true" /> : face}
		</button>
	);

	const actions = (
		<span className="textedit-actions">
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
		</span>
	);

	return (
		<div className="finder-resume-editor">
			{actionsSlot ? createPortal(actions, actionsSlot) : actions}
			<div className="textedit-format" role="toolbar" aria-label="Markdown 서식">
				<span className="textedit-seg">{TEXT_TOOLS.map(tool)}</span>
				<button
					type="button"
					className="textedit-chip textedit-tool-link"
					aria-label="링크"
					title="링크"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => applyFormat('link')}
				>
					<i className="fa-solid fa-link" aria-hidden="true" />
				</button>
				<label className="textedit-chip textedit-popup">
					<select
						aria-label="문단 스타일"
						value={level}
						onChange={(event) => {
							const next = Number(event.target.value);
							applyEdit((start, end) => setHeading(draft, start, end, next));
						}}
					>
						{HEADINGS.map((name, index) => (
							<option key={name} value={index}>
								{name}
							</option>
						))}
					</select>
					<i className="fa-solid fa-sort" aria-hidden="true" />
				</label>
				<span className="textedit-seg textedit-seg-wide">{LINE_TOOLS.map(tool)}</span>
			</div>
			<div className="textedit-ruler" aria-hidden="true">
				{RULER.map((mark) => (
					<span key={mark} style={{ left: mark * RULER_CM }}>
						{mark}
					</span>
				))}
			</div>
			{errors.length > 0 && (
				<ul className="finder-resume-editor-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}
			<textarea
				ref={field}
				className="finder-resume-editor-field"
				aria-label="이력서 Markdown"
				spellCheck={false}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onSelect={followCursor}
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
