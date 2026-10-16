import type React from 'react';
import { useEditorControls, type FormatAction } from './editorControls';
import { keepFocus } from './usePopover';
import IconButton from '@/shared/ui/button/IconButton';

/**
 * 문단 옮기기 아이콘: 왼쪽 화살표와 오른쪽 문단 세 줄. 화살표만 있으면 스크롤·커서 이동처럼 보여서 '이 문단을 옮긴다'는 뜻이 드러나게 한다.
 * 크기와 굵기는 옆의 Font Awesome 아이콘(1em, 들여쓰기·내어쓰기)에 맞춘다
 */
const MoveIcon = ({ dir }: { dir: 'up' | 'down' }) => (
	<svg className="memo-move-icon" viewBox="0 0 20 20" width="1.25em" height="1.25em" aria-hidden="true">
		<g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
			{dir === 'up' ? <path d="M5 16.5V3.5M1.5 7 5 3.5 8.5 7" /> : <path d="M5 3.5v13M1.5 13 5 16.5 8.5 13" />}
			<path d="M12 5h6.5M12 10h6.5M12 15h6.5" />
		</g>
	</svg>
);

const TOOLS: { label: string; icon: string | React.ReactNode; action: FormatAction }[] = [
	{ label: '내어쓰기', icon: 'fa-solid fa-outdent', action: { type: 'indent', dir: 'out' } },
	{ label: '들여쓰기', icon: 'fa-solid fa-indent', action: { type: 'indent', dir: 'in' } },
	{ label: '위로 옮기기', icon: <MoveIcon dir="up" />, action: { type: 'moveBlock', dir: 'up' } },
	{ label: '아래로 옮기기', icon: <MoveIcon dir="down" />, action: { type: 'moveBlock', dir: 'down' } },
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
					icon={typeof icon === 'string' ? icon : undefined}
				>
					{typeof icon === 'string' ? null : icon}
				</IconButton>
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
