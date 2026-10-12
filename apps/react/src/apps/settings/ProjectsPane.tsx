import {
	createContext,
	useContext,
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
import { captionOf, completeProject, groupedImageFolders, PUBLIC_IMAGES } from '@/shared/site/publicImages';
import ProjectPage from '@/apps/safari/ProjectPage';
import { hasCustomPage } from '@/apps/safari/project/custom';
import { PROJECT_APPS } from '@/apps/manifest';
import { ALBUMS, albumsOf } from '@/apps/photos/albums';
import { requestWindowSize } from '@/desktop/window/windowSizeRequest';
import { uploadFile } from '@/apps/memo/writer/attachmentsApi';
import { appIconUrl } from '@/shared/config/appIcon';
import { env } from '@/shared/config/env';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
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

/** 그림 고르기 팝업의 폴더 묶음: 프로젝트 폴더(id)별로 묶고, 묶음 이름은 그 프로젝트의 이름 */
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
	product: { name: '제품', note: '큰 화면과 큰 문장' },
	friendly: { name: '카드', note: '밝은 카드와 아이콘' },
	paper: { name: '문서', note: '토글과 알림 상자' },
	bento: { name: '벤토', note: '타일 격자' },
	dialogue: { name: 'RPG 대화창', note: '픽셀 장면' },
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
		// 화면 모음: 그림이 없는 줄은 빼고, 설명을 비우면 파일 이름에서 지은 설명을 쓴다
		gallery: project.gallery
			?.filter((shot) => shot.src.trim())
			.map((shot) => ({ ...shot, caption: shot.caption.trim() || captionOf(shot.src) })),
	};
	for (const key of ['usage', 'chapters', 'timeline', 'controls', 'credits', 'conventions', 'gallery'] as const)
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

/** 그림 올리기 (POST /files): 올리는 중인지와 실패한 까닭을 함께 둔다. 그림 칸과 화면 목록의 줄이 같이 쓴다 */
function useImageUpload(onUploaded: (url: string) => void) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const upload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError(null);
		try {
			const uploaded = await uploadFile(env.apiUrl, file);
			if (!uploaded.image) throw new Error('그림 파일만 올릴 수 있습니다.');
			onUploaded(uploaded.url);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '올리지 못했습니다.');
		} finally {
			setUploading(false);
		}
	};
	return { uploading, error, upload };
}

/** 사이트 안 그림 고르기 팝업: 프로젝트 폴더별로 묶는다. 고른 값이 목록에 있으면 그 이름이 보인다 */
const PicturePopup = ({
	id,
	label,
	value,
	prompt,
	onPick,
	fromPicked = (src) => src,
}: {
	id?: string;
	label: string;
	/** 지금 값 (목록에 없는 값이면 prompt가 보인다) */
	value: string | undefined;
	/** 아무것도 고르지 않았을 때 보이는 글 */
	prompt: string;
	onPick: (value: string | undefined) => void;
	fromPicked?: (src: string) => string;
}) => (
	<Popup
		id={id}
		label={label}
		value={value && ALL_PICTURES.some((src) => fromPicked(src) === value) ? value : ''}
		onChange={(picked) => onPick(picked ? fromPicked(picked) : undefined)}
	>
		<option value="">{prompt}</option>
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
);

