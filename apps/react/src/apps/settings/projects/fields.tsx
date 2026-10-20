import { placeBelow } from '@/shared/ui/popover/placement';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { mergeSuggestions } from '../packageSearch';
import { formatPeriod, parsePeriod, suggest, type Period } from '../projectInputs';
import DatePicker from '@/shared/ui/date/DatePicker';
import { todayIso } from '@/shared/ui/date/calendar';
import Switch from '@/shared/ui/switch/Switch';
import { optional } from './model';

/** 묶음: 위에 작은 회색 제목, 둥근 상자, 아래에 설명 */
export const Group = ({
	title,
	label,
	hint,
	children,
}: {
	title?: string;
	/** 영역 이름 (없으면 제목) */
	label?: string;
	hint?: ReactNode;
	children: ReactNode;
}) => (
	<section className="projects-group" aria-label={label ?? title}>
		{title && <h3 className="projects-group-title">{title}</h3>}
		<div className="projects-box">{children}</div>
		{hint && <p className="projects-group-hint">{hint}</p>}
	</section>
);

/** 칸 이름. 꼭 적어야 하면 옆에 빨간 '필수' */
const FieldLabel = ({ label, required = false }: { label: string; required?: boolean }) => (
	<span className="projects-field-label">
		{label}
		{required && (
			<em className="projects-required" aria-hidden="true">
				필수
			</em>
		)}
	</span>
);

/**
 * 줄 하나: 왼쪽 이름, 오른쪽 컨트롤(줄의 오른쪽 6할), 아래 회색 설명.
 * align: 컨트롤을 칸 폭에 채울지(fill, 글자 칸) 오른쪽 끝에 붙일지(end, 팝업·스위치)
 */
export const FormRow = ({
	label,
	required = false,
	htmlFor,
	hint,
	hintId,
	align = 'fill',
	top = false,
	children,
}: {
	label: string;
	required?: boolean;
	/** 이름을 누르면 초점이 갈 컨트롤 */
	htmlFor?: string;
	hint?: ReactNode;
	hintId?: string;
	align?: 'fill' | 'end';
	/** 여러 줄 컨트롤: 이름을 위쪽에 맞춘다 */
	top?: boolean;
	children: ReactNode;
}) => (
	<div className={`projects-item ${top ? 'top' : ''}`}>
		{htmlFor ? (
			<label className="projects-item-label" htmlFor={htmlFor}>
				<FieldLabel label={label} required={required} />
			</label>
		) : (
			<span className="projects-item-label">
				<FieldLabel label={label} required={required} />
			</span>
		)}
		<div className={`projects-item-control ${align}`}>{children}</div>
		{hint && (
			<p className="projects-item-hint" id={hintId}>
				{hint}
			</p>
		)}
	</div>
);

/** 위아래 화살표 (macOS 팝업 버튼의 ⌃⌄) */
const PopupChevrons = () => (
	<svg className="projects-popup-chevrons" viewBox="0 0 8 12" aria-hidden="true">
		<path d="M1.5 4.5 4 2l2.5 2.5M1.5 7.5 4 10l2.5-2.5" />
	</svg>
);

/** 팝업 버튼 (select): 고른 값과 오른쪽 ⌃⌄ */
export const Popup = ({
	id,
	label,
	value,
	onChange,
	children,
}: {
	id?: string;
	/** 이름표가 따로 없을 때의 이름 */
	label?: string;
	value: string;
	onChange: (value: string) => void;
	children: ReactNode;
}) => (
	<span className="projects-popup">
		<select id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
			{children}
		</select>
		<PopupChevrons />
	</span>
);

