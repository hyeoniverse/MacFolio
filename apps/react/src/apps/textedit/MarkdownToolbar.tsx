import type { MarkdownFormat } from './markdownFormat';
import { EMPTY_RICH_STATE, type RichState } from './richControls';

/** 글자 묶음 (macOS 서식 막대의 B I U S 자리): [형식, 이름, 글자] */
const TEXT_TOOLS: [MarkdownFormat, string, string][] = [
	['bold', '굵게', 'B'],
	['italic', '기울임', 'I'],
	['strike', '취소선', 'S'],
	['code', '코드(기술 칩)', '</>'],
];
/** 줄 묶음 (정렬 자리): 지금 줄의 종류가 파랗게 켜진다 */
const LINE_TOOLS: ['list' | 'ordered' | 'quote', string, string][] = [
	['list', '글머리 목록', 'fa-solid fa-list-ul'],
	['ordered', '번호 목록', 'fa-solid fa-list-ol'],
	['quote', '인용', 'fa-solid fa-quote-left'],
];
const HEADINGS = ['본문', '제목 1', '제목 2', '제목 3'];
/** 눈금자: 1cm는 늘 같은 너비라 창을 넓히면 숫자가 더 보일 뿐 간격은 그대로다 (넘치는 숫자는 잘린다) */
const RULER_CM = 38;
const RULER = Array.from({ length: 26 }, (_, index) => index * 2);
/** 탭 멈춤(▶): 1.25cm마다 */
const TABS = Array.from({ length: 40 }, (_, index) => (index + 1) * 1.25);

interface Props {
	/** 커서 자리의 서식 (켜진 버튼, 문단 스타일) */
	state?: RichState;
	/** 없으면 읽기 전용: 버튼이 모두 꺼진다 (잠긴 문서의 서식 막대) */
	onFormat?: (format: MarkdownFormat) => void;
	onHeading?: (level: number) => void;
}

/**
 * 텍스트 편집기의 Markdown 서식 막대와 눈금자. 모양은 macOS 텍스트 편집기의 서식 막대를 따르고,
 * 버튼은 Markdown이 가진 서식만 둔다 (글자 묶음 · 링크 · 문단 스타일 · 줄 묶음)
 */
const MarkdownToolbar = ({ state = EMPTY_RICH_STATE, onFormat, onHeading }: Props) => {
	const disabled = !onFormat;
	const { level, kind, marks } = state;
	const markOn: Partial<Record<MarkdownFormat, boolean>> = {
		bold: marks.bold,
		italic: marks.italic,
		strike: marks.strike,
		code: marks.code,
		link: marks.link,
	};
	const button = (format: MarkdownFormat, label: string, face: string, on = false) => (
		<button
			key={format}
			type="button"
			className={`textedit-tool textedit-tool-${format}${on ? ' on' : ''}`}
			aria-label={label}
			aria-pressed={on || undefined}
			title={label}
			disabled={disabled}
			// 누르는 동안 입력칸의 선택이 풀리지 않게
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onFormat?.(format)}
		>
			{face.startsWith('fa-') ? <i className={face} aria-hidden="true" /> : face}
		</button>
	);

	return (
		<>
			<div className="textedit-format" role="toolbar" aria-label="Markdown 서식">
				<span className="textedit-seg">
					{TEXT_TOOLS.map(([format, label, face]) => button(format, label, face, markOn[format]))}
				</span>
				<span className="textedit-square">{button('link', '링크', 'fa-solid fa-link', marks.link)}</span>
				<label className="textedit-popup">
					<select
						aria-label="문단 스타일"
						value={level}
						disabled={disabled}
						onChange={(event) => onHeading?.(Number(event.target.value))}
					>
						{HEADINGS.map((name, index) => (
							<option key={name} value={index}>
								{name}
							</option>
						))}
					</select>
					<i className="fa-solid fa-sort" aria-hidden="true" />
				</label>
				<span className="textedit-seg textedit-seg-lines">
					{LINE_TOOLS.map(([format, label, icon]) => button(format, label, icon, kind === format))}
				</span>
			</div>
			<div className="textedit-ruler" aria-hidden="true">
				<span className="textedit-ruler-indent" />
				{TABS.map((cm) => (
					<span key={cm} className="textedit-ruler-tab" style={{ left: cm * RULER_CM }} />
				))}
				{RULER.map((mark) => (
					<span key={mark} className="textedit-ruler-number" style={{ left: mark * RULER_CM }}>
						{mark}
					</span>
				))}
			</div>
		</>
	);
};

export default MarkdownToolbar;
