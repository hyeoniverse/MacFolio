import { useEditorControls, type FormatAction } from './editorControls';
import { keepFocus } from './usePopover';
import IconButton from '@/shared/ui/button/IconButton';

const TOOLS: { label: string; icon: string; action: FormatAction }[] = [
	{ label: '내어쓰기', icon: 'fa-solid fa-outdent', action: { type: 'indent', dir: 'out' } },
	{ label: '들여쓰기', icon: 'fa-solid fa-indent', action: { type: 'indent', dir: 'in' } },
	{ label: '위로 옮기기', icon: 'fa-solid fa-arrow-up', action: { type: 'moveBlock', dir: 'up' } },
	{ label: '아래로 옮기기', icon: 'fa-solid fa-arrow-down', action: { type: 'moveBlock', dir: 'down' } },
];

/**
 * 휴대폰 서식 막대의 문단 도구 (iOS 메모의 문단 막대처럼): 내어쓰기·들여쓰기, 문단을 위·아래로 옮기기, 블록 인용, 구분점 목록.
 * 닫기(×)를 누르면 원래 서식 도구로 돌아간다
 */
const ParagraphTools = ({ onClose }: { onClose: () => void }) => {
	const { state, run } = useEditorControls();
	if (!run) return null;
	const quick = { onPointerDown: keepFocus, onMouseDown: keepFocus };
	return (
		<>
			{TOOLS.map(({ label, icon, action }) => (
				<IconButton
					key={label}
					className="memo-format-quick"
					label={label}
					{...quick}
					onClick={() => run(action)}
					icon={icon}
				/>
			))}
			<IconButton
				className="memo-format-quick"
				on={state.quote}
				label="블록 인용"
				aria-pressed={state.quote}
				{...quick}
				onClick={() => run({ type: 'quote' })}
				icon="fa-solid fa-quote-left"
			/>
			<IconButton
				className="memo-format-quick"
				on={state.list === 'bullet'}
				label="구분점 목록"
				aria-pressed={state.list === 'bullet'}
				{...quick}
				onClick={() => run({ type: 'list', list: 'bullet' })}
				icon="fa-solid fa-list-ul"
			/>
			<IconButton
				className="memo-format-quick"
				label="문단 도구 닫기"
				{...quick}
				onClick={onClose}
				icon="fa-solid fa-xmark"
			/>
		</>
	);
};

export default ParagraphTools;
