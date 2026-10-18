import React, { useLayoutEffect, useRef, useState } from 'react';

interface Props {
	name: string;
	/** 처음 고를 글자 수 (파일은 확장자 앞까지) */
	select?: number;
	className?: string;
	onCommit: (name: string) => void;
	onCancel: () => void;
}

/**
 * 아이콘 아래 이름을 그 자리에서 고치는 칸 (macOS처럼). Enter·바깥 누르기는 저장, Esc는 취소.
 * 처음에는 이름 전체(파일은 확장자 앞까지)를 골라 둔다
 */
const InlineName: React.FC<Props> = ({ name, select, className, onCommit, onCancel }) => {
	const input = useRef<HTMLTextAreaElement>(null);
	const [draft, setDraft] = useState(name);
	const done = useRef(false);
	useLayoutEffect(() => {
		const el = input.current;
		if (!el) return;
		el.focus({ preventScroll: true });
		el.setSelectionRange(0, select ?? name.length);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때만 고른다
	}, []);
	const finish = (save: boolean) => {
		if (done.current) return;
		done.current = true;
		if (save) onCommit(draft);
		else onCancel();
	};
	return (
		<textarea
			ref={input}
			className={`finder-rename${className ? ` ${className}` : ''}`}
			aria-label="이름"
			rows={1}
			spellCheck={false}
			value={draft}
			onChange={(event) => setDraft(event.target.value.replace(/\n/g, ''))}
			onKeyDown={(event) => {
				event.stopPropagation();
				if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
					event.preventDefault();
					finish(true);
				} else if (event.key === 'Escape') {
					event.preventDefault();
					finish(false);
				}
			}}
			onBlur={() => finish(true)}
			onClick={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
		/>
	);
};

export default InlineName;