/** 한 줄(또는 여러 줄) 글자 칸 */
export const TextField = ({
	label,
	value,
	onChange,
	hint,
	type = 'text',
	placeholder,
	required = false,
	multiline = false,
	mono = false,
	rows = 3,
	ariaLabel,
}: {
	label: string;
	value: string | number | undefined;
	onChange: (value: string) => void;
	hint?: string;
	type?: string;
	placeholder?: string;
	/** 꼭 적어야 하는 칸: 이름 옆에 '필수' */
	required?: boolean;
	/** 긴 글: 여러 줄 칸 */
	multiline?: boolean;
	/** 고정폭 글꼴 (폴더 구조처럼 줄을 맞춰 쓰는 글) */
	mono?: boolean;
	/** 여러 줄 칸의 처음 높이 (줄 수) */
	rows?: number;
	/** 보이는 이름과 다른 접근성 이름 (목록 항목의 '주요 기능 1 제목' 등) */
	ariaLabel?: string;
}) => {
	const id = useId();
	const hintId = `${id}-hint`;
	const common = {
		id,
		className: `projects-input${mono ? ' mono' : ''}`,
		value: value ?? '',
		placeholder,
		spellCheck: false,
		required,
		'aria-label': ariaLabel,
		'aria-required': required || undefined,
		'aria-describedby': hint ? hintId : undefined,
	};
	return (
		<FormRow label={label} required={required} htmlFor={id} hint={hint} hintId={hintId} top={multiline}>
			{multiline ? (
				<textarea {...common} rows={rows} onChange={(event) => onChange(event.target.value)} />
			) : (
				<input {...common} type={type} onChange={(event) => onChange(event.target.value)} />
			)}
		</FormRow>
	);
};

/**
 * 기간: 시작일·끝날을 달력에서 고른다. 끝 대신 '운영 중' 같은 글을 쓸 수도 있다.
 * 날짜 모양이 아닌 예전 값(예: Week 01–15)은 글 칸으로 그대로 고친다
 */
export const PeriodField = ({
	value,
	onChange,
}: {
	value: string | undefined;
	onChange: (value: string | undefined) => void;
}) => {
	const parsed = parsePeriod(value);
	const [period, setPeriod] = useState<Period>(parsed ?? { start: '', end: '', ongoing: '' });
	const [asText] = useState(parsed === null);
	const update = (patch: Partial<Period>) => {
		const next = { ...period, ...patch };
		setPeriod(next);
		onChange(formatPeriod(next));
	};
	// 아직 오지 않은 날은 고를 수 없다. 끝날은 시작일보다 앞설 수 없고, 시작일은 끝날 뒤로 갈 수 없다
	const today = todayIso();
	if (asText)
		return (
			<TextField
				label="기간"
				value={value}
				onChange={(text) => onChange(optional(text))}
				hint="날짜 모양이 아닌 기간이라 글로 고칩니다."
			/>
		);
	return (
		<FormRow
			label="기간"
			hint={!period.start && (period.end || period.ongoing) ? '시작일을 고르면 기간이 저장됩니다.' : undefined}
		>
			<div className="projects-period" role="group" aria-label="기간">
				<DatePicker
					label="시작일"
					placeholder="시작일"
					className="projects-popup projects-date"
					value={period.start}
					max={period.end && period.end < today ? period.end : today}
					onChange={(start) => update({ start })}
				/>
				<span className="projects-period-dash" aria-hidden="true">
					–
				</span>
				{period.ongoing ? (
					<input
						type="text"
						className="projects-input projects-period-text"
						aria-label="끝 대신 쓸 글"
						value={period.ongoing}
						onChange={(event) => update({ ongoing: event.target.value || '진행 중' })}
					/>
				) : (
					<DatePicker
						label="끝날"
						placeholder="끝날"
						className="projects-popup projects-date"
						value={period.end}
						min={period.start || undefined}
						max={today}
						onChange={(end) => update({ end })}
					/>
				)}
				<label className="projects-check">
					<input
						type="checkbox"
						checked={Boolean(period.ongoing)}
						onChange={(event) => update({ ongoing: event.target.checked ? '진행 중' : '', end: '' })}
					/>
					진행 중
				</label>
			</div>
		</FormRow>
	);
};

