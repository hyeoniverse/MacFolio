import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatIso, monthGrid, parseIso, shiftMonth, toIso } from './calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 오늘 (YYYY-MM-DD, 지역 시간) */
const todayIso = () => {
	const now = new Date();
	return toIso(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * 날짜 고르기: 누르면 사이트 모양의 달력이 열린다 (브라우저 기본 달력 대신).
 * 바깥을 누르거나 Esc를 누르면 닫힌다.
 */
const DatePicker = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
	const [open, setOpen] = useState(false);
	const selected = parseIso(value);
	const [view, setView] = useState(() => {
		const base = selected ?? parseIso(todayIso())!;
		return { year: base.year, month: base.month };
	});
	const buttonRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: 0, top: 0 });

	useLayoutEffect(() => {
		if (!open || !buttonRef.current) return;
		const rect = buttonRef.current.getBoundingClientRect();
		const width = panelRef.current?.offsetWidth ?? 248;
		setPosition({ left: Math.min(rect.left, window.innerWidth - width - 8), top: rect.bottom + 6 });
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const close = (event: Event) => {
			const inside =
				panelRef.current?.contains(event.target as Node) || buttonRef.current?.contains(event.target as Node);
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !inside) setOpen(false);
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open]);

	const pick = (iso: string) => {
		onChange(iso);
		setOpen(false);
	};
	const today = todayIso();

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				className="memo-meta-button"
				aria-label={`날짜 ${formatIso(value)}, 바꾸기`}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => {
					if (selected) setView({ year: selected.year, month: selected.month });
					setOpen((value) => !value);
				}}
			>
				<time dateTime={value}>{formatIso(value)}</time>
			</button>
			{open &&
				createPortal(
					<div ref={panelRef} className="memo-calendar" role="dialog" aria-label="날짜 고르기" style={position}>
						<div className="memo-calendar-head">
							<strong>
								{view.year}년 {view.month + 1}월
							</strong>
							<button type="button" aria-label="이전 달" onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" />
							</button>
							<button type="button" aria-label="다음 달" onClick={() => setView(shiftMonth(view.year, view.month, 1))}>
								<i className="fa-solid fa-chevron-right" aria-hidden="true" />
							</button>
						</div>
						<div className="memo-calendar-grid" role="grid">
							{WEEKDAYS.map((day) => (
								<span key={day} className="memo-calendar-weekday" role="columnheader">
									{day}
								</span>
							))}
							{monthGrid(view.year, view.month)
								.flat()
								.map((day, index) => {
									if (day === null) return <span key={`blank-${index}`} />;
									const iso = toIso(view.year, view.month, day);
									return (
										<button
											key={iso}
											type="button"
											role="gridcell"
											aria-label={`${view.year}년 ${view.month + 1}월 ${day}일`}
											aria-selected={iso === value}
											className={`${iso === value ? 'selected' : ''} ${iso === today ? 'today' : ''}`}
											onClick={() => pick(iso)}
										>
											{day}
										</button>
									);
								})}
						</div>
						<button type="button" className="memo-calendar-today" onClick={() => pick(today)}>
							오늘
						</button>
					</div>,
					document.body
				)}
		</>
	);
};

export default DatePicker;
