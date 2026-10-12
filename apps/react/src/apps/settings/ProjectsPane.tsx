import {
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { placeBelow } from '@/shared/ui/popover/placement';
import {
	BACKDROP_THEMES,
	blankProject,
	mergeProjects,
	overrideOf,
	parseProjects,
	PROJECT_LOOKS,
	type BackdropTheme,
	type Project,
	type ProjectAppInfo,
	type ProjectBackdrop,
	type ProjectChapter,
	type ProjectPoint,
	type ProjectLook,
	type SiteProjects,
} from '@macfolio/desktop-core/site';
import { DEFAULT_PROJECTS, PROJECTS } from '@/shared/profile';
import { DEFAULT_PROFILE } from '@/shared/site/profileStore';
import { mergeSuggestions, searchPackages } from './packageSearch';
import { formatPeriod, languageOptions, parsePeriod, stackOptions, suggest, type Period } from './projectInputs';
import { getSavedProjects, PARSE_OPTIONS, sendProjects } from '@/shared/site/siteContent';
import { completeProject, groupedImageFolders, PUBLIC_IMAGES } from '@/shared/site/publicImages';
import ProjectPage from '@/apps/safari/ProjectPage';
import { hasCustomPage } from '@/apps/safari/project/custom';
import { PROJECT_APPS } from '@/apps/manifest';
import { ALBUMS, albumsOf } from '@/apps/photos/albums';
import { requestWindowSize } from '@/desktop/window/windowSizeRequest';
import { uploadFile } from '@/apps/memo/writer/attachmentsApi';
import { appIconUrl } from '@/shared/config/appIcon';
import { env } from '@/shared/config/env';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import DatePicker from '@/shared/ui/date/DatePicker';
import { todayIso } from '@/shared/ui/date/calendar';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';
import { move as moveItem } from '@/apps/settings/showcase';
import { fillWithSample, LOOK_FIELDS, type LookSample } from '@/apps/settings/lookSamples';

/** 목록의 한 줄: 프로젝트 하나 (코드의 기본값에 덮어쓴 모습) */
interface Row {
	id: string;
	hidden: boolean;
	project: Project;
	/** 코드에 없는, 관리자가 더한 프로젝트 (지울 수 있다) */
	isNew: boolean;
}

const DEFAULTS = new Map(DEFAULT_PROJECTS.map((project) => [project.id, project]));

/** 화면 모음 폴더 목록: 프로젝트 폴더(id)별로 묶고, 묶음 이름은 그 프로젝트의 이름 */
const FOLDER_GROUPS = groupedImageFolders(
	(id) => [...PROJECTS, ...DEFAULT_PROJECTS].find((project) => project.id === id)?.name
);

/** 언어·기술 칸의 후보: 지금 보이는 프로젝트와 코드의 프로젝트, 사이트 주인의 기술 */
const LANGUAGES = languageOptions([...PROJECTS, ...DEFAULT_PROJECTS]);
/** 기술 칸의 바깥 후보: npm 레지스트리 (코드의 목록에 없는 라이브러리) */
const NPM = { name: 'npm', search: searchPackages };

const STACKS = stackOptions(
	[...PROJECTS, ...DEFAULT_PROJECTS.filter((project) => !PROJECTS.some((shown) => shown.id === project.id))],
	[...Object.values(DEFAULT_PROFILE.skills).flat(), ...DEFAULT_PROFILE.siteStack]
);

/** 페이지 모양 카드의 이름과 짧은 설명 */
const LOOKS: Record<ProjectLook, { name: string; note: string }> = {
	showcase: { name: '기본', note: '카드' },
	cinema: { name: '시네마', note: '한 화면씩 장면' },
	phone: { name: '폰', note: '틀 안의 화면' },
	horizontal: { name: '가로', note: '옆으로 가는 패널' },
	brutal: { name: '브루탈', note: '굵은 선·큰 글자' },
	arcade: { name: '아케이드', note: '네온·CRT' },
	atelier: { name: '아틀리에', note: '여백·세리프' },
	inbox: { name: '메일함', note: '3단 화면' },
	checklist: { name: '할 일 앱', note: '체크 목록' },
	repo: { name: '저장소', note: '파일 트리·커밋' },
	dialogue: { name: 'RPG 대화창', note: '픽셀 장면' },
	deck: { name: '발표 슬라이드', note: '한 장씩' },
	assistant: { name: '설정 도우미', note: '단계별' },
	custom: { name: '직접 짠 페이지', note: '코드' },
};

/** dialogue 모양(RPG 대화창)의 배경 장면 이름 */
const BACKDROP_LABEL: Record<BackdropTheme, string> = {
	auto: '자동',
	farm: '농장',
	town: '도시 거리',
	office: '사무실',
	library: '도서관',
	space: '우주',
	sea: '바다',
	forest: '숲',
	snow: '설산',
	cafe: '카페',
	classroom: '교실',
	lab: '연구실',
	arcade: '게임장',
	rooftop: '밤 옥상',
	desert: '사막',
};

/** 배경 묶음을 정리한다: 자동 테마는 적지 않고, 아무것도 없으면 필드째 뺀다 */
const tidyBackdrop = ({ theme, image }: ProjectBackdrop): ProjectBackdrop | undefined => {
	const out: ProjectBackdrop = {};
	if (theme && theme !== 'auto') out.theme = theme;
	if (image) out.image = image;
	return out.theme || out.image ? out : undefined;
};

/** 앱이 쓰는 프로젝트 값 (Dock·Launchpad의 앱 목록은 시작할 때 한 번 정한다: apps/manifest.ts) */
const appSignature = (projects: readonly Project[]) =>
	JSON.stringify(
		projects.filter((project) => project.app && project.demo).map(({ id, demo, app }) => ({ id, demo, app }))
	);

/** 저장한 뒤 새로고침해야 하는지: 앱 목록이나 사진 앨범(시작할 때 한 번 정함)이 바뀌었을 때 */
const needsReload = () =>
	appSignature(PROJECTS) !== appSignature(PROJECT_APPS) ||
	JSON.stringify(albumsOf(PROJECTS)) !== JSON.stringify(ALBUMS);

/** 서버에 둔 순서대로, 서버 목록에 없는 코드의 프로젝트는 끝에 (숨긴 것도 목록에는 보인다) */
function rowsFrom(saved: SiteProjects | null): Row[] {
	const items = saved?.items ?? [];
	const rows: Row[] = items.map((entry) => ({
		id: entry.id,
		hidden: Boolean(entry.hidden),
		project: mergeProjects([DEFAULTS.get(entry.id) ?? blankProject(entry.id)], {
			items: [{ ...entry, hidden: false }],
		})[0],
		isNew: !DEFAULTS.has(entry.id),
	}));
	for (const project of DEFAULT_PROJECTS)
		if (!items.some((entry) => entry.id === project.id))
			rows.push({ id: project.id, hidden: false, project, isNew: false });
	return rows;
}

/** 저장할 내용: 줄마다 순서·숨김과, 코드의 기본값과 다른 필드만 */
function contentFrom(rows: Row[]): SiteProjects {
	return {
		items: rows.map((row) => {
			const override = overrideOf(row.project, DEFAULTS.get(row.id)) ?? {};
			return {
				id: row.id,
				...(row.hidden ? { hidden: true } : {}),
				...(Object.keys(override).length ? { override } : {}),
			};
		}),
	};
}

const withoutId = ({ id: _id, ...rest }: Project) => rest;

/** 적은 내용이 있는지 (예시로 채우기 전에 물어볼지): id·저장소·데모·앱·모양과 처음 이름은 내용으로 치지 않는다 */
const hasContent = (project: Project) => {
	const { id: _id, url: _url, demo: _demo, app: _app, look: _look, name, ...rest } = project;
	const { id: _bid, url: _burl, look: _blook, name: _bname, ...blank } = blankProject('');
	return (name.trim() !== '' && name !== '새 프로젝트') || JSON.stringify(rest) !== JSON.stringify(blank);
};

/** 맨 위에서 꼭 있어야 하는 필드 (고급 JSON으로 통째로 바꿀 때 확인) */
const REQUIRED: (keyof Project)[] = [
	'name',
	'look',
	'tagline',
	'description',
	'context',
	'facts',
	'highlights',
	'build',
	'contributions',
	'specs',
	'stack',
	'language',
	'url',
	'image',
];

/** 프로젝트 하나를 검사한다 (서버와 같은 규칙). 앱은 데모 주소가 있어야 한다 */
/** 목록에서 비워 둔 줄은 뺀다 (더하기만 누르고 안 적은 것) */
function tidy(project: Project): Project {
	// 화면 여러 장: 그림을 고르지 않은 줄은 빼고, 설명을 비우면 항목 제목을 쓴다
	const point = (item: ProjectPoint): ProjectPoint => {
		const shots = item.shots
			?.filter((shot) => shot.src.trim())
			.map((shot) => ({ ...shot, alt: shot.alt.trim() || item.title }));
		const out = { ...item, shots };
		if (!shots?.length) delete out.shots;
		return out;
	};
	const points = (list?: ProjectPoint[]) => list?.filter((item) => item.title.trim() || item.body.trim()).map(point);
	const pairs = <T extends object>(list?: T[]) =>
		list?.filter((row) => Object.values(row as Record<string, unknown>).some((value) => String(value ?? '').trim()));
	const chapters = project.chapters
		?.filter((chapter) => chapter.title.trim() || chapter.lead?.trim() || chapter.points.length)
		.map((chapter) => {
			const out: ProjectChapter = { ...chapter, points: points(chapter.points) ?? [] };
			const facts = pairs(chapter.facts);
			if (facts?.length) out.facts = facts;
			else delete out.facts;
			// 장 그림의 설명을 비우면 장 제목을 쓴다 (설명은 꼭 있어야 한다)
			if (out.image?.src) out.image = { ...out.image, alt: out.image.alt.trim() || chapter.title };
			else delete out.image;
			return out;
		});
	const next: Project = {
		...project,
		facts: pairs(project.facts) ?? [],
		highlights: points(project.highlights) ?? [],
		build: points(project.build) ?? [],
		usage: points(project.usage),
		chapters,
		timeline: pairs(project.timeline),
		specs: pairs(project.specs) ?? [],
		contributions: project.contributions.map((line) => line.trim()).filter(Boolean),
		controls: project.controls
			?.map((control) => ({ ...control, keys: control.keys.map((key) => key.trim()).filter(Boolean) }))
			.filter((control) => control.keys.length || control.label.trim()),
		credits: pairs(project.credits),
		conventions: pairs(project.conventions),
	};
	for (const key of ['usage', 'chapters', 'timeline', 'controls', 'credits', 'conventions'] as const)
		if (!next[key]?.length) delete next[key];
	return next;
}

function validate(id: string, raw: Project): { value: Project } | { errors: string[] } {
	const project = tidy(raw);
	// 꼭 적어야 하는 칸 (화면에 '필수'로 표시한 칸)
	const missing = [
		!project.name.trim() && '이름을 입력해 주세요.',
		!project.url.trim() && '저장소 주소를 입력해 주세요.',
		project.app && !project.app.label.trim() && '앱 이름을 입력해 주세요.',
		project.app && !project.app.icon.trim() && '앱 아이콘을 입력해 주세요.',
	].filter((error): error is string => Boolean(error));
	if (missing.length) return { errors: missing };
	const parsed = parseProjects({ items: [{ id, override: withoutId(project) }] }, PARSE_OPTIONS);
	if ('errors' in parsed) return parsed;
	const value = { id, ...parsed.value.items[0].override } as Project;
	if (value.app && !value.demo) return { errors: ['앱으로 열려면 데모 주소가 있어야 합니다.'] };
	return { value };
}

/* ─── 편집 화면의 틀 (macOS 시스템 설정): 회색 바탕 위 둥근 묶음 상자, 상자 안의 줄은 왼쪽 이름 · 오른쪽 컨트롤 ─── */

/** 묶음: 위에 작은 회색 제목, 둥근 상자, 아래에 설명 */
const Group = ({
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
const FormRow = ({
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

/** 위아래 화살표 (macOS 팝업 단추의 ⌃⌄) */
const PopupChevrons = () => (
	<svg className="projects-popup-chevrons" viewBox="0 0 8 12" aria-hidden="true">
		<path d="M1.5 4.5 4 2l2.5 2.5M1.5 7.5 4 10l2.5-2.5" />
	</svg>
);

/** 팝업 단추 (select): 고른 값과 오른쪽 ⌃⌄ */
const Popup = ({
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
const TextField = ({
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
const PeriodField = ({
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
const ChoiceInput = ({
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
				{/* 오른쪽 ⌄: 누르면 후보 전체를 연다 (콤보 상자의 단추) */}
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
const TagInput = ({
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
const Switch = ({
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
			<input
				id={id}
				type="checkbox"
				role="switch"
				className="projects-switch"
				aria-describedby={hint ? `${id}-hint` : undefined}
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
		</FormRow>
	);
};

/** 사이트 안 그림 전부 (폴더별) → 고르기 목록에 쓴다 */
const ALL_PICTURES = Object.entries(PUBLIC_IMAGES)
	.filter(([folder]) => folder.startsWith('/imgs/projects/'))
	.flatMap(([, files]) => files.filter((src) => !src.endsWith('.mp4')));

const fileName = (src: string) => decodeURIComponent(src.split('/').pop() ?? src);

/** 그림 크게 보기: 창 위에 어둡게 깔고 가운데 크게. 여러 장이면 ←·→로 넘긴다. Esc·바깥 누르기로 닫는다 */
const Lightbox = ({ items, start, onClose }: { items: string[]; start: number; onClose: () => void }) => {
	const [index, setIndex] = useState(start);
	const closeRef = useRef<HTMLButtonElement>(null);
	const step = (delta: number) => setIndex((current) => (current + delta + items.length) % items.length);
	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		closeRef.current?.focus();
		return () => opener?.focus();
	}, []);
	const src = items[index];
	return createPortal(
		<div
			className="projects-lightbox"
			role="dialog"
			aria-modal="true"
			aria-label="그림 크게 보기"
			onClick={onClose}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					event.stopPropagation();
					onClose();
				} else if (items.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
					event.preventDefault();
					step(event.key === 'ArrowLeft' ? -1 : 1);
				}
			}}
		>
			<figure onClick={(event) => event.stopPropagation()}>
				{src.endsWith('.mp4') ? (
					<video src={src} controls autoPlay muted loop />
				) : (
					<img src={src} alt={fileName(src)} />
				)}
				<figcaption>
					{fileName(src)}
					{items.length > 1 && <span>{`${index + 1} / ${items.length}`}</span>}
				</figcaption>
			</figure>
			{items.length > 1 && (
				<>
					<button
						type="button"
						className="projects-lightbox-step prev"
						aria-label="이전 그림"
						onClick={(event) => {
							event.stopPropagation();
							step(-1);
						}}
					>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button
						type="button"
						className="projects-lightbox-step next"
						aria-label="다음 그림"
						onClick={(event) => {
							event.stopPropagation();
							step(1);
						}}
					>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
				</>
			)}
			<button ref={closeRef} type="button" className="projects-lightbox-close" aria-label="닫기" onClick={onClose}>
				<i className="fa-solid fa-xmark" aria-hidden="true" />
			</button>
		</div>,
		document.body
	);
};

/**
 * 그림 한 장 고르기: 왼쪽 미리 보기 타일(누르면 크게 보기), 오른쪽에 사이트 안 그림 고르기(폴더별 팝업)·올리기(POST /files)·지우기,
 * 그 아래 주소 칸. 앱 아이콘은 이미지 폴더 기준 경로(projects/…)라 값을 그대로 두고, 보여 줄 때만 주소로 바꾼다
 */
const ImageField = ({
	label,
	name = label,
	value,
	onChange,
	required = false,
	hint,
	shape = 'square',
	toUrl = (v) => v,
	fromPicked = (src) => src,
}: {
	label: string;
	/** 컨트롤의 접근성 이름 앞부분 (기본은 보이는 이름) */
	name?: string;
	value: string | undefined;
	onChange: (value: string | undefined) => void;
	required?: boolean;
	hint?: string;
	/** 아이콘은 정사각형, 화면·배경은 16:10 */
	shape?: 'square' | 'wide';
	/** 저장된 값 → 보여 줄 주소 */
	toUrl?: (value: string) => string;
	/** 고른 그림 주소(/imgs/…) → 저장할 값 */
	fromPicked?: (src: string) => string;
}) => {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [zoomed, setZoomed] = useState(false);
	const id = useId();
	const upload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError(null);
		try {
			const uploaded = await uploadFile(env.apiUrl, file);
			if (!uploaded.image) throw new Error('그림 파일만 올릴 수 있습니다.');
			onChange(uploaded.url);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '올리지 못했습니다.');
		} finally {
			setUploading(false);
		}
	};
	return (
		<FormRow label={label} required={required} htmlFor={id} hint={hint} top>
			<div className={`projects-image ${shape}`}>
				{value ? (
					<button
						type="button"
						className="projects-thumb filled"
						aria-label={`${name} 크게 보기`}
						onClick={() => setZoomed(true)}
					>
						<img src={toUrl(value)} alt="" />
					</button>
				) : (
					<span className="projects-thumb empty" aria-hidden="true">
						<i className="fa-regular fa-image" />
					</span>
				)}
				<div className="projects-image-tools">
					<div className="projects-image-buttons">
						<Popup
							id={id}
							label={`${name} 고르기`}
							value={value && ALL_PICTURES.some((src) => fromPicked(src) === value) ? value : ''}
							onChange={(picked) => onChange(picked ? fromPicked(picked) : undefined)}
						>
							<option value="">{value ? '다른 그림 고르기…' : '그림 고르기…'}</option>
							{FOLDER_GROUPS.map((group) => (
								<optgroup key={group.label} label={group.label}>
									{group.folders.flatMap((folder) =>
										PUBLIC_IMAGES[folder.value]
											.filter((src) => !src.endsWith('.mp4'))
											.map((src) => (
												<option key={src} value={fromPicked(src)}>
													{src.slice(folder.value.length + 1)}
													{folder.label !== '프로젝트 폴더' ? ` (${folder.label})` : ''}
												</option>
											))
									)}
								</optgroup>
							))}
						</Popup>
						<label className={`projects-button ${uploading ? 'busy' : ''}`}>
							{uploading ? '올리는 중…' : '올리기…'}
							<input
								type="file"
								accept="image/*"
								aria-label={`${name} 올리기`}
								disabled={uploading}
								onChange={(event) => {
									void upload(event.target.files?.[0]);
									event.target.value = '';
								}}
							/>
						</label>
						{value && (
							<button type="button" className="projects-button" onClick={() => onChange(undefined)}>
								지우기
							</button>
						)}
					</div>
					<input
						type="text"
						className="projects-input mono"
						aria-label={`${name} 주소`}
						value={value ?? ''}
						placeholder="/imgs/… 또는 https://"
						spellCheck={false}
						onChange={(event) => onChange(optional(event.target.value))}
					/>
					{error && <p className="projects-error">{error}</p>}
				</div>
			</div>
			{zoomed && value && <Lightbox items={[toUrl(value)]} start={0} onClose={() => setZoomed(false)} />}
		</FormRow>
	);
};

/** 빈 글자는 필드를 지운다 (고를 수 있는 필드) */
const optional = (value: string) => (value.trim() ? value : undefined);

type EditorTab = 'intro' | 'pictures' | 'content' | 'app' | 'json';
const TABS: [EditorTab, string][] = [
	['intro', '소개'],
	['pictures', '그림'],
	['content', '내용'],
	['app', '앱'],
	['json', 'JSON'],
];

/**
 * 페이지 모양의 작은 도식: 모양마다 바탕과 몇 개의 네모(왼쪽·위·너비·높이 %, 바탕, 덧붙일 모양).
 * 실제 페이지를 그리지 않고 그 모양의 생김새만 (카드 14장을 가볍게)
 */
type Part = [number, number, number, number, string, CSSProperties?];
const round = { borderRadius: '999px' };
const card = { borderRadius: '8%/12%', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' };
const SKETCH: Record<ProjectLook, { bg: string; parts: Part[]; text?: string }> = {
	showcase: {
		bg: 'linear-gradient(160deg, #d9f2ee, #e8e4f7)',
		parts: [
			[6, 9, 52, 54, '#ffffff', card],
			[11, 17, 16, 9, '#2bb3a3', { borderRadius: '2px' }],
			[11, 33, 40, 6, '#2c2f3a'],
			[11, 44, 32, 3.5, '#9aa0ad'],
			[62, 9, 32, 54, '#ffffff', card],
			[66, 18, 22, 3.5, '#9aa0ad'],
			[66, 27, 20, 3.5, '#c6cad3'],
			[66, 36, 23, 3.5, '#c6cad3'],
			[6, 70, 88, 21, '#ffffff', card],
			[12, 77, 12, 7, '#2bb3a3'],
			[44, 77, 12, 7, '#2bb3a3'],
			[74, 77, 12, 7, '#2bb3a3'],
		],
	},
	cinema: {
		bg: '#0b0b10',
		parts: [
			[0, 0, 100, 74, 'linear-gradient(135deg, #39407a, #c45f7c)'],
			[0, 38, 100, 36, 'linear-gradient(transparent, #0b0b10)'],
			[8, 50, 50, 8, '#ffffff'],
			[8, 63, 34, 3.5, '#b8b8c4'],
			[8, 81, 16, 6, '#ffffff', round],
			[40, 83, 20, 2, '#4a4a55', round],
		],
	},
	phone: {
		bg: '#f3f0ea',
		parts: [
			[8, 30, 40, 8, '#24242a'],
			[8, 44, 34, 3.5, '#8d8a85'],
			[8, 51, 28, 3.5, '#8d8a85'],
			[8, 64, 14, 6, '#24242a', round],
			[60, 6, 25, 88, '#141416', { borderRadius: '18%/10%' }],
			[62, 10, 21, 80, 'linear-gradient(180deg, #7fb2ff, #c7a4ff)', { borderRadius: '14%/7%' }],
		],
	},
	horizontal: {
		bg: '#f6f6f4',
		parts: [
			[5, 10, 34, 72, '#ffd166', { borderRadius: '3px' }],
			[42, 10, 34, 72, '#ef476f', { borderRadius: '3px' }],
			[79, 10, 34, 72, '#118ab2', { borderRadius: '3px' }],
			[9, 20, 22, 5, '#3b2f00'],
			[46, 20, 20, 5, '#ffffff'],
			[5, 88, 90, 2.5, '#d9d9d6', round],
			[5, 88, 36, 2.5, '#333333', round],
		],
	},
	brutal: {
		bg: '#fff04d',
		parts: [
			[6, 8, 72, 17, '#111111'],
			[6, 30, 48, 9, '#111111'],
			[6, 50, 40, 38, '#ffffff', { border: '2px solid #111111' }],
			[52, 50, 42, 38, '#ff5ca8', { border: '2px solid #111111' }],
			[10, 57, 24, 4, '#111111'],
		],
	},
	arcade: {
		bg: '#0b0322',
		parts: [
			[0, 58, 100, 42, 'repeating-linear-gradient(90deg, rgba(41,243,255,0.45) 0 1px, transparent 1px 11%)'],
			[0, 58, 100, 1.5, '#ff2bd6'],
			[10, 14, 56, 11, '#ff2bd6', { boxShadow: '0 0 8px #ff2bd6' }],
			[10, 32, 40, 5, '#29f3ff', { boxShadow: '0 0 6px #29f3ff' }],
			[72, 12, 18, 30, 'transparent', { border: '1.5px solid #29f3ff', boxShadow: '0 0 6px #29f3ff' }],
			[0, 0, 100, 100, 'repeating-linear-gradient(rgba(255,255,255,0.07) 0 1px, transparent 1px 3px)'],
		],
	},
	atelier: {
		bg: '#f5f0e6',
		parts: [
			[10, 16, 38, 7, '#2b2925'],
			[10, 30, 32, 2.5, '#8d8271'],
			[10, 36, 36, 2.5, '#8d8271'],
			[10, 42, 26, 2.5, '#8d8271'],
			[58, 14, 32, 58, '#cdbea6'],
			[10, 82, 80, 1, 'rgba(43,41,37,0.25)'],
		],
	},
	inbox: {
		bg: '#ffffff',
		parts: [
			[0, 0, 20, 100, '#eceef3'],
			[4, 10, 12, 3.5, '#7b8191'],
			[4, 18, 10, 3.5, '#a4a9b5'],
			[20, 0, 30, 100, '#f8f8fa'],
			[50, 0, 0.8, 100, '#e3e4e8'],
			[23, 9, 22, 4, '#3d4150'],
			[23, 16, 18, 3, '#a4a9b5'],
			[21.5, 27, 27, 17, '#d5e5ff', { borderRadius: '3px' }],
			[23, 31, 22, 4, '#1d4ed8'],
			[23, 38, 18, 3, '#6b8fd6'],
			[23, 52, 22, 4, '#3d4150'],
			[23, 59, 18, 3, '#a4a9b5'],
			[55, 10, 34, 6, '#22252e'],
			[55, 24, 38, 3, '#a4a9b5'],
			[55, 31, 36, 3, '#a4a9b5'],
			[55, 38, 30, 3, '#a4a9b5'],
		],
	},
	checklist: {
		bg: '#ffffff',
		parts: [
			[10, 9, 42, 8, '#1f1f24'],
			[10, 28, 6, 9.6, '#34c759', round],
			[20, 31, 46, 3.5, '#b5b5bb'],
			[10, 45, 6, 9.6, 'transparent', { ...round, border: '1.5px solid #c7c7cc' }],
			[20, 48, 58, 3.5, '#4a4a52'],
			[10, 62, 6, 9.6, 'transparent', { ...round, border: '1.5px solid #c7c7cc' }],
			[20, 65, 40, 3.5, '#4a4a52'],
			[10, 79, 6, 9.6, 'transparent', { ...round, border: '1.5px solid #c7c7cc' }],
			[20, 82, 52, 3.5, '#4a4a52'],
		],
	},
	repo: {
		bg: '#0d1117',
		parts: [
			[0, 0, 100, 12, '#161b22'],
			[4, 4, 18, 4, '#8b949e'],
			[0, 12, 24, 88, '#0d1117'],
			[24, 12, 0.8, 88, '#30363d'],
			[4, 20, 14, 3, '#58a6ff'],
			[7, 28, 13, 3, '#8b949e'],
			[7, 36, 11, 3, '#8b949e'],
			[4, 44, 15, 3, '#58a6ff'],
			[30, 20, 40, 6, '#e6edf3'],
			[30, 32, 60, 3, '#8b949e'],
			[30, 39, 52, 3, '#8b949e'],
			[30, 50, 64, 34, '#161b22', { border: '1px solid #30363d', borderRadius: '3px' }],
			[34, 57, 30, 3, '#7ee787'],
			[34, 64, 40, 3, '#d2a8ff'],
		],
	},
	dialogue: {
		bg: 'linear-gradient(#8fd3ff, #d4f0ff 60%)',
		parts: [
			[10, 12, 18, 7, '#ffffff'],
			[64, 8, 22, 8, '#ffffff'],
			[6, 6, 16, 10, 'rgba(255,255,255,0.85)', { border: '1.5px solid #2b2b4a' }],
			[0, 56, 100, 44, 'repeating-linear-gradient(90deg, #6cbf4b 0 8%, #63b243 8% 16%)'],
			[6, 62, 88, 31, '#1d1d3a', { border: '2px solid #ffffff', outline: '1.5px solid #1d1d3a' }],
			[11, 70, 50, 4.5, '#ffffff'],
			[11, 79, 36, 4.5, '#ffffff'],
			[84, 85, 4, 4, '#ffd166'],
		],
	},
	deck: {
		bg: '#2b2d31',
		parts: [
			[10, 7, 80, 63, '#ffffff', { borderRadius: '2px' }],
			[16, 17, 40, 8, '#1f2937'],
			[16, 33, 40, 3, '#9ca3af'],
			[16, 40, 34, 3, '#9ca3af'],
			[16, 47, 38, 3, '#9ca3af'],
			[62, 27, 22, 32, '#5b8def'],
			[10, 77, 18, 14, '#ffffff', { outline: '1.5px solid #5b8def', outlineOffset: '1px' }],
			[31, 77, 18, 14, '#6b6e75'],
			[52, 77, 18, 14, '#6b6e75'],
			[73, 77, 17, 14, '#6b6e75'],
		],
	},
	assistant: {
		bg: '#e9e9ec',
		parts: [
			[6, 7, 88, 86, '#ffffff', { borderRadius: '5%/8%', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }],
			[6, 7, 26, 86, '#f2f2f5', { borderRadius: '5% 0 0 5%/8% 0 0 8%' }],
			[10, 18, 3.6, 5.8, '#007aff', round],
			[16, 19, 12, 3, '#2c2c30'],
			[10, 30, 3.6, 5.8, '#c7c7cc', round],
			[16, 31, 11, 3, '#8e8e93'],
			[10, 42, 3.6, 5.8, '#c7c7cc', round],
			[16, 43, 12, 3, '#8e8e93'],
			[38, 18, 40, 7, '#1f1f24'],
			[38, 32, 50, 3, '#a1a1a6'],
			[38, 39, 44, 3, '#a1a1a6'],
			[62, 78, 13, 8, '#e5e5ea', { borderRadius: '3px' }],
			[77, 78, 13, 8, '#007aff', { borderRadius: '3px' }],
		],
	},
	custom: {
		bg: 'linear-gradient(160deg, #f4f4f6, #e4e4e9)',
		parts: [],
		text: '</>',
	},
};

const LookSketch = ({ look }: { look: ProjectLook }) => {
	const { bg, parts, text } = SKETCH[look];
	return (
		<span className="projects-look-sketch" style={{ background: bg }}>
			{parts.map(([left, top, width, height, background, extra], index) => (
				<span
					key={index}
					style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, background, ...extra }}
				/>
			))}
			{text && <b>{text}</b>}
		</span>
	);
};

/** 페이지 모양 고르기: 바탕화면 고르기처럼 작은 그림 카드 격자. ←·→·↑·↓로 옮겨 고른다 (라디오 묶음) */
const LookPicker = ({ value, onChange }: { value: ProjectLook; onChange: (look: ProjectLook) => void }) => {
	const groupRef = useRef<HTMLDivElement>(null);
	const choose = (index: number) => {
		const look = PROJECT_LOOKS[(index + PROJECT_LOOKS.length) % PROJECT_LOOKS.length];
		onChange(look);
		groupRef.current?.querySelector<HTMLElement>(`[data-look="${look}"]`)?.focus();
	};
	return (
		<div className="projects-looks" role="radiogroup" aria-label="페이지 모양" ref={groupRef}>
			{PROJECT_LOOKS.map((look, index) => {
				const checked = look === value;
				return (
					<button
						key={look}
						type="button"
						role="radio"
						aria-checked={checked}
						aria-label={LOOKS[look].name}
						title={`${LOOKS[look].name} (${LOOKS[look].note})`}
						tabIndex={checked ? 0 : -1}
						data-look={look}
						className="projects-look"
						onClick={() => onChange(look)}
						onKeyDown={(event) => {
							const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
							if (!delta) return;
							event.preventDefault();
							choose(index + delta);
						}}
					>
						<span className="projects-look-thumb">
							<LookSketch look={look} />
							{checked && (
								<span className="projects-look-check" aria-hidden="true">
									<i className="fa-solid fa-check" />
								</span>
							)}
						</span>
						<span className="projects-look-name">{LOOKS[look].name}</span>
						<span className="projects-look-note">{LOOKS[look].note}</span>
					</button>
				);
			})}
		</div>
	);
};

/**
 * 목록 편집 (macOS의 표): 둥근 상자 안의 줄 목록과 아래 ＋/− 막대.
 * 줄을 누르면 고른 상태(강조 바탕)가 되고, 끌거나 ⌥↑·⌥↓로 순서를 바꾸고, −나 Delete로 고른 줄을 뺀다.
 * detail이 있으면 고른 항목의 칸을 목록 아래에 연다 (마스터–디테일). 없으면 줄의 칸을 바로 고친다
 */
function ListTable<T>({
	label,
	title = label,
	nested = false,
	hint,
	items,
	onChange,
	blank,
	columns,
	cells,
	detail,
}: {
	/** 목록의 접근성 이름. 항목 칸의 이름 앞부분('주요 기능 1 제목')에도 쓴다 */
	label: string;
	/** 목록 위에 보이는 제목 (없으면 label) */
	title?: string;
	/** 다른 항목의 상세 칸 안에 든 목록: 영역(region)이 아니라 묶음(group)으로 둔다 (바깥 목록의 영역 이름과 겹치지 않게) */
	nested?: boolean;
	hint?: string;
	items: T[];
	onChange: (items: T[]) => void;
	/** ＋로 더하는 빈 항목 */
	blank: () => T;
	/** 줄 위의 열 이름 (칸을 바로 고치는 표) */
	columns?: string[];
	/** 줄의 칸들 */
	cells: (item: T, index: number, update: (next: T) => void) => ReactNode[];
	/** 고른 항목의 상세 칸 */
	detail?: (item: T, index: number, update: (next: T) => void) => ReactNode;
}) {
	const [picked, setPicked] = useState<number | null>(null);
	const selected = picked !== null && picked < items.length ? picked : null;
	const listRef = useRef<HTMLOListElement>(null);
	const sectionRef = useRef<HTMLElement>(null);
	/** 그린 뒤 초점을 줄 곳: 그 줄 자체, 또는 (새로 더한 항목이면) 첫 입력 칸 */
	const pendingFocus = useRef<{ index: number; input: boolean } | null>(null);
	useLayoutEffect(() => {
		const pending = pendingFocus.current;
		if (!pending) return;
		pendingFocus.current = null;
		const row = listRef.current?.children[pending.index] as HTMLElement | undefined;
		if (!pending.input) return row?.focus();
		const field =
			sectionRef.current?.querySelector<HTMLElement>(
				'.projects-detail input:not([type="file"]), .projects-detail textarea'
			) ?? row?.querySelector<HTMLElement>('input');
		field?.focus();
	});
	const update = (index: number) => (next: T) => onChange(items.map((item, i) => (i === index ? next : item)));
	const select = (index: number, focus = true) => {
		setPicked(index);
		if (focus) pendingFocus.current = { index, input: false };
	};
	const add = () => {
		onChange([...items, blank()]);
		setPicked(items.length);
		pendingFocus.current = { index: items.length, input: true };
	};
	const remove = (index: number) => {
		onChange(items.filter((_, i) => i !== index));
		const next = Math.min(index, items.length - 2);
		setPicked(next >= 0 ? next : null);
		if (next >= 0) pendingFocus.current = { index: next, input: false };
	};
	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= items.length) return;
		onChange(moveItem(items, index, delta));
		select(target);
	};
	return (
		<section
			className={`projects-group${nested ? ' nested' : ''}`}
			role={nested ? 'group' : undefined}
			aria-label={label}
			ref={sectionRef}
		>
			<h3 className="projects-group-title">
				{title}
				<span className="projects-group-count">{items.length}</span>
			</h3>
			<div className="projects-box projects-table">
				{columns && items.length > 0 && (
					<div className="projects-table-head" aria-hidden="true">
						{columns.map((column) => (
							<span key={column}>{column}</span>
						))}
					</div>
				)}
				{items.length > 0 ? (
					<ol
						className={`projects-table-rows ${columns ? 'columns' : ''}`}
						role="grid"
						aria-label={label}
						ref={listRef}
					>
						{items.map((item, index) => (
							<li
								key={index}
								role="row"
								aria-selected={index === selected}
								aria-rowindex={index + 1}
								tabIndex={index === (selected ?? 0) ? 0 : -1}
								className="projects-table-row"
								onFocus={(event) => {
									if (event.target !== event.currentTarget) setPicked(index);
								}}
								onPointerDown={(event) => {
									if (event.button !== 0) return;
									if ((event.target as HTMLElement).closest('input, textarea, select, button, label')) return;
									setPicked(index);
									event.currentTarget.focus();
									if (items.length < 2) return;
									// 줄을 끌어서 순서 바꾸기 (프로젝트 목록의 ≡ 손잡이와 같은 동작)
									startPointerReorder(event, (from, to) => {
										onChange(moveItem(items, from, to - from));
										select(to);
									});
								}}
								onKeyDown={(event) => {
									if (event.target !== event.currentTarget) return;
									if (event.altKey) {
										const delta = reorderKeyDelta(event.key);
										if (!delta) return;
										event.preventDefault();
										move(index, delta);
									} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
										event.preventDefault();
										select(Math.min(items.length - 1, Math.max(0, index + (event.key === 'ArrowUp' ? -1 : 1))));
									} else if (event.key === 'Delete' || event.key === 'Backspace') {
										event.preventDefault();
										remove(index);
									}
								}}
							>
								{cells(item, index, update(index)).map((cell, column) => (
									<div key={column} role="gridcell" className="projects-table-cell">
										{cell}
									</div>
								))}
							</li>
						))}
					</ol>
				) : (
					<p className="projects-table-empty">항목이 없습니다. ＋를 눌러 더합니다.</p>
				)}
				<div className="projects-table-bar">
					<span className="projects-segmented">
						<button type="button" aria-label="더하기" title="항목 더하기" onClick={add}>
							<svg viewBox="0 0 10 10" aria-hidden="true">
								<path d="M5 1v8M1 5h8" />
							</svg>
						</button>
						<button
							type="button"
							aria-label="빼기"
							title="고른 항목 빼기"
							disabled={selected === null}
							onClick={() => selected !== null && remove(selected)}
						>
							<svg viewBox="0 0 10 10" aria-hidden="true">
								<path d="M1 5h8" />
							</svg>
						</button>
					</span>
					{hint && <span className="projects-table-note">{hint}</span>}
				</div>
			</div>
			{detail && selected !== null && (
				<div className="projects-box projects-detail" role="group" aria-label={`${label} ${selected + 1}`}>
					<p className="projects-detail-title">
						{`${label} ${selected + 1}`}
						<span>{`${items.length}개 가운데 ${selected + 1}번째`}</span>
					</p>
					<div key={selected}>{detail(items[selected], selected, update(selected))}</div>
				</div>
			)}
		</section>
	);
}

/** 줄 오른쪽의 16:10 썸네일 (그림이 없으면 빈 칸) */
const RowThumb = ({ src }: { src?: string }) => (
	<span className={`projects-row-thumb ${src ? 'filled' : 'empty'}`} aria-hidden="true">
		{src ? <img src={src} alt="" loading="lazy" /> : <i className="fa-regular fa-image" />}
	</span>
);

/** 고를 수 있는 필드를 바꾼다: undefined가 된 키는 지운다 */
const patchOf = <T extends object>(item: T, change: Partial<T>): T => {
	const next = { ...item, ...change };
	for (const key of Object.keys(change) as (keyof T)[]) if (next[key] === undefined) delete next[key];
	return next;
};

type Shot = NonNullable<ProjectPoint['shots']>[number];

/** 화면 여러 장: 항목의 상세 칸 안에 든 작은 목록. 줄에는 그림과 설명, 고르면 아래에서 그림을 고르고 설명을 적는다 */
const ShotsEditor = ({
	label,
	shots,
	onChange,
}: {
	label: string;
	shots: Shot[];
	onChange: (shots: Shot[]) => void;
}) => (
	<ListTable<Shot>
		label={label}
		title="화면 여러 장"
		nested
		hint="글 옆이나 아래에 차례로 보입니다. .mp4 주소는 화면에 보일 때만 도는 영상이 됩니다."
		items={shots}
		onChange={onChange}
		blank={() => ({ src: '', alt: '' })}
		cells={(shot) => [
			<span className="projects-point" key="text">
				<strong className={shot.alt.trim() ? '' : 'placeholder'}>{shot.alt.trim() || '설명 없음'}</strong>
				<span>{shot.src || '그림을 고르지 않았습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={shot.src && !shot.src.endsWith('.mp4') ? shot.src : undefined} />,
		]}
		detail={(shot, index, update) => (
			<>
				<ImageField
					label="그림"
					name={`${label} ${index + 1} 그림`}
					shape="wide"
					value={shot.src || undefined}
					onChange={(src) => update({ ...shot, src: src ?? '' })}
				/>
				<TextField
					label="설명"
					ariaLabel={`${label} ${index + 1} 설명`}
					value={shot.alt}
					placeholder="예: 첫 화면"
					onChange={(alt) => update({ ...shot, alt })}
				/>
			</>
		)}
	/>
);

/** 항목 하나의 칸: 제목, 설명, 자세히, 그림, 화면 여러 장, 영상, 아이콘 */
const PointFields = ({
	label,
	point,
	update,
}: {
	/** 항목 이름 ('주요 기능 1'): 칸마다 접근성 이름 앞에 붙인다 */
	label: string;
	point: ProjectPoint;
	update: (next: ProjectPoint) => void;
}) => (
	<>
		<TextField
			label="제목"
			ariaLabel={`${label} 제목`}
			value={point.title}
			onChange={(title) => update(patchOf(point, { title }))}
		/>
		<TextField
			label="설명"
			multiline
			ariaLabel={`${label} 설명`}
			value={point.body}
			onChange={(body) => update(patchOf(point, { body }))}
		/>
		<TextField
			label="자세히"
			multiline
			rows={4}
			ariaLabel={`${label} 자세히`}
			value={point.detail}
			hint="펼쳐 읽거나 다음 장으로 넘길 때 더 보이는 설명입니다."
			onChange={(detail) => update(patchOf(point, { detail: optional(detail) }))}
		/>
		<ImageField
			label="그림"
			name={`${label} 그림`}
			shape="wide"
			value={point.image}
			hint={point.video ? '영상이 있으면 그림 대신 영상이 보입니다. 그림을 보이려면 영상 칸을 비웁니다.' : undefined}
			// 다크 테마 그림은 원래 그림과 짝이라, 그림을 바꾸면 함께 지운다 (옛 화면이 밀대 반쪽에 남지 않게)
			onChange={(image) => update(patchOf(point, { image, imageDark: undefined }))}
		/>
		<ShotsEditor
			label={`${label} 화면`}
			shots={point.shots ?? []}
			onChange={(shots) => update(patchOf(point, { shots: shots.length ? shots : undefined }))}
		/>
		<TextField
			label="영상"
			ariaLabel={`${label} 영상`}
			value={point.video}
			placeholder="/imgs/….mp4 또는 https://"
			hint="그림 대신 화면에 보일 때만 도는 짧은 영상입니다."
			onChange={(video) => update(patchOf(point, { video: optional(video) }))}
		/>
		<TextField
			label="아이콘"
			ariaLabel={`${label} 아이콘`}
			value={point.icon}
			placeholder="예: fa-bolt"
			hint="카드와 번호 자리에 보이는 Font Awesome 아이콘 이름입니다 (fa-로 시작)."
			onChange={(icon) => update(patchOf(point, { icon: optional(icon) }))}
		/>
	</>
);

/** 제목·설명(·그림) 묶음 목록: 주요 기능, 만든 방식, 쓰는 법, 장 안 항목. 줄에는 제목·설명 첫 줄·그림, 고르면 아래에서 고친다 */
const PointsEditor = ({
	label,
	title,
	nested = false,
	hint,
	points,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	points: ProjectPoint[];
	onChange: (points: ProjectPoint[]) => void;
}) => (
	<ListTable<ProjectPoint>
		label={label}
		title={title}
		nested={nested}
		hint={hint}
		items={points}
		onChange={onChange}
		blank={() => ({ title: '', body: '' })}
		cells={(point) => [
			<span className="projects-point" key="text">
				<strong className={point.title.trim() ? '' : 'placeholder'}>{point.title.trim() || '제목 없음'}</strong>
				<span>{point.body.trim() || '설명이 없습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={point.image ?? point.shots?.find((shot) => !shot.src.endsWith('.mp4'))?.src} />,
		]}
		detail={(point, index, update) => <PointFields label={`${label} ${index + 1}`} point={point} update={update} />}
	/>
);

/** 두 칸짜리 줄 목록: 진행 과정(때·한 일), 기술 사양(분류·기술), 숫자(값·이름표). 표의 칸을 바로 고친다 */
const PairsEditor = <K extends string>({
	label,
	title,
	nested = false,
	hint,
	keys,
	names,
	placeholders,
	rows,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	keys: [K, K];
	names: [string, string];
	placeholders?: [string, string];
	rows: Record<K, string>[];
	onChange: (rows: Record<K, string>[]) => void;
}) => (
	<ListTable
		label={label}
		title={title}
		nested={nested}
		hint={hint}
		items={rows}
		onChange={onChange}
		blank={() => ({ [keys[0]]: '', [keys[1]]: '' }) as Record<K, string>}
		columns={names}
		cells={(row, index, update) =>
			keys.map((key, k) => (
				<input
					key={key}
					className="projects-cell-input"
					aria-label={`${label} ${index + 1} ${names[k]}`}
					placeholder={placeholders?.[k] ?? names[k]}
					value={row[key]}
					onChange={(event) => update({ ...row, [key]: event.target.value })}
				/>
			))
		}
	/>
);

/** 한 줄씩: 맡은 일 */
const LinesEditor = ({
	label,
	hint,
	lines,
	onChange,
}: {
	label: string;
	hint?: string;
	lines: string[];
	onChange: (lines: string[]) => void;
}) => (
	<ListTable
		label={label}
		hint={hint}
		items={lines}
		onChange={onChange}
		blank={() => ''}
		cells={(line, index, update) => [
			<input
				key="line"
				className="projects-cell-input"
				aria-label={`${label} ${index + 1}`}
				placeholder="한 일을 한 줄로 적습니다."
				value={line}
				onChange={(event) => update(event.target.value)}
			/>,
		]}
	/>
);

/**
 * 장: 주요 기능과 만든 방식 말고 더 들려줄 이야기 (브루탈·아틀리에·메일함·할 일 앱·RPG 대화창·발표 슬라이드가 그린다).
 * 줄에는 장 제목과 머리말, 고르면 아래에서 제목·머리말·숫자·항목·장 그림을 고친다.
 * 장 모양(look)·테마(palette)·데이터 구조(schema)·전후 비교(compare)는 코드로 짜는 연출이라 JSON에서만 고친다
 */
const ChaptersEditor = ({
	chapters,
	onChange,
}: {
	chapters: ProjectChapter[];
	onChange: (chapters: ProjectChapter[]) => void;
}) => (
	<ListTable<ProjectChapter>
		label="장"
		hint="주요 기능·만든 방식 뒤에 이어지는 이야기입니다. 모양마다 그 페이지에 맞는 꼴로 그립니다."
		items={chapters}
		onChange={onChange}
		blank={() => ({ title: '', points: [] })}
		cells={(chapter) => [
			<span className="projects-point" key="text">
				<strong className={chapter.title.trim() ? '' : 'placeholder'}>{chapter.title.trim() || '제목 없음'}</strong>
				<span>{chapter.lead?.trim() || `항목 ${chapter.points.length}개`}</span>
			</span>,
			<RowThumb key="thumb" src={chapter.image?.src} />,
		]}
		detail={(chapter, index, update) => {
			const name = `장 ${index + 1}`;
			return (
				<>
					<TextField
						label="장 제목"
						ariaLabel={`${name} 제목`}
						value={chapter.title}
						onChange={(title) => update(patchOf(chapter, { title }))}
					/>
					<TextField
						label="머리말"
						multiline
						ariaLabel={`${name} 머리말`}
						value={chapter.lead}
						hint="장 첫머리에 크게 보이는 한두 문장입니다."
						onChange={(lead) => update(patchOf(chapter, { lead: optional(lead) }))}
					/>
					<PairsEditor
						label={`${name} 숫자`}
						title="장 숫자"
						nested
						keys={['value', 'label']}
						names={['값', '이름표']}
						placeholders={['예: 3배', '예: 빨라진 저장']}
						rows={chapter.facts ?? []}
						onChange={(facts) => update(patchOf(chapter, { facts: facts.length ? facts : undefined }))}
					/>
					<PointsEditor
						label={`${name} 항목`}
						title="장 안 항목"
						nested
						points={chapter.points}
						onChange={(points) => update(patchOf(chapter, { points }))}
					/>
					<ImageField
						label="장 그림"
						name={`${name} 그림`}
						shape="wide"
						value={chapter.image?.src}
						hint="장 끝이나 옆에 크게 보입니다."
						onChange={(src) =>
							update(
								patchOf(chapter, {
									image: src ? { ...chapter.image, src, alt: chapter.image?.alt ?? '' } : undefined,
								})
							)
						}
					/>
					{chapter.image && (
						<TextField
							label="그림 설명"
							ariaLabel={`${name} 그림 설명`}
							value={chapter.image.alt}
							hint="비워 두면 장 제목을 씁니다."
							onChange={(alt) => chapter.image && update({ ...chapter, image: { ...chapter.image, alt } })}
						/>
					)}
				</>
			);
		}}
	/>
);

type Control = NonNullable<Project['controls']>[number];

/** 조작법 (아케이드·RPG 대화창): 키 여러 개(쉼표로)와 설명. 표의 칸을 바로 고친다 */
const ControlsEditor = ({ controls, onChange }: { controls: Control[]; onChange: (controls: Control[]) => void }) => (
	<ListTable<Control>
		label="조작법"
		hint="키는 쉼표로 나눠 적습니다 (예: ←, →). 게임을 담은 아케이드·RPG 대화창 모양이 보여 줍니다."
		items={controls}
		onChange={onChange}
		blank={() => ({ keys: [], label: '' })}
		columns={['키', '설명']}
		cells={(control, index, update) => [
			<input
				key="keys"
				className="projects-cell-input"
				aria-label={`조작법 ${index + 1} 키`}
				placeholder="예: Shift, Space"
				value={control.keys.join(', ')}
				onChange={(event) => update({ ...control, keys: event.target.value.split(/, ?/) })}
			/>,
			<input
				key="label"
				className="projects-cell-input"
				aria-label={`조작법 ${index + 1} 설명`}
				placeholder="예: 달리기"
				value={control.label}
				onChange={(event) => update({ ...control, label: event.target.value })}
			/>,
		]}
	/>
);

type Credit = NonNullable<Project['credits']>[number];

/** 출처: 빌려 쓴 에셋·글꼴. 줄에는 이름과 만든 사람, 고르면 아래에서 맡은 부분·이름·만든 사람·주소·한 줄 설명을 고친다 */
const CreditsEditor = ({ credits, onChange }: { credits: Credit[]; onChange: (credits: Credit[]) => void }) => (
	<ListTable<Credit>
		label="출처"
		hint="빌려 쓴 그림·글꼴·소리를 적습니다. 브루탈·아케이드·저장소·발표 슬라이드 모양이 보여 줍니다."
		items={credits}
		onChange={onChange}
		blank={() => ({ role: '', name: '', by: '' })}
		cells={(credit) => [
			<span className="projects-point" key="text">
				<strong className={credit.name.trim() ? '' : 'placeholder'}>{credit.name.trim() || '이름 없음'}</strong>
				<span>
					{[credit.role, credit.by].filter((part) => part.trim()).join(' · ') || '맡은 부분과 만든 사람이 없습니다.'}
				</span>
			</span>,
		]}
		detail={(credit, index, update) => {
			const name = `출처 ${index + 1}`;
			return (
				<>
					<TextField
						label="맡은 부분"
						ariaLabel={`${name} 맡은 부분`}
						value={credit.role}
						placeholder="예: 글꼴"
						onChange={(role) => update({ ...credit, role })}
					/>
					<TextField
						label="이름"
						ariaLabel={`${name} 이름`}
						value={credit.name}
						onChange={(value) => update({ ...credit, name: value })}
					/>
					<TextField
						label="만든 사람"
						ariaLabel={`${name} 만든 사람`}
						value={credit.by}
						onChange={(by) => update({ ...credit, by })}
					/>
					<TextField
						label="주소"
						type="url"
						ariaLabel={`${name} 주소`}
						value={credit.href}
						placeholder="https://"
						onChange={(href) => update(patchOf(credit, { href: optional(href) }))}
					/>
					<TextField
						label="한 줄 설명"
						ariaLabel={`${name} 한 줄 설명`}
						value={credit.note}
						placeholder="예: CC BY 4.0"
						onChange={(note) => update(patchOf(credit, { note: optional(note) }))}
					/>
				</>
			);
		}}
	/>
);

/** 화면 모음 폴더의 그림 격자 (12장까지). 누르면 크게 보기 */
const FolderShots = ({ folder }: { folder: string }) => {
	const [zoomed, setZoomed] = useState<number | null>(null);
	const all = PUBLIC_IMAGES[folder] ?? [];
	const shots = all.slice(0, 12);
	return (
		<div className="projects-shots">
			<p className="projects-shots-count">
				{all.length > 12 ? `${all.length}장 가운데 12장을 미리 봅니다.` : `${all.length}장이 있습니다.`}
			</p>
			<ul className="projects-shots-grid" aria-label="화면 모음 미리 보기">
				{shots.map((src, index) => (
					<li key={src}>
						<button type="button" aria-label={`${fileName(src)} 크게 보기`} onClick={() => setZoomed(index)}>
							{src.endsWith('.mp4') ? <video src={src} muted /> : <img src={src} alt="" loading="lazy" />}
						</button>
					</li>
				))}
			</ul>
			{zoomed !== null && <Lightbox items={all} start={zoomed} onClose={() => setZoomed(null)} />}
		</div>
	);
};

/** 오른쪽 패널 단추 모양 (macOS의 sidebar.right) */
const SidebarRightIcon = () => (
	<svg viewBox="0 0 18 14" aria-hidden="true" className="projects-toolbar-glyph">
		<rect x="0.75" y="0.75" width="16.5" height="12.5" rx="2.5" />
		<path d="M11.5 1v12" />
	</svg>
);

/**
 * 프로젝트 하나 고치기: 기본 필드 폼, 앱(데모를 창 안의 iframe으로), 고급 JSON (모든 필드).
 * 완료를 누르면 서버와 같은 규칙으로 검사하고 목록으로 돌아간다 (저장은 목록에서)
 */
const ProjectEditor = ({
	row,
	takenIds,
	onDone,
	onCancel,
}: {
	row: Row;
	takenIds: string[];
	onDone: (row: Row) => void;
	onCancel: () => void;
}) => {
	const [id, setId] = useState(row.id);
	const [draft, setDraft] = useState<Project>(row.project);
	const [tab, setTab] = useState<EditorTab>('intro');
	/** 오른쪽에 Safari 페이지를 그대로 그려 둔다 (고치는 대로 바뀐다). 단추로 접고 편다 */
	const [preview, setPreview] = useState(true);
	// 폼과 미리 보기가 나란히 들어가게 창을 키운다 (이미 크면 그대로)
	useEffect(() => {
		if (preview) requestWindowSize('settings', 1280, 740);
	}, [preview]);
	const formRef = useRef<HTMLDivElement>(null);
	const [json, setJson] = useState('');
	const [errors, setErrors] = useState<string[]>([]);
	/** 예시로 채운 횟수: 칸들이 새 값으로 처음부터 다시 그려지게 (기간 칸처럼 처음 값만 읽는 칸이 있다) */
	const [filled, setFilled] = useState(0);
	const [confirmingSample, setConfirmingSample] = useState(false);
	const fillSample = () => {
		setConfirmingSample(false);
		setDraft(fillWithSample({ ...draft, id }));
		setErrors([]);
		setFilled((count) => count + 1);
		if (tab === 'json') setTab('intro');
	};
	/** 지금 고른 모양이 이 필드를 쓰는지 (모양 전용 칸을 보일지) */
	const lookUses = (field: keyof LookSample) =>
		draft.look !== 'custom' && (LOOK_FIELDS[draft.look] as readonly string[]).includes(field);
	const set = (patch: Partial<Project>) => {
		const next = { ...draft, ...patch };
		for (const key of Object.keys(patch) as (keyof Project)[]) if (next[key] === undefined) delete next[key];
		setDraft(next);
	};
	const setApp = (patch: Partial<ProjectAppInfo>) => {
		const next: ProjectAppInfo = { ...(draft.app as ProjectAppInfo), ...patch };
		for (const key of Object.keys(patch) as (keyof ProjectAppInfo)[]) if (next[key] === undefined) delete next[key];
		set({ app: next });
	};

	const openJson = () => {
		setJson(JSON.stringify(withoutId(draft), null, 2));
		setErrors([]);
		setTab('json');
	};
	/** 고급 JSON을 읽어 들인다. 틀리면 그대로 두고 이유를 보여 준다 */
	const readJson = (): Project | null => {
		let value: unknown;
		try {
			value = JSON.parse(json);
		} catch (error) {
			setErrors([`JSON을 읽지 못했습니다: ${(error as Error).message}`]);
			return null;
		}
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			setErrors(['프로젝트 하나를 { }로 써 주세요.']);
			return null;
		}
		const missing = REQUIRED.filter((key) => (value as Record<string, unknown>)[key] === undefined);
		if (missing.length) {
			setErrors([`꼭 있어야 하는 필드가 없습니다: ${missing.join(', ')}`]);
			return null;
		}
		const checked = validate(id, { ...(value as Project), id });
		if ('errors' in checked) {
			setErrors(checked.errors);
			return null;
		}
		return checked.value;
	};

	const finish = () => {
		const project = tab === 'json' ? readJson() : draft;
		if (!project) return;
		const newId = id.trim();
		if (row.isNew && takenIds.includes(newId)) return setErrors([`'${newId}'는 이미 있는 id입니다.`]);
		const checked = validate(newId, { ...project, id: newId });
		if ('errors' in checked) return setErrors(checked.errors);
		onDone({ ...row, id: newId, project: checked.value });
	};

	const app = draft.app;
	return (
		<>
			<form
				className="projects-editor"
				aria-label={`${row.project.name} 편집`}
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					finish();
				}}
			>
				{/* 창 맨 위 도구 막대: 왼쪽 돌아가기와 이름, 가운데 탭(세그먼트), 오른쪽 미리 보기 패널 단추와 완료 */}
				<div className="projects-toolbar">
					<div className="projects-toolbar-start">
						<button
							type="button"
							className="projects-toolbar-button"
							aria-label="프로젝트 목록으로 돌아가기"
							title="고친 것을 버리고 프로젝트 목록으로 돌아갑니다."
							onClick={onCancel}
						>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" />
						</button>
						<h3 className="projects-toolbar-title">{draft.name.trim() || '새 프로젝트'}</h3>
					</div>
					<div className="projects-tabs" role="tablist" aria-label="편집 항목">
						{TABS.map(([key, label]) => (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={tab === key}
								onClick={() => {
									if (tab === key) return;
									if (tab === 'json') {
										const project = readJson();
										if (!project) return;
										setDraft(project);
										setErrors([]);
									}
									if (key === 'json') openJson();
									else setTab(key);
									formRef.current?.scrollTo({ top: 0 });
								}}
							>
								{label}
							</button>
						))}
					</div>
					<div className="projects-toolbar-end">
						{/* 새 프로젝트만: 지금 고른 페이지 모양의 예시 내용을 칸에 채운다 (lookSamples.ts) */}
						{row.isNew && (
							<button
								type="button"
								className="projects-button"
								title="지금 고른 페이지 모양의 예시 내용으로 칸을 채웁니다. id·저장소·데모·앱은 그대로 둡니다."
								onClick={() => (hasContent(draft) ? setConfirmingSample(true) : fillSample())}
							>
								예시로 채우기
							</button>
						)}
						<button
							type="button"
							className="projects-toolbar-button"
							aria-label="미리 보기"
							title={preview ? '미리 보기를 접습니다.' : '미리 보기를 엽니다.'}
							aria-pressed={preview}
							onClick={() => setPreview((value) => !value)}
						>
							<SidebarRightIcon />
						</button>
						<button type="submit" className="projects-button primary">
							완료
						</button>
					</div>
				</div>

				<div className={`projects-editor-body ${preview ? 'with-preview' : ''}`}>
					<div className="projects-editor-form" ref={formRef}>
						<div className="projects-editor-column" key={filled}>
							{errors.length > 0 && (
								<ul className="about-pane-errors" role="alert">
									{errors.map((error) => (
										<li key={error}>{error}</li>
									))}
								</ul>
							)}
							{tab === 'json' && (
								<Group
									title="JSON"
									label="고급 JSON"
									hint="모든 필드를 고칠 수 있습니다 (장, 출처, 조작법 등). 링크·데모는 https:// 주소, 그림은 사이트 안 경로(/imgs/…)나 https:// 주소만 받습니다."
								>
									<textarea
										className="projects-json"
										aria-label="프로젝트 JSON"
										value={json}
										spellCheck={false}
										onChange={(event) => setJson(event.target.value)}
									/>
								</Group>
							)}
							{tab === 'intro' && (
								<>
									<Group title="소개">
										{row.isNew && (
											<TextField
												label="id"
												value={id}
												onChange={setId}
												required
												hint="주소와 앱 이름에 쓰입니다. 영어 소문자·숫자·-로 적습니다 (예: my-project)."
											/>
										)}
										<TextField label="이름" value={draft.name} onChange={(name) => set({ name })} required />
										<TextField label="큰 제목" value={draft.tagline} onChange={(tagline) => set({ tagline })} />
										<TextField
											label="한 줄 소개"
											multiline
											value={draft.description}
											onChange={(description) => set({ description })}
										/>
										<TextField label="어떤 프로젝트" value={draft.context} onChange={(context) => set({ context })} />
										<TextField label="맡은 일" value={draft.role} onChange={(role) => set({ role: optional(role) })} />
										<PeriodField value={draft.period} onChange={(period) => set({ period })} />
									</Group>
									<Group
										title="페이지 모양"
										label="페이지 모양 고르기"
										hint={
											draft.look === 'custom'
												? hasCustomPage(draft.id)
													? `코드에 등록된 ${draft.id} 전용 페이지로 그립니다.`
													: `코드에 ${draft.id} 전용 페이지가 없어 기본 (카드)로 그립니다. 저장소의 safari/project/custom/에 등록하세요.`
												: 'Safari에서 이 프로젝트를 여는 페이지의 모양입니다. 고르면 미리 보기가 바로 바뀝니다.'
										}
									>
										<LookPicker value={draft.look} onChange={(look) => set({ look })} />
									</Group>
									{/* 모양 설정: 어떤 모양에서만 쓰는 칸은 그 모양을 골랐을 때만 여기에 보인다 (값은 모양을 바꿔도 남는다) */}
									{lookUses('art') && (
										<Group title="장면 그림" label="장면">
											<ImageField
												label="장면 그림"
												shape="wide"
												value={draft.art}
												onChange={(art) => set({ art })}
												hint="아케이드 모양의 첫 화면과 RPG 대화창 모양의 표지에 대표 화면 대신 크게 보입니다. 없으면 대표 화면을 씁니다."
											/>
										</Group>
									)}
									{lookUses('backdrop') && (
										<Group
											title="대화창 배경"
											hint="RPG 대화창 모양의 하늘·바닥·소품을 고릅니다. 자동은 배경 그림이 없으면 대표 화면을 픽셀로 바꿔 깔고, 강조색은 언제나 프로젝트 아이콘의 색을 따릅니다."
										>
											<FormRow label="배경 테마" htmlFor="projects-backdrop-theme" align="end">
												<Popup
													id="projects-backdrop-theme"
													value={draft.backdrop?.theme ?? 'auto'}
													onChange={(theme) =>
														set({ backdrop: tidyBackdrop({ ...draft.backdrop, theme: theme as BackdropTheme }) })
													}
												>
													{BACKDROP_THEMES.map((theme) => (
														<option key={theme} value={theme}>
															{BACKDROP_LABEL[theme]}
														</option>
													))}
												</Popup>
											</FormRow>
											<ImageField
												label="배경 그림"
												shape="wide"
												value={draft.backdrop?.image}
												onChange={(image) => set({ backdrop: tidyBackdrop({ ...draft.backdrop, image }) })}
												hint="RPG 대화창 모양의 배경으로 씁니다. 그림은 픽셀 모양으로 바뀌어 보입니다."
											/>
										</Group>
									)}
									{lookUses('controls') && (
										<ControlsEditor
											controls={draft.controls ?? []}
											onChange={(controls) => set({ controls: controls.length ? controls : undefined })}
										/>
									)}
									{lookUses('conventions') && (
										<PairsEditor
											label="커밋 규칙"
											hint="저장소 모양의 Conventions 탭과 커밋 그래프의 색에 쓰입니다."
											keys={['type', 'description']}
											names={['타입', '설명']}
											placeholders={['예: feat', '예: 새 기능']}
											rows={draft.conventions ?? []}
											onChange={(conventions) => set({ conventions: conventions.length ? conventions : undefined })}
										/>
									)}
									<Group title="주소와 기술">
										<TextField
											label="저장소"
											required
											type="url"
											value={draft.url}
											onChange={(url) => set({ url })}
											placeholder="https://github.com/아이디/저장소"
										/>
										<TextField
											label="데모"
											type="url"
											value={draft.demo}
											onChange={(demo) => set({ demo: optional(demo) })}
											placeholder="https://"
										/>
										<ChoiceInput
											label="주 언어"
											value={draft.language}
											options={LANGUAGES}
											onChange={(language) => set({ language })}
										/>
										<TagInput
											label="기술"
											items={draft.stack}
											options={STACKS}
											remote={NPM}
											onChange={(stack) => set({ stack })}
										/>
									</Group>
								</>
							)}
							{tab === 'pictures' && (
								<>
									{/* 대표 화면(image)은 따로 고르지 않는다: 화면 모음의 첫 그림을 쓴다 (다른 장을 쓰려면 JSON의 image).
								    글자 로고(logo)도 폼에는 두지 않는다: 쓰는 프로젝트가 드물고 아이콘과 헷갈린다 (필요하면 JSON의 logo) */}
									<Group title="아이콘" label="그림">
										<ImageField
											label="프로젝트 아이콘"
											value={draft.icon}
											onChange={(icon) => set({ icon })}
											hint="네모난 앱 아이콘입니다. Safari 탭·Finder·페이지 맨 위에 작게 보이고, 없으면 기본 모양을 씁니다."
										/>
									</Group>
									<Group
										title="화면 모음"
										hint="폴더를 고르면 그 안의 그림을 이름 순으로 모두 화면 모음으로 보여 줍니다 (설명은 파일 이름). 그림은 저장소의 apps/react/public/imgs/projects 아래 폴더에 넣고 배포하면 여기에 나옵니다."
									>
										<FormRow label="폴더" htmlFor="projects-gallery-folder" align="end">
											<Popup
												id="projects-gallery-folder"
												value={draft.galleryFolder ?? ''}
												onChange={(folder) => set({ galleryFolder: optional(folder) })}
											>
												<option value="">
													{draft.gallery?.length ? `직접 적은 화면 ${draft.gallery.length}장` : '없음'}
												</option>
												{/* 같은 프로젝트 폴더 아래의 것끼리 묶는다 (묶음 이름은 그 프로젝트 이름) */}
												{FOLDER_GROUPS.map((group) => (
													<optgroup key={group.label} label={group.label}>
														{group.folders.map((folder) => (
															<option key={folder.value} value={folder.value}>
																{folder.label} ({PUBLIC_IMAGES[folder.value].length}장)
															</option>
														))}
													</optgroup>
												))}
											</Popup>
										</FormRow>
										{draft.galleryFolder && <FolderShots key={draft.galleryFolder} folder={draft.galleryFolder} />}
									</Group>
								</>
							)}
							{tab === 'content' && (
								<>
									<p className="projects-tab-hint">
										목록의 줄을 눌러 고르고, 끌거나 ⌥↑·⌥↓ 키로 순서를 바꿉니다. ＋로 항목을 더하고, −로 고른 항목을
										뺍니다.
									</p>
									<PairsEditor
										label="한눈에 보는 숫자"
										keys={['value', 'label']}
										names={['값', '이름표']}
										placeholders={['예: 6주', '예: 개발 기간']}
										rows={draft.facts}
										onChange={(facts) => set({ facts })}
									/>
									<PointsEditor
										label="주요 기능"
										hint="첫 항목은 크게 보이고, 그림이 있으면 바탕이 됩니다."
										points={draft.highlights}
										onChange={(highlights) => set({ highlights })}
									/>
									<PointsEditor
										label="만든 방식"
										hint="번호가 붙어 좌우로 번갈아 놓이고, 그림이 있으면 옆에 함께 보입니다."
										points={draft.build}
										onChange={(build) => set({ build })}
									/>
									<PointsEditor
										label="쓰는 법"
										hint="단계로 보입니다."
										points={draft.usage ?? []}
										onChange={(usage) => set({ usage: usage.length ? usage : undefined })}
									/>
									<ChaptersEditor
										chapters={draft.chapters ?? []}
										onChange={(chapters) => set({ chapters: chapters.length ? chapters : undefined })}
									/>
									<PairsEditor
										label="진행 과정"
										keys={['date', 'label']}
										names={['때', '한 일']}
										rows={draft.timeline ?? []}
										onChange={(timeline) => set({ timeline: timeline.length ? timeline : undefined })}
									/>
									<PairsEditor
										label="기술 사양"
										keys={['label', 'value']}
										names={['분류', '기술']}
										rows={draft.specs}
										onChange={(specs) => set({ specs })}
									/>
									<LinesEditor
										label="맡은 일"
										lines={draft.contributions}
										onChange={(contributions) => set({ contributions })}
									/>
									<Group
										label="폴더 구조"
										hint="저장소의 폴더 트리를 그대로 붙여 넣습니다. 브루탈·저장소·발표 슬라이드 모양이 고정폭 글꼴로 보여 줍니다."
									>
										<TextField
											label="폴더 구조"
											multiline
											mono
											rows={8}
											value={draft.structure}
											placeholder={'src/\n├── app/\n└── features/'}
											onChange={(structure) => set({ structure: optional(structure) })}
										/>
									</Group>
									<CreditsEditor
										credits={draft.credits ?? []}
										onChange={(credits) => set({ credits: credits.length ? credits : undefined })}
									/>
								</>
							)}
							{tab === 'app' && (
								<>
									<Group title="앱">
										<Switch
											label="이 사이트 안에서 창으로 열기"
											checked={Boolean(app)}
											hint="데모를 창 안(iframe)에 띄우는 앱을 만듭니다. Dock·Launchpad·터미널 open에 나옵니다."
											onChange={(on) =>
												set({
													app: on
														? (row.project.app ?? {
																label: draft.name,
																icon: draft.icon ? draft.icon.replace(/^\/imgs\//, '') : '',
															})
														: undefined,
												})
											}
										/>
									</Group>
									{app && (
										<Group title="앱 설정">
											<TextField label="앱 이름" value={app.label} onChange={(label) => setApp({ label })} required />
											<ImageField
												label="앱 아이콘"
												required
												value={app.icon || undefined}
												onChange={(icon) => setApp({ icon: icon ?? '' })}
												toUrl={appIconUrl}
												fromPicked={(src) => src.replace(/^\/imgs\//, '')}
												hint="Dock·Launchpad·휴대폰 홈에 보이는 아이콘입니다 (이미지 폴더 기준 경로 또는 올린 그림)."
											/>
											<Switch
												label="Dock에 고정"
												checked={app.inDock !== false}
												hint="끄면 Launchpad에 두고, 실행 중에만 Dock에 나타납니다."
												onChange={(on) => setApp({ inDock: on ? undefined : false })}
											/>
											{/* 게임 표시(play, '여기서 플레이')와 뜨기 전 창 바탕(tone)은 폼에 두지 않는다: 쓰는 프로젝트가 SproutFarm뿐이고
										    눈에 띄는 차이가 작다. 필요하면 JSON 탭의 app.play·app.tone에 적는다 */}
											<FormRow label="창 크기" align="end" hint="비워 두면 화면 크기에 맞춘 기본 크기로 엽니다.">
												<div className="projects-size" role="group" aria-label="창 크기">
													<input
														type="number"
														className="projects-input"
														aria-label="창 너비"
														placeholder="1100"
														value={app.windowSize?.width ?? ''}
														onChange={(event) =>
															setApp({
																windowSize: event.target.value
																	? { width: Number(event.target.value), height: app.windowSize?.height ?? 720 }
																	: undefined,
															})
														}
													/>
													<span aria-hidden="true">×</span>
													<input
														type="number"
														className="projects-input"
														aria-label="창 높이"
														placeholder="720"
														value={app.windowSize?.height ?? ''}
														onChange={(event) =>
															setApp({
																windowSize: event.target.value
																	? { width: app.windowSize?.width ?? 1100, height: Number(event.target.value) }
																	: undefined,
															})
														}
													/>
													<span aria-hidden="true">px</span>
												</div>
											</FormRow>
										</Group>
									)}
								</>
							)}
						</div>
					</div>
					{preview && (
						<aside className="projects-preview" aria-label="미리 보기">
							<div className="projects-preview-window">
								<div className="projects-preview-chrome">
									<span /> <span /> <span />
									<em>{draft.demo || `${draft.name} 미리 보기`}</em>
								</div>
								<div className="projects-preview-page">
									<ProjectPage project={{ ...completeProject({ ...draft, id }), id }} />
								</div>
							</div>
						</aside>
					)}
				</div>
			</form>
			{/* 확인 창은 폼 밖에 둔다 (폼 안의 단추 모양을 물려받지 않고, 설정 창 한가운데에 뜨게) */}
			{confirmingSample && (
				<AlertDialog
					title="예시로 채울까요?"
					message="입력한 내용을 예시로 바꿉니다. id·저장소·데모·앱 설정은 그대로 둡니다."
					confirmLabel="채우기"
					onConfirm={fillSample}
					onCancel={() => setConfirmingSample(false)}
				/>
			)}
		</>
	);
};

/**
 * 시스템 설정 › 프로젝트 (관리자만): Safari의 프로젝트 페이지와 프로젝트 앱(데모를 창으로)을 코드를 고치지 않고 관리한다.
 * 순서 바꾸기, 숨기기, 고치기(기본 필드 폼과 고급 JSON), 새 프로젝트. 저장하면 서버에 남고, 새로고침하면 모든 화면에 적용된다
 * (앱 목록·Safari 탭은 시작할 때 한 번 정해진다: shared/site/siteContent.ts)
 */
const ProjectsPane = () => {
	const [saved, setSaved] = useState(getSavedProjects);
	const initial = useMemo(() => rowsFrom(saved), [saved]);
	const [rows, setRows] = useState<Row[]>(initial);
	/** 편집 모드 (GitHub 항목처럼: 편집을 눌러야 순서·숨김·고치기가 나오고, 완료로 저장한다) */
	const [editMode, setEditMode] = useState(false);
	const [editing, setEditing] = useState<Row | null>(null);
	const [errors, setErrors] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	// 저장한 뒤: 'live'는 모든 화면에 바로 적용됨, 'reload'는 앱 목록·사진 앨범까지 바뀌어 새로고침이 필요함
	const [savedNow, setSavedNow] = useState<false | 'live' | 'reload'>(false);
	const [confirmingReset, setConfirmingReset] = useState(false);
	/** 맨 아래 칸에 적는 새 프로젝트 id (GitHub 항목의 owner/이름으로 더하기처럼) */
	const [newId, setNewId] = useState('');
	const dirty = JSON.stringify(contentFrom(rows)) !== JSON.stringify(contentFrom(initial));

	const update = (next: Row[]) => {
		setRows(next);
		setSavedNow(false);
	};
	const finishSend = (result: Awaited<ReturnType<typeof sendProjects>>) => {
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		const fresh = getSavedProjects();
		setSaved(fresh);
		setRows(rowsFrom(fresh));
		setErrors([]);
		setSavedNow(needsReload() ? 'reload' : 'live');
	};
	/** 완료: 바뀐 것이 있으면 저장하고 편집을 마친다. 실패하면 편집 중인 채로 이유를 보여 준다 */
	const finish = async () => {
		if (!dirty) {
			setEditMode(false);
			setErrors([]);
			return;
		}
		const content = contentFrom(rows);
		const parsed = parseProjects(content, PARSE_OPTIONS);
		if ('errors' in parsed) return setErrors(parsed.errors);
		setBusy(true);
		const result = await sendProjects(parsed.value);
		finishSend(result);
		if (result.ok) setEditMode(false);
	};
	/** 취소: 바꾼 것을 버리고 편집을 마친다 */
	const cancel = () => {
		setRows(initial);
		setErrors([]);
		setEditMode(false);
	};
	const reset = async () => {
		setConfirmingReset(false);
		setBusy(true);
		const result = await sendProjects(null);
		finishSend(result);
		if (result.ok) setEditMode(false);
	};

	if (editing)
		return (
			<ProjectEditor
				row={editing}
				takenIds={rows.filter((row) => row !== editing).map((row) => row.id)}
				onCancel={() => setEditing(null)}
				onDone={(done) => {
					update(rows.includes(editing) ? rows.map((row) => (row === editing ? done : row)) : [...rows, done]);
					setEditing(null);
				}}
			/>
		);

	return (
		<div className="projects-pane">
			<div className="showcase-head">
				<h3>
					프로젝트<span className="showcase-count">{rows.filter((row) => !row.hidden).length}개 보임</span>
				</h3>
				<span className="showcase-head-actions">
					{editMode ? (
						<>
							<button type="button" className="showcase-text-button" onClick={cancel} disabled={busy}>
								취소
							</button>
							<button
								type="button"
								className="showcase-text-button strong"
								onClick={() => void finish()}
								disabled={busy}
							>
								완료
							</button>
						</>
					) : (
						<button
							type="button"
							className="showcase-text-button"
							onClick={() => {
								setEditMode(true);
								setSavedNow(false);
							}}
						>
							편집
						</button>
					)}
				</span>
			</div>

			{errors.length > 0 && (
				<ul className="about-pane-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}
			{savedNow && (
				<div className="projects-saved" role="status">
					{savedNow === 'reload' ? (
						<>
							<span>
								저장했습니다. Safari·Finder·터미널에는 바로 적용했습니다. 바뀐 앱 목록과 사진 앨범은 새로고침하면
								Dock·Launchpad·사진에 적용됩니다.
							</span>
							<Button tone="primary" onClick={() => window.location.reload()}>
								지금 새로고침
							</Button>
						</>
					) : (
						<span>저장했습니다. 모든 화면에 바로 적용했습니다.</span>
					)}
				</div>
			)}

			<ol className={`showcase-list ${editMode ? 'editing' : ''}`} aria-label="프로젝트">
				{rows.map((row, index) => {
					const changed = !row.isNew && Object.keys(overrideOf(row.project, DEFAULTS.get(row.id)) ?? {}).length > 0;
					const tags = [
						row.project.app && row.project.demo ? '앱' : null,
						row.isNew ? '새 프로젝트' : changed ? '고침' : null,
						row.hidden ? '숨김' : null,
					].filter(Boolean);
					const name = row.project.name;
					return (
						<li key={row.id} className={`showcase-row projects-row ${row.hidden ? 'hidden' : ''}`}>
							<span className="showcase-text">
								<i className="fa-solid fa-folder-open showcase-icon" aria-hidden="true" />
								<span className="showcase-lines">
									<strong>{name}</strong>
									<span className="showcase-meta">{[row.id, ...tags].join(' · ')}</span>
								</span>
							</span>
							{editMode && (
								<>
									<span className="showcase-actions">
										{/* 코드에 있는 프로젝트는 숨기기만, 새로 더한 프로젝트는 빼기(⊖) */}
										{row.isNew ? (
											<IconButton
												icon="fa-solid fa-circle-minus"
												className="showcase-remove"
												label={`${name} 빼기`}
												disabled={busy}
												onClick={() => update(rows.filter((other) => other !== row))}
											/>
										) : (
											<IconButton
												icon={row.hidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'}
												className="projects-visibility"
												label={row.hidden ? `${name} 보이기` : `${name} 숨기기`}
												disabled={busy}
												onClick={() =>
													update(rows.map((other) => (other === row ? { ...row, hidden: !row.hidden } : other)))
												}
											/>
										)}
										<IconButton
											icon="fa-solid fa-circle-info"
											className="projects-info"
											label={`${name} 편집`}
											disabled={busy}
											onClick={() => setEditing(row)}
										/>
									</span>
									{/* ≡ 손잡이 (GitHub 항목·메모 폴더 편집과 같다): 끌거나 ↑·↓ 키로 순서를 바꾼다 */}
									<button
										type="button"
										className="showcase-handle"
										aria-label={`순서 바꾸기 (${name})`}
										title="끌거나 ↑·↓ 키로 순서를 바꿉니다"
										disabled={busy || rows.length < 2}
										onPointerDown={(event) =>
											startPointerReorder(event, (from, to) => update(moveItem(rows, from, to - from)))
										}
										onKeyDown={(event) => {
											const delta = reorderKeyDelta(event.key);
											if (!delta) return;
											event.preventDefault();
											update(moveItem(rows, index, delta));
										}}
									>
										<i className="fa-solid fa-bars" aria-hidden="true" />
									</button>
								</>
							)}
						</li>
					);
				})}
			</ol>

			{editMode && (
				<form
					className="showcase-lookup"
					onSubmit={(event) => {
						event.preventDefault();
						const id = newId.trim();
						const checked = parseProjects({ items: [{ id }] });
						if ('errors' in checked) return setErrors(checked.errors);
						if (rows.some((row) => row.id === id)) return setErrors([`'${id}'는 이미 있는 id입니다.`]);
						setErrors([]);
						setNewId('');
						setEditing({ id, hidden: false, isNew: true, project: { ...blankProject(id), name: '새 프로젝트' } });
					}}
				>
					<input
						aria-label="새 프로젝트 id"
						placeholder="id로 새 프로젝트 더하기 (예: my-project)"
						value={newId}
						disabled={busy}
						spellCheck={false}
						onChange={(event) => setNewId(event.target.value)}
					/>
					<Button type="submit" disabled={busy || !newId.trim()}>
						더하기
					</Button>
				</form>
			)}

			<p className="about-pane-hint">
				편집을 누르면 ≡로 순서를 바꾸고, 눈 모양으로 숨기고, ⓘ로 고치고, 맨 아래 칸에 id를 적어 새 프로젝트를 더합니다.
				완료를 누르면 저장합니다. 숨긴 프로젝트는 Safari 탭·Finder·터미널·Dock에서 빠집니다. 코드에 있는 프로젝트는 숨길
				수만 있고, 새로 더한 프로젝트는 지울 수 있습니다.
			</p>
			{editMode && saved && (
				<button
					type="button"
					className="showcase-text-button about-pane-reset"
					onClick={() => setConfirmingReset(true)}
					disabled={busy}
				>
					기본값으로 되돌리기
				</button>
			)}

			{confirmingReset && (
				<AlertDialog
					title="프로젝트를 기본값으로 되돌릴까요?"
					message="저장한 순서·숨김·고친 내용과 새로 더한 프로젝트를 지우고, 코드에 적힌 프로젝트를 다시 보여 줍니다."
					confirmLabel="되돌리기"
					onConfirm={() => void reset()}
					onCancel={() => setConfirmingReset(false)}
				/>
			)}
		</div>
	);
};

export default ProjectsPane;
