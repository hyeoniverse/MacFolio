import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatIso, monthGrid, parseIso, shiftMonth, toIso } from './calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = Array.from({ length: 12 }, (_, month) => month);
/** 연도 고르기에서 한 번에 보여 주는 해의 수 (3줄 × 4) */
const YEAR_PAGE = 12;

/** 달력이 보여 주는 것: 날짜 → (제목을 누르면) 월 → (다시 누르면) 연도 */
type Mode = 'days' | 'months' | 'years';

const STEP_LABELS: Record<Mode, [string, string]> = {
	days: ['이전 달', '다음 달'],
	months: ['이전 해', '다음 해'],
	years: ['이전 12년', '다음 12년'],
};

/** 오늘 (YYYY-MM-DD, 지역 시간) */
const todayIso = () => {
	const now = new Date();
	return toIso(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * 날짜 고르기: 누르면 사이트 모양의 달력이 열린다 (브라우저 기본 달력 대신).
 * 위의 '2026년 9월'을 누르면 월을, 거기서 '2026년'을 누르면 연도를 한 번에 고른다.
 * 바깥을 누르거나 Esc를 누르면 닫힌다.
 */
const DatePicker = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
	const [open, setOpen] = useState(false);
	const selected = parseIso(value);
	const [view, setView] = useState(() => {
		const base = selected ?? parseIso(todayIso())!;
		return { year: base.year, month: base.month };
	});
	const [mode, setMode] = useState<Mode>('days');
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
	const todayParts = parseIso(today)!;
	// 연도 고르기는 12년씩: 보고 있는 해가 들어가는 구간
	const yearStart = view.year - (((view.year % YEAR_PAGE) + YEAR_PAGE) % YEAR_PAGE);
	/** 화살표: 날짜에서는 한 달, 월에서는 한 해, 연도에서는 12년 */
	const step = (direction: 1 | -1) => {
		if (mode === 'days') setView(shiftMonth(view.year, view.month, direction));
		else setView({ year: view.year + direction * (mode === 'months' ? 1 : YEAR_PAGE), month: view.month });
	};

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
					setMode('days');
					setOpen((value) => !value);
				}}
			>
				<time dateTime={value}>{formatIso(value)}</time>
			</button>
			{open &&
				createPortal(
					<div ref={panelRef} className="memo-calendar" role="dialog" aria-label="날짜 고르기" style={position}>
						<div className="memo-calendar-head">
							<button
								type="button"
								className="memo-calendar-title"
								aria-label={
									mode === 'days'
										? `${view.year}년 ${view.month + 1}월, 월 고르기`
										: mode === 'months'
											? `${view.year}년, 연도 고르기`
											: `${yearStart}–${yearStart + YEAR_PAGE - 1}년`
								}
								disabled={mode === 'years'}
								onClick={() => setMode(mode === 'days' ? 'months' : 'years')}
							>
								{mode === 'days'
									? `${view.year}년 ${view.month + 1}월`
									: mode === 'months'
										? `${view.year}년`
										: `${yearStart}–${yearStart + YEAR_PAGE - 1}년`}
								{mode !== 'years' && <i className="fa-solid fa-chevron-down" aria-hidden="true" />}
							</button>
							<button type="button" aria-label={STEP_LABELS[mode][0]} onClick={() => step(-1)}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" />
							</button>
							<button type="button" aria-label={STEP_LABELS[mode][1]} onClick={() => step(1)}>
								<i className="fa-solid fa-chevron-right" aria-hidden="true" />
							</button>
						</div>
						{mode === 'days' && (
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
						)}
						{mode === 'months' && (
							<div className="memo-calendar-picks" role="group" aria-label="월">
								{MONTHS.map((month) => (
									<button
										key={month}
										type="button"
										aria-label={`${view.year}년 ${month + 1}월`}
										aria-pressed={selected?.year === view.year && selected.month === month}
										className={`${selected?.year === view.year && selected.month === month ? 'selected' : ''} ${todayParts.year === view.year && todayParts.month === month ? 'today' : ''}`}
										onClick={() => {
											setView({ year: view.year, month });
											setMode('days');
										}}
									>
										{month + 1}월
									</button>
								))}
							</div>
						)}
						{mode === 'years' && (
							<div className="memo-calendar-picks" role="group" aria-label="연도">
								{Array.from({ length: YEAR_PAGE }, (_, index) => yearStart + index).map((year) => (
									<button
										key={year}
										type="button"
										aria-label={`${year}년`}
										aria-pressed={selected?.year === year}
										className={`${selected?.year === year ? 'selected' : ''} ${todayParts.year === year ? 'today' : ''}`}
										onClick={() => {
											setView({ year, month: view.month });
											setMode('months');
										}}
									>
										{year}
									</button>
								))}
							</div>
						)}
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