/** 후보 목록을 칸 아래에 띄운다 (설정 창의 스크롤·상자 경계에 잘리지 않게 body에 portal) */
function useSuggestionPosition(anchor: RefObject<HTMLElement | null>, list: RefObject<HTMLElement | null>) {
	const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
	const place = () => {
		if (!anchor.current) return;
		const rect = anchor.current.getBoundingClientRect();
		const height = list.current?.offsetHeight ?? 0;
		setPosition({ ...placeBelow(rect, { width: rect.width, height }), width: rect.width });
	};
	return [position, place] as const;
}

/**
 * 하나를 고르는 칸 (주 언어): 누르면 후보 전체가 칸 아래에 뜨고, 입력하면 걸러진다.
 * 목록에 없는 이름도 그대로 쓸 수 있다 (입력한 글자가 곧 값)
 */
export const ChoiceInput = ({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: readonly string[];
	onChange: (value: string) => void;
}) => {
	const [open, setOpen] = useState(false);
	// 칸을 막 열었을 때는 지금 값으로 거르지 않고 전체를 보여 준다. 입력하면 그때부터 거른다
	const [typed, setTyped] = useState(false);
	const [active, setActive] = useState(0);
	const id = useId();
	const listId = `${id}-list`;
	const boxRef = useRef<HTMLSpanElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const [position, place] = useSuggestionPosition(boxRef, listRef);
	const shown = open ? suggest(options, typed ? value : '', [], Infinity) : [];
	// eslint-disable-next-line react-hooks/exhaustive-deps -- 목록 길이·값이 바뀔 때만 자리를 다시 잰다
	useLayoutEffect(() => void (shown.length && place()), [shown.length, value]);
	// 열면 지금 값이 목록에 보이게, ↑·↓로 고른 후보도 목록 안에서 보이게 굴린다
	useEffect(() => {
		listRef.current?.querySelector(`[id="${listId}-${active}"]`)?.scrollIntoView({ block: 'nearest' });
	}, [active, listId, open]);
	const openList = () => {
		setTyped(false);
		const index = options.findIndex((option) => option.toLowerCase() === value.toLowerCase());
		setActive(Math.max(0, index));
		setOpen(true);
	};
	const pick = (option: string) => {
		onChange(option);
		setOpen(false);
	};
	return (
		<FormRow
			label={label}
			htmlFor={id}
			hint="목록에서 고르거나 이름으로 검색합니다. 목록에 없는 언어는 이름을 직접 입력합니다."
		>
			<span className="projects-combo" ref={boxRef}>
				<input
					id={id}
					ref={inputRef}
					role="combobox"
					aria-label={label}
					aria-expanded={shown.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
					value={value}
					placeholder={`${label} 검색`}
					spellCheck={false}
					onFocus={openList}
					onClick={() => !open && openList()}
					onBlur={() => setOpen(false)}
					onChange={(event) => {
						onChange(event.target.value);
						setTyped(true);
						setActive(0);
						setOpen(true);
					}}
					onKeyDown={(event) => {
						if (event.key === 'ArrowDown' && shown.length) {
							event.preventDefault();
							setActive((index) => (index + 1) % shown.length);
						} else if (event.key === 'ArrowUp' && shown.length) {
							event.preventDefault();
							setActive((index) => (index - 1 + shown.length) % shown.length);
						} else if (event.key === 'Enter') {
							event.preventDefault();
							if (shown[active]) pick(shown[active]);
							else setOpen(false);
						} else if (event.key === 'Escape' && open) {
							event.stopPropagation();
							setOpen(false);
						}
					}}
				/>
				{/* 오른쪽 ⌄: 누르면 후보 전체를 연다 (콤보 상자의 버튼) */}
				<span
					className="projects-combo-button"
					aria-hidden="true"
					onPointerDown={(event) => {
						event.preventDefault();
						if (open) setOpen(false);
						else inputRef.current?.focus();
					}}
				>
					<i className="fa-solid fa-chevron-down" />
				</span>
			</span>
			{shown.length > 0 &&
				createPortal(
					<ul
						ref={listRef}
						className="projects-suggestions"
						role="listbox"
						id={listId}
						aria-label={`${label} 후보`}
						style={position}
					>
						{shown.map((option, index) => (
							<li
								key={option}
								id={`${listId}-${index}`}
								role="option"
								aria-selected={index === active}
								data-current={option === value || undefined}
								onPointerDown={(event) => event.preventDefault()}
								onClick={() => pick(option)}
							>
								{option}
								{option === value && <i className="fa-solid fa-check" aria-hidden="true" />}
							</li>
						))}
					</ul>,
					document.body
				)}
		</FormRow>
	);
};

/**
 * 기술: 토큰 칸 (macOS의 토큰 필드). 고른 것은 칸 안의 칩으로, 치면 후보가 걸러져 아래에 나온다.
 * Enter·쉼표로 더하고(목록에 없는 것도), ↑·↓로 후보를 고르고, 빈 칸에서 Backspace는 마지막 칩을 뺀다
 */
export const TagInput = ({
	label,
	items,
	options,
	onChange,
	remote,
}: {
	label: string;
	items: string[];
	options: readonly string[];
	onChange: (items: string[]) => void;
	/** 코드의 후보 밖에서 더 찾기 (기술은 npm 레지스트리) */
	remote?: { name: string; search: (query: string, signal: AbortSignal) => Promise<string[]> };
}) => {
	const [query, setQuery] = useState('');
	const [found, setFound] = useState<{ query: string; names: string[] }>({ query: '', names: [] });
	// 바깥 검색은 치기를 멈추면(0.25초) 한 번. 앞 요청은 끊는다
	useEffect(() => {
		const text = query.trim();
		if (!remote || text.length < 2) return;
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			void remote.search(text, controller.signal).then((names) => {
				if (!controller.signal.aborted) setFound({ query: text, names });
			});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [query, remote]);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const id = useId();
	const listId = `${id}-list`;
	const boxRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const [position, place] = useSuggestionPosition(boxRef, listRef);
	// 글자를 안 쳤으면 후보 전체를, 쳤으면 맞는 것 전부를 보여 준다 (목록 안에서 스크롤)
	const localShown = open ? suggest(options, query, items, Infinity) : [];
	const merged = mergeSuggestions(
		localShown,
		open && found.query === query.trim() ? found.names : [],
		items,
		localShown.length + 20
	);
	const shown = [...merged.local, ...merged.remote];
	const remoteFrom = merged.local.length;
	// 글자를 쳤을 때 코드의 후보 가운데 몇 개가 맞는지
	const matched = query.trim() ? localShown.length : 0;
	// ↑·↓로 고른 후보가 목록 밖이면 보이게 굴린다
	useEffect(() => {
		listRef.current?.querySelector(`[id="${listId}-${active}"]`)?.scrollIntoView({ block: 'nearest' });
	}, [active, listId]);
	// 칩이 늘면 칸이 높아지므로 칩 수도 본다
	// eslint-disable-next-line react-hooks/exhaustive-deps -- 목록 길이·글자·칩 수가 바뀔 때만 자리를 다시 잰다
	useLayoutEffect(() => void (shown.length && place()), [shown.length, query, items.length]);
	const add = (raw: string) => {
		const value = raw.trim();
		setQuery('');
		setActive(0);
		if (!value || items.some((item) => item.toLowerCase() === value.toLowerCase())) return;
		onChange([...items, value]);
	};
	return (
		<FormRow
			label={label}
			htmlFor={id}
			top
			hint={
				matched
					? `${matched}개의 ${label}이 검색되었습니다.${remote ? ` ${remote.name} 패키지 검색 결과는 목록 아래쪽에 표시됩니다.` : ''}`
					: `목록에서 고르거나 이름으로 검색합니다. 목록에 없는 ${label}은 이름을 입력한 뒤 Enter를 누르면 추가됩니다.`
			}
		>
			{/* 칸의 빈 곳을 누르면 입력 칸으로 */}
			<div
				className="projects-tokens"
				ref={boxRef}
				onPointerDown={(event) => {
					if (event.target === event.currentTarget) {
						event.preventDefault();
						inputRef.current?.focus();
					}
				}}
			>
				{items.length > 0 && (
					<ul className="projects-chips" aria-label={`고른 ${label}`}>
						{items.map((item) => (
							<li key={item}>
								{item}
								<button
									type="button"
									aria-label={`${item} 빼기`}
									onClick={() => onChange(items.filter((other) => other !== item))}
								>
									<i className="fa-solid fa-xmark" aria-hidden="true" />
								</button>
							</li>
						))}
					</ul>
				)}
				<input
					id={id}
					ref={inputRef}
					role="combobox"
					aria-label={label}
					aria-expanded={shown.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
					value={query}
					placeholder={items.length ? '' : `${label} 검색`}
					spellCheck={false}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
					onChange={(event) => {
						const text = event.target.value;
						// 쉼표를 치면 그 앞까지 더한다 (붙여 넣은 'React, Vite'도 나눠 더한다)
						if (text.includes(',')) {
							const parts = text.split(',');
							const rest = parts.pop() ?? '';
							const next = [...items];
							for (const part of parts.map((item) => item.trim()).filter(Boolean))
								if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) next.push(part);
							if (next.length !== items.length) onChange(next);
							setQuery(rest.trimStart());
						} else setQuery(text);
						setActive(0);
						setOpen(true);
					}}
					onKeyDown={(event) => {
						if (event.key === 'ArrowDown' && shown.length) {
							event.preventDefault();
							setActive((index) => (index + 1) % shown.length);
						} else if (event.key === 'ArrowUp' && shown.length) {
							event.preventDefault();
							setActive((index) => (index - 1 + shown.length) % shown.length);
						} else if (event.key === 'Enter') {
							// 폼을 보내지 않고 더한다: 친 글자가 있으면 고른 후보(없으면 친 그대로)
							event.preventDefault();
							if (query.trim()) add(shown[active] ?? query);
						} else if (event.key === 'Escape' && open) {
							event.stopPropagation();
							setOpen(false);
						} else if (event.key === 'Backspace' && !query && items.length) {
							onChange(items.slice(0, -1));
						}
					}}
				/>
			</div>
			{shown.length > 0 &&
				createPortal(
					<ul
						ref={listRef}
						className="projects-suggestions"
						role="listbox"
						id={listId}
						aria-label={`${label} 후보`}
						style={position}
					>
						{shown.map((option, index) => (
							<li
								key={option}
								id={`${listId}-${index}`}
								role="option"
								aria-selected={index === active}
								data-source={index >= remoteFrom ? remote?.name : undefined}
								// 누르는 동안 입력칸의 초점이 빠져 목록이 닫히지 않게
								onPointerDown={(event) => event.preventDefault()}
								onClick={() => add(option)}
							>
								{option}
								{index >= remoteFrom && remote && <span className="projects-suggestion-source">{remote.name}</span>}
							</li>
						))}
					</ul>,
					document.body
				)}
		</FormRow>
	);
};

/** 켜고 끄는 줄: 왼쪽 이름(아래 설명), 오른쪽 토글 */
export const SwitchRow = ({
	label,
	checked,
	onChange,
	hint,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	hint?: string;
}) => {
	const id = useId();
	return (
		<FormRow label={label} htmlFor={id} hint={hint} hintId={`${id}-hint`} align="end">
			<Switch
				id={id}
				size="small"
				className="projects-switch"
				aria-describedby={hint ? `${id}-hint` : undefined}
				checked={checked}
				onChange={onChange}
			/>
		</FormRow>
	);
};
