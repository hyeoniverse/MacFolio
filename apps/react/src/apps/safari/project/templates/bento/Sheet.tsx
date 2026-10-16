// bento의 자세히 보기 창: 보드를 촘촘하게 두려고 타일에 다 담지 못한 내용을 보드 위에 띄워 보인다.
// 브라우저의 모달 <dialog>(showModal)를 써서 초점이 창 안에 머물고 Esc로 닫히며, 닫으면 연 단추로 초점이 돌아간다.
// 닫혀 있는 동안에도 내용은 구역 안에 그대로 있어 구역의 글로 읽히고, 그림은 미리 걸어 둔다
import React, { useEffect, useId, useRef } from 'react';

export const Sheet: React.FC<{
	open: boolean;
	onClose: () => void;
	title: string;
	/** 제목 위의 작은 이름표 (구역 이름 등) */
	kicker?: string;
	/** 머리 오른쪽에 둘 것 (앞뒤 단추 등) */
	tools?: React.ReactNode;
	wide?: boolean;
	children: React.ReactNode;
}> = ({ open, onClose, title, kicker, tools, wide, children }) => {
	const ref = useRef<HTMLDialogElement>(null);
	const id = useId();

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) {
			if (typeof dialog.showModal === 'function') dialog.showModal();
			else dialog.setAttribute('open', '');
		} else if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			className="bt-sheet"
			data-wide={wide ? '' : undefined}
			aria-labelledby={`${id}-title`}
			onClose={onClose}
			onClick={(event) => {
				// 창 바깥(뒤 막)을 누르면 닫는다
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="bt-sheet-inner">
				<header className="bt-sheet-head">
					<div>
						{kicker && <p className="bt-label">{kicker}</p>}
						<h3 id={`${id}-title`}>{title}</h3>
					</div>
					{tools}
					<button type="button" className="bt-icon-btn" onClick={onClose} aria-label="닫기">
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				</header>
				<div className="bt-sheet-body">{children}</div>
			</div>
		</dialog>
	);
};