/** 올리기 단추: 단추 전체를 덮는 보이지 않는 파일 입력 */
const UploadButton = ({
	name,
	uploading,
	onFile,
}: {
	/** 접근성 이름 ('프로젝트 아이콘 올리기') */
	name: string;
	uploading: boolean;
	onFile: (file: File | undefined) => void;
}) => (
	<label className={`projects-button ${uploading ? 'busy' : ''}`}>
		{uploading ? '올리는 중…' : '올리기…'}
		<input
			type="file"
			accept="image/*"
			aria-label={name}
			disabled={uploading}
			onChange={(event) => {
				onFile(event.target.files?.[0]);
				event.target.value = '';
			}}
		/>
	</label>
);

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
	const { uploading, error, upload } = useImageUpload(onChange);
	const [zoomed, setZoomed] = useState(false);
	const id = useId();
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
						<PicturePopup
							id={id}
							label={`${name} 고르기`}
							value={value}
							prompt={value ? '다른 그림 고르기…' : '그림 고르기…'}
							onPick={onChange}
							fromPicked={fromPicked}
						/>
						<UploadButton name={`${name} 올리기`} uploading={uploading} onFile={(file) => void upload(file)} />
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
	// 제품: 흰 바탕 가운데 큰 제목 두 줄, 단추 하나, 아래의 큰 화면
	product: {
		bg: '#ffffff',
		parts: [
			[22, 10, 56, 7, '#1d1d1f'],
			[30, 20, 40, 7, '#1d1d1f'],
			[38, 31, 24, 3, '#86868b'],
			[43, 38, 14, 5.5, '#0071e3', round],
			[10, 50, 80, 50, '#f5f5f7', { borderRadius: '6% 6% 0 0/10% 10% 0 0' }],
			[18, 58, 64, 42, 'linear-gradient(160deg, #d6e4f5, #eef1f6)', { borderRadius: '4% 4% 0 0/7% 7% 0 0' }],
		],
	},
	// 카드: 왼쪽 글과 단추, 오른쪽 창 틀, 아래 아이콘 카드 셋
	friendly: {
		bg: '#f6f9fc',
		parts: [
			[7, 12, 12, 4, '#635bff', round],
			[7, 21, 38, 6, '#0a2540'],
			[7, 30, 30, 6, '#0a2540'],
			[7, 41, 32, 3, '#6b7c93'],
			[7, 50, 14, 5.5, '#635bff', round],
			[52, 10, 41, 46, '#ffffff', card],
			[52, 10, 41, 7, '#eef2f7', { borderRadius: '8% 8% 0 0/40% 40% 0 0' }],
			[7, 66, 27, 26, '#ffffff', card],
			[37, 66, 27, 26, '#ffffff', card],
			[67, 66, 26, 26, '#ffffff', card],
			[11, 71, 6, 8, '#e8e6ff', { borderRadius: '2px' }],
			[41, 71, 6, 8, '#e8e6ff', { borderRadius: '2px' }],
			[71, 71, 6, 8, '#e8e6ff', { borderRadius: '2px' }],
		],
	},
	// 문서: 표지, 걸친 아이콘, 제목과 속성, 알림 상자
	paper: {
		bg: '#fffefc',
		parts: [
			[0, 0, 100, 26, 'linear-gradient(120deg, #e9dfcf, #d9e3e6)'],
			[16, 19, 11, 14, '#ffffff', { borderRadius: '3px', boxShadow: '0 0 0 1px rgba(55,53,47,0.12)' }],
			[16, 40, 44, 6, '#37352f'],
			[16, 51, 12, 2.5, '#9b9a97'],
			[32, 51, 24, 2.5, '#37352f'],
			[16, 57, 12, 2.5, '#9b9a97'],
			[32, 57, 18, 2.5, '#37352f'],
			[16, 67, 68, 16, '#f7f6f3', { borderRadius: '2px' }],
			[20, 72, 4, 5, '#d9730d'],
			[28, 73, 40, 2.5, '#787774'],
			[16, 88, 3, 3, '#37352f'],
			[22, 88, 40, 2.5, '#9b9a97'],
		],
	},
	// 벤토: 어두운 바탕 위 크기가 다른 타일
	bento: {
		bg: '#09090b',
		parts: [
			[30, 8, 40, 6, '#fafafa'],
			[38, 17, 24, 2.5, '#71717a'],
			[6, 26, 56, 40, '#18181b', { border: '1px solid #27272a', borderRadius: '5%/8%' }],
			[10, 32, 48, 28, 'linear-gradient(140deg, #312e81, #18181b)', { borderRadius: '4%/7%' }],
			[65, 26, 29, 19, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[69, 31, 14, 7, '#fafafa'],
			[65, 47, 29, 19, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[69, 52, 10, 7, '#a78bfa'],
			[6, 70, 27, 22, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[36, 70, 27, 22, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[66, 70, 28, 22, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
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
const LookPicker = ({
	value,
	looks,
	onChange,
}: {
	value: ProjectLook;
	/** 고를 수 있는 모양 (직접 짠 페이지는 등록된 프로젝트만) */
	looks: readonly ProjectLook[];
	onChange: (look: ProjectLook) => void;
}) => {
	const groupRef = useRef<HTMLDivElement>(null);
	const choose = (index: number) => {
		const look = looks[(index + looks.length) % looks.length];
		onChange(look);
		groupRef.current?.querySelector<HTMLElement>(`[data-look="${look}"]`)?.focus();
	};
	return (
		<div className="projects-looks" role="radiogroup" aria-label="페이지 모양" ref={groupRef}>
			{looks.map((look, index) => {
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

/* ─── 항목 시트 (macOS 시스템 설정의 시트): 목록 항목의 칸은 편집 화면 위에 내려오는 둥근 판에서 고친다 ─── */

/** 시트를 그릴 곳: 편집 화면이 깔아 두는 자리(host)와, 시트가 열린 동안 막아 둘 바탕(background) */
const SheetHostContext = createContext<{ host: HTMLElement | null; background: HTMLElement | null }>({
	host: null,
	background: null,
});

/** 시트 안의 한 페이지: 안쪽 목록이 항목을 열면 이 페이지를 가리고 그 자리(slot)에 다음 페이지를 민다 */
interface SheetPageFrame {
	/** 이 페이지의 제목 (다음 페이지의 뒤로 단추에 쓴다) */
	title: string;
	/** 이 페이지 요소 (다음 페이지가 열린 동안 숨긴다) */
	page: HTMLElement | null;
	/** 다음 페이지를 그릴 자리 */
	slot: HTMLElement | null;
}
const SheetPageContext = createContext<SheetPageFrame | null>(null);

/** 시트 안에서 초점이 갈 수 있는 것 (숨은 페이지의 것은 뺀다) */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea, select, [tabindex]:not([tabindex="-1"])';
const focusablesIn = (root: HTMLElement) =>
	[...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length > 0);

/** 페이지가 열리면 첫 입력 칸에 초점을 둔다 (없으면 페이지 안의 첫 컨트롤) */
const focusFirstField = (page: HTMLElement | null) => {
	if (!page) return;
	const field =
		page.querySelector<HTMLElement>('.projects-sheet-body input:not([type="file"]), .projects-sheet-body textarea') ??
		focusablesIn(page)[0];
	field?.focus();
};

/** 뒤로 단추의 왼쪽 갈매기 */
const BackChevron = () => (
	<svg className="projects-sheet-back-glyph" viewBox="0 0 8 14" aria-hidden="true">
		<path d="M6.5 1.5 1.5 7l5 5.5" />
	</svg>
);

/** 시트를 닫는 동작 (완료·Esc): 어느 페이지의 완료든 시트 전체를 닫는다 */
const SheetCloseContext = createContext<() => void>(() => {});

/**
 * 시트의 한 페이지: 머리(뒤로 단추와 제목), 칸, 아래 막대(왼쪽 항목 삭제 · 오른쪽 완료).
 * 다음 페이지가 열리면 이 페이지는 막대째 숨고, 닫히면 왼쪽에서 다시 들어온다. 그래서 항목 삭제는 늘 보이는 페이지의 항목을 지운다.
 * back이 있으면 밀려 들어온 페이지다 (오른쪽에서 들어오고, 연 페이지를 숨긴다)
 */
const SheetPage = ({
	title,
	back,
	onDelete,
	children,
}: {
	title: string;
	back?: { label: string; onBack: () => void };
	/** 이 페이지의 항목을 목록에서 지운다 (지우면 시트나 이 페이지가 닫힌다) */
	onDelete?: () => void;
	children: ReactNode;
}) => {
	const parent = useContext(SheetPageContext);
	const close = useContext(SheetCloseContext);
	const [page, setPage] = useState<HTMLDivElement | null>(null);
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
	const frame = useMemo(() => ({ title, page, slot }), [title, page, slot]);
	// 밀려 들어온 페이지: 연 페이지를 숨기고, 닫히면 다시 보인다 (뒤로 가는 움직임으로).
	// 숨김은 DOM에 바로 건다: 닫히는 그 순간 앞 페이지가 보여야 목록의 줄로 초점을 돌려줄 수 있다
	const opener = back ? (parent?.page ?? null) : null;
	useLayoutEffect(() => {
		if (!opener) return;
		opener.toggleAttribute('hidden', true);
		return () => {
			opener.toggleAttribute('hidden', false);
			opener.setAttribute('data-motion', 'back');
		};
	}, [opener]);
	useEffect(() => focusFirstField(page), [page]);
	return (
		<>
			<div ref={setPage} className={`projects-sheet-page${back ? ' pushed' : ''}`}>
				<header className="projects-sheet-head">
					{back && (
						<button
							type="button"
							className="projects-sheet-back"
							aria-label={`뒤로 (${back.label})`}
							onClick={back.onBack}
						>
							<BackChevron />
							<span>{back.label}</span>
						</button>
					)}
					<h3 className="projects-sheet-title">{title}</h3>
				</header>
				<div className="projects-sheet-body">
					<SheetPageContext.Provider value={frame}>
						<div className="projects-box">{children}</div>
					</SheetPageContext.Provider>
				</div>
				<footer className="projects-sheet-foot">
					{onDelete && (
						<button type="button" className="projects-button destructive" onClick={onDelete}>
							항목 삭제
						</button>
					)}
					<button type="button" className="projects-button primary" onClick={close}>
						완료
					</button>
				</footer>
			</div>
			<div ref={setSlot} className="projects-sheet-slot" />
		</>
	);
};

/**
 * 항목 시트: 편집 화면을 살짝 어둡게 덮고, 위에서 둥근 판이 내려온다. 칸을 고치는 대로 바로 반영되니 오른쪽 단추는 완료 하나,
 * 왼쪽에는 항목 삭제. Esc·완료로 닫고, 열린 동안 초점은 시트 안을 돈다 (바탕은 inert). 시트는 설정 창 안에 그려 창과 함께 움직인다
 */
const ItemSheet = ({
	title,
	onClose,
	onDelete,
	children,
}: {
	title: string;
	onClose: () => void;
	onDelete?: () => void;
	children: ReactNode;
}) => {
	const { host, background } = useContext(SheetHostContext);
	const sheetRef = useRef<HTMLDivElement>(null);
	const layer = useExitMotion<HTMLDivElement>('fade-out');
	// 바탕을 막는다. 닫힐 때(정리) 바로 풀어야 목록의 줄로 초점을 돌려줄 수 있다
	useLayoutEffect(() => {
		if (!background) return;
		background.toggleAttribute('inert', true);
		return () => {
			background.toggleAttribute('inert', false);
		};
	}, [background]);
	if (!host) return null;
	return createPortal(
		<div ref={layer} className="projects-sheet-layer">
			<div
				ref={sheetRef}
				className="projects-sheet"
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onKeyDown={(event) => {
					if (event.key === 'Escape' && !event.defaultPrevented) {
						event.preventDefault();
						event.stopPropagation();
						onClose();
					} else if (event.key === 'Tab' && sheetRef.current?.contains(event.target as Node)) {
						// 초점 가두기: 끝에서 Tab이면 처음으로, 처음에서 ⇧Tab이면 끝으로
						const all = focusablesIn(sheetRef.current);
						const edge = event.shiftKey ? all[0] : all.at(-1);
						if (!edge || document.activeElement !== edge) return;
						event.preventDefault();
						(event.shiftKey ? all.at(-1) : all[0])?.focus();
					}
				}}
			>
				<SheetCloseContext.Provider value={onClose}>
					<SheetPage title={title} onDelete={onDelete}>
						{children}
					</SheetPage>
				</SheetCloseContext.Provider>
			</div>
		</div>,
		host
	);
};

/** 줄 끝의 갈매기 (macOS 설정의 chevron.right): 누르면 다음 화면(시트)이 열린다는 표시 */
const RowChevron = () => (
	<svg className="projects-nav-chevron" viewBox="0 0 8 14" aria-hidden="true">
		<path d="M1.5 1.5 6.5 7l-5 5.5" />
	</svg>
);

/**
 * 목록 편집 (macOS의 표): 둥근 상자 안의 줄 목록과 아래 ＋ 막대.
 * detail이 있으면 macOS 시스템 설정의 이동 목록처럼 줄 전체가 단추다: 누르거나 Enter·Space로 그 항목의 칸을 시트로 연다
 * (＋로 더한 항목도 바로 연다). 순서는 왼쪽 ≡ 손잡이를 끌거나 ↑·↓(⌥↑·⌥↓) 키로 바꾸고, 항목은 시트 아래의 항목 삭제로 지운다.
 * 시트 안의 목록이면 시트를 겹치지 않고 같은 시트 안에 다음 페이지로 민다.
 * detail이 없으면 줄의 칸을 바로 고치는 표다: 줄을 눌러 고르고, 끌거나 ⌥↑·⌥↓로 순서를 바꾸고, −나 Delete로 고른 줄을 뺀다
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
	/** 목록의 접근성 이름. 항목 칸의 이름 앞부분('주요 기능 1 제목')과 시트 제목('주요 기능 1')에도 쓴다 */
	label: string;
	/** 목록 위에 보이는 제목 (없으면 label) */
	title?: string;
	/** 다른 항목의 칸 안에 든 목록: 영역(region)이 아니라 묶음(group)으로 둔다 (바깥 목록의 영역 이름과 겹치지 않게) */
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
	/** 항목의 칸 (시트에 그린다) */
	detail?: (item: T, index: number, update: (next: T) => void) => ReactNode;
}) {
	const [picked, setPicked] = useState<number | null>(null);
	const selected = picked !== null && picked < items.length ? picked : null;
	const [opened, setOpened] = useState<number | null>(null);
	const open = detail && opened !== null && opened < items.length ? opened : null;
	/** 이 목록이 시트 안에 있으면 그 페이지 (항목을 다음 페이지로 민다) */
	const frame = useContext(SheetPageContext);
	const rowId = useId();
	const listRef = useRef<HTMLOListElement>(null);
	const addRef = useRef<HTMLButtonElement>(null);
	/** 그린 뒤 초점을 줄 곳: 줄(이동 목록이면 줄 단추), 줄의 ≡ 손잡이, (새로 더한 줄이면) 줄의 첫 입력 칸, 또는 ＋ 단추 */
	const pendingFocus = useRef<{ index: number; target: 'row' | 'handle' | 'input' } | 'add' | null>(null);
	useLayoutEffect(() => {
		const pending = pendingFocus.current;
		if (!pending) return;
		pendingFocus.current = null;
		if (pending === 'add') return addRef.current?.focus();
		const row = listRef.current?.children[pending.index] as HTMLElement | undefined;
		if (pending.target === 'input') row?.querySelector<HTMLElement>('input:not([type="file"])')?.focus();
		else if (pending.target === 'handle') row?.querySelector<HTMLElement>('.projects-row-handle')?.focus();
		else (detail ? row?.querySelector<HTMLElement>('.projects-nav-row') : row)?.focus();
	});
	const update = (index: number) => (next: T) => onChange(items.map((item, i) => (i === index ? next : item)));
	const select = (index: number, focus = true) => {
		setPicked(index);
		if (focus) pendingFocus.current = { index, target: 'row' };
	};
	/** 시트(또는 밀린 페이지)를 닫고 그 줄로 초점을 돌려준다 */
	const closeItem = () => {
		if (open !== null) pendingFocus.current = { index: open, target: 'row' };
		setOpened(null);
	};
	const add = () => {
		onChange([...items, blank()]);
		setPicked(items.length);
		if (detail) setOpened(items.length);
		else pendingFocus.current = { index: items.length, target: 'input' };
	};
	const remove = (index: number) => {
		onChange(items.filter((_, i) => i !== index));
		const next = Math.min(index, items.length - 2);
		setPicked(next >= 0 ? next : null);
		if (next >= 0) pendingFocus.current = { index: next, target: 'row' };
	};
	/** 시트의 항목 삭제: 열린 항목을 지우고 시트를 닫는다. 초점은 다음 줄(마지막이었으면 앞 줄, 남은 줄이 없으면 ＋)로 */
	const removeOpen = () => {
		if (open === null) return;
		remove(open);
		if (items.length < 2) pendingFocus.current = 'add';
		setOpened(null);
	};
	const move = (index: number, delta: number, target: 'row' | 'handle' = 'row') => {
		const to = index + delta;
		if (to < 0 || to >= items.length) return;
		onChange(moveItem(items, index, delta));
		setPicked(to);
		pendingFocus.current = { index: to, target };
	};
	const sheetTitle = open !== null ? `${label} ${open + 1}` : '';
	const sheetContent = open !== null && detail ? <div key={open}>{detail(items[open], open, update(open))}</div> : null;
	const addButton = (
		<button ref={addRef} type="button" aria-label="더하기" title="항목 더하기" onClick={add}>
			<svg viewBox="0 0 10 10" aria-hidden="true">
				<path d="M5 1v8M1 5h8" />
			</svg>
		</button>
	);
	return (
		<section
			className={`projects-group${nested ? ' nested' : ''}`}
			role={nested ? 'group' : undefined}
			aria-label={label}
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
				{items.length === 0 ? (
					<p className="projects-table-empty">항목이 없습니다. ＋를 눌러 더합니다.</p>
				) : detail ? (
					// 이동 목록 (macOS 설정의 › 줄): 왼쪽 ≡ 손잡이, 가운데 줄 단추(제목·설명·그림·›)
					<ol className="projects-table-rows nav" aria-label={label} ref={listRef}>
						{items.map((item, index) => {
							const name = `${label} ${index + 1}`;
							return (
								<li key={index} className="projects-table-row nav">
									{/* ≡ 손잡이 (프로젝트 목록의 ≡ 손잡이와 같다): 끌거나 ↑·↓ 키로 순서를 바꾼다 */}
									<button
										type="button"
										className="projects-row-handle"
										aria-label={`${name} 순서 바꾸기`}
										title="끌거나 ↑·↓ 키로 순서를 바꿉니다."
										disabled={items.length < 2}
										onPointerDown={(event) => {
											if (event.button !== 0) return;
											startPointerReorder(event, (from, to) => move(from, to - from, 'handle'));
										}}
										onKeyDown={(event) => {
											const delta = reorderKeyDelta(event.key);
											if (!delta) return;
											event.preventDefault();
											move(index, delta, 'handle');
										}}
									>
										<i className="fa-solid fa-bars" aria-hidden="true" />
									</button>
									<button
										type="button"
										className="projects-nav-row"
										aria-label={`${name} 편집`}
										aria-describedby={`${rowId}-${index}`}
										onClick={() => setOpened(index)}
										onKeyDown={(event) => {
											if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
											event.preventDefault();
											const delta = event.key === 'ArrowUp' ? -1 : 1;
											// ⌥↑·⌥↓는 순서를 바꾸고, ↑·↓는 이웃한 줄로 초점을 옮긴다
											if (event.altKey) move(index, delta);
											else if (index + delta >= 0 && index + delta < items.length)
												pendingFocus.current = { index: index + delta, target: 'row' };
										}}
									>
										<span id={`${rowId}-${index}`} className="projects-nav-cells">
											{cells(item, index, update(index))}
										</span>
										<RowChevron />
									</button>
								</li>
							);
						})}
					</ol>
				) : (
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
				)}
				<div className="projects-table-bar">
					<span className="projects-segmented">
						{addButton}
						{!detail && (
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
						)}
					</span>
					{hint && <span className="projects-table-note">{hint}</span>}
				</div>
			</div>
			{sheetContent &&
				(frame ? (
					frame.slot &&
					createPortal(
						<SheetPage title={sheetTitle} back={{ label: frame.title, onBack: closeItem }} onDelete={removeOpen}>
							{sheetContent}
						</SheetPage>,
						frame.slot
					)
				) : (
					<ItemSheet title={sheetTitle} onClose={closeItem} onDelete={removeOpen}>
						{sheetContent}
					</ItemSheet>
				))}
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

/** 화면 목록의 한 줄: 썸네일(누르면 크게 보기), 설명 칸, 그 아래 주소 칸과 고르기·올리기 */
const ShotRow = ({
	name,
	shot,
	update,
	onZoom,
}: {
	/** 줄 이름 ('화면 모음 1'): 칸마다 접근성 이름 앞에 붙인다 */
	name: string;
	shot: Shot;
	update: (next: Shot) => void;
	onZoom: () => void;
}) => {
	const { uploading, error, upload } = useImageUpload((src) => update({ ...shot, src }));
	const video = shot.src.endsWith('.mp4');
	return (
		<div className="projects-shot">
			{shot.src ? (
				<button type="button" className="projects-shot-thumb" aria-label={`${name} 그림 크게 보기`} onClick={onZoom}>
					{video ? <video src={shot.src} muted /> : <img src={shot.src} alt="" loading="lazy" />}
				</button>
			) : (
				<span className="projects-shot-thumb empty" aria-hidden="true">
					<i className="fa-regular fa-image" />
				</span>
			)}
			<div className="projects-shot-fields">
				<input
					className="projects-input"
					aria-label={`${name} 설명`}
					value={shot.alt}
					placeholder="설명을 적습니다."
					onChange={(event) => update({ ...shot, alt: event.target.value })}
				/>
				<div className="projects-shot-source">
					<input
						className="projects-input mono"
						aria-label={`${name} 주소`}
						value={shot.src}
						placeholder="/imgs/… 또는 https://"
						spellCheck={false}
						onChange={(event) => update({ ...shot, src: event.target.value.trim() })}
					/>
					<PicturePopup
						label={`${name} 그림 고르기`}
						value={undefined}
						prompt="고르기…"
						onPick={(src) => src && update({ ...shot, src })}
					/>
					<UploadButton name={`${name} 그림 올리기`} uploading={uploading} onFile={(file) => void upload(file)} />
				</div>
				{error && <p className="projects-error">{error}</p>}
			</div>
		</div>
	);
};

/**
 * 화면 여러 장 (항목 안)과 화면 모음 (그림 탭): 줄마다 그림과 설명을 바로 고친다 (시트를 열지 않는다).
 * 줄을 끌거나 ⌥↑·⌥↓로 순서를 바꾸고, 썸네일을 누르면 목록의 그림을 차례로 크게 본다
 */
const ShotsEditor = ({
	label,
	title = '화면 여러 장',
	nested = true,
	hint = '글 옆이나 아래에 차례로 보입니다. .mp4 주소는 화면에 보일 때만 도는 영상이 됩니다.',
	shots,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	shots: Shot[];
	onChange: (shots: Shot[]) => void;
}) => {
	const [zoomed, setZoomed] = useState<string | null>(null);
	const sources = shots.map((shot) => shot.src).filter(Boolean);
	return (
		<>
			<ListTable<Shot>
				label={label}
				title={title}
				nested={nested}
				hint={hint}
				items={shots}
				onChange={onChange}
				blank={() => ({ src: '', alt: '' })}
				cells={(shot, index, update) => [
					<ShotRow
						key="shot"
						name={`${label} ${index + 1}`}
						shot={shot}
						update={update}
						onZoom={() => setZoomed(shot.src)}
					/>,
				]}
			/>
			{zoomed !== null && sources.includes(zoomed) && (
				<Lightbox items={sources} start={sources.indexOf(zoomed)} onClose={() => setZoomed(null)} />
			)}
		</>
	);
};

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
 * 장: 주요 기능과 만든 방식 말고 더 들려줄 이야기 (모든 모양이 '더 들려줄 이야기' 구역이나 대화로 그린다).
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

/** 조작법 (게임의 키나 앱의 단축키): 키 여러 개(쉼표로)와 설명. 표의 칸을 바로 고친다 */
const ControlsEditor = ({ controls, onChange }: { controls: Control[]; onChange: (controls: Control[]) => void }) => (
	<ListTable<Control>
		label="조작법"
		hint="게임의 키나 앱의 단축키를 적습니다. 키는 쉼표로 나눠 적습니다 (예: ←, →)."
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
		hint="빌려 쓴 그림·글꼴·소리를 적습니다. 페이지 끝의 출처 구역에 보입니다."
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
	/** 목록 항목의 시트를 그릴 자리와, 시트가 열린 동안 막아 둘 편집 화면 */
	const [sheetHost, setSheetHost] = useState<HTMLDivElement | null>(null);
	const [editorElement, setEditorElement] = useState<HTMLFormElement | null>(null);
	const sheetContext = useMemo(() => ({ host: sheetHost, background: editorElement }), [sheetHost, editorElement]);
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
		<SheetHostContext.Provider value={sheetContext}>
			<form
				ref={setEditorElement}
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
													: `코드에 ${draft.id} 전용 페이지가 없어 기본 모양인 카드로 그립니다. 저장소의 safari/project/custom/에 등록하세요.`
												: '제품·카드·문서·벤토는 같은 내용을 서로 다른 디자인으로 그립니다. 고르면 미리 보기가 바로 바뀝니다.'
										}
									>
										<LookPicker
											value={draft.look}
											looks={PROJECT_LOOKS.filter(
												(look) => look !== 'custom' || draft.look === 'custom' || hasCustomPage(draft.id)
											)}
											onChange={(look) => set({ look })}
										/>
									</Group>
									{/* 모양 설정: 어떤 모양에서만 쓰는 칸은 그 모양을 골랐을 때만 여기에 보인다 (값은 모양을 바꿔도 남는다) */}
									{lookUses('art') && (
										<Group title="장면 그림" label="장면">
											<ImageField
												label="장면 그림"
												shape="wide"
												value={draft.art}
												onChange={(art) => set({ art })}
												hint="RPG 대화창 모양의 표지에 대표 화면 대신 크게 보입니다. 없으면 대표 화면을 씁니다."
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
									{/* 대표 화면(image)은 한 장만 고르고, 비우면 화면 더 보기의 첫 그림을 쓴다 (completeProject).
								    화면 더 보기(gallery)는 그림마다 고르거나 올린다. 폴더(galleryFolder)는 저장소에 넣고 배포한 그림만 되어 JSON에서만 고친다.
								    글자 로고(logo)도 폼에는 두지 않는다: 쓰는 프로젝트가 드물고 아이콘과 헷갈린다 (필요하면 JSON의 logo) */}
									<Group title="아이콘" label="그림">
										<ImageField
											label="프로젝트 아이콘"
											value={draft.icon}
											onChange={(icon) => set({ icon })}
											hint="네모난 앱 아이콘입니다. Safari 탭·Finder·페이지 맨 위에 작게 보이고, 없으면 기본 모양을 씁니다."
										/>
									</Group>
									<Group title="대표 화면">
										<ImageField
											label="대표 화면"
											shape="wide"
											value={draft.image || undefined}
											onChange={(image) => set({ image: image ?? '' })}
											hint="페이지 첫 화면과 Finder 미리 보기에 보이는 그림입니다. 비워 두면 아래 화면 더 보기의 첫 그림을 씁니다."
										/>
									</Group>
									{draft.galleryFolder && !draft.gallery?.length && (
										<p className="projects-tab-hint">
											{`화면 더 보기는 JSON에 적은 폴더 ${draft.galleryFolder}의 그림을 씁니다. 아래 목록에 그림을 더하면 폴더 대신 목록을 씁니다.`}
										</p>
									)}
									<ShotsEditor
										label="화면 더 보기"
										title="화면 더 보기"
										nested={false}
										hint="대표 화면 말고 더 보여 줄 화면입니다. 화면 모음을 그리는 모양에서 갤러리로 보입니다. 줄을 끌어 순서를 바꿉니다."
										shots={(draft.gallery ?? []).map(({ src, caption }) => ({ src, alt: caption }))}
										onChange={(shots) =>
											set({
												gallery: shots.length ? shots.map(({ src, alt }) => ({ src, caption: alt })) : undefined,
												// 목록에 그림을 두면 폴더 대신 목록을 쓴다 (폴더가 있으면 화면이 폴더의 그림으로 바뀌므로)
												galleryFolder: shots.length ? undefined : draft.galleryFolder,
											})
										}
									/>
								</>
							)}
							{tab === 'content' && (
								<>
									<p className="projects-tab-hint">
										줄을 누르면 항목을 고치는 창이 열립니다. 왼쪽 손잡이를 끌거나 ⌥↑·⌥↓ 키로 순서를 바꿉니다. ＋를
										누르면 새 항목을 더하고, 항목을 지우려면 창 아래의 항목 삭제를 누릅니다. 칸으로 된 표는 줄에서 바로
										고치고, −를 눌러 고른 줄을 뺍니다.
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
										hint="그림이 있으면 항목과 함께 크게 보이고, 없으면 아이콘으로 그립니다."
										points={draft.highlights}
										onChange={(highlights) => set({ highlights })}
									/>
									<PointsEditor
										label="만든 방식"
										hint="구현에서 신경 쓴 점입니다. 그림이 있으면 함께 보입니다."
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
									<ControlsEditor
										controls={draft.controls ?? []}
										onChange={(controls) => set({ controls: controls.length ? controls : undefined })}
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
										hint="저장소의 폴더 트리를 그대로 붙여 넣습니다. 기술 사양 구역에 고정폭 글꼴로 보입니다."
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
			{/* 항목 시트는 폼 밖, 편집 화면 위에 그린다 (폼의 Enter 제출을 물려받지 않고, 설정 창과 함께 움직이게) */}
			<div ref={setSheetHost} className="projects-sheet-host" />
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
		</SheetHostContext.Provider>
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
