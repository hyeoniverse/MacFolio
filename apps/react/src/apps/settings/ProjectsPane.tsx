import { useEffect, useId, useMemo, useState } from 'react';
import {
	blankProject,
	mergeProjects,
	overrideOf,
	parseProjects,
	PROJECT_LOOKS,
	type Project,
	type ProjectAppInfo,
	type ProjectFact,
	type ProjectPoint,
	type ProjectLook,
	type SiteProjects,
} from '@macfolio/desktop-core/site';
import { DEFAULT_PROJECTS, PROJECTS } from '@/shared/profile';
import { DEFAULT_PROFILE } from '@/shared/site/profileStore';
import { formatPeriod, languageOptions, parsePeriod, stackOptions, suggest, type Period } from './projectInputs';
import { getSavedProjects, PARSE_OPTIONS, sendProjects } from '@/shared/site/siteContent';
import { completeProject, groupedImageFolders, PUBLIC_IMAGES } from '@/shared/site/publicImages';
import ProjectPage from '@/apps/safari/ProjectPage';
import { hasCustomPage } from '@/apps/safari/project/custom';
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
const STACKS = stackOptions(
	[...PROJECTS, ...DEFAULT_PROJECTS.filter((project) => !PROJECTS.some((shown) => shown.id === project.id))],
	[...Object.values(DEFAULT_PROFILE.skills).flat(), ...DEFAULT_PROFILE.siteStack]
);

const LOOK_LABEL: Record<ProjectLook, string> = {
	showcase: '기본 (카드)',
	cinema: '시네마 (한 화면씩 장면)',
	phone: '폰 (틀 안의 화면)',
	horizontal: '가로 (옆으로 가는 패널)',
	brutal: '브루탈 (굵은 선·큰 글자)',
	arcade: '아케이드 (네온·CRT)',
	atelier: '아틀리에 (여백·세리프)',
	inbox: '메일함 (3단)',
	checklist: '할 일 앱',
	repo: '저장소 (파일 트리·커밋)',
	dialogue: 'RPG 대화창',
	deck: '발표 슬라이드',
	assistant: '설정 도우미 (단계)',
	custom: '직접 짠 페이지 (코드)',
};

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
	const points = (list?: ProjectPoint[]) => list?.filter((point) => point.title.trim() || point.body.trim());
	const pairs = <T extends object>(list?: T[]) =>
		list?.filter((row) => Object.values(row as Record<string, unknown>).some((value) => String(value ?? '').trim()));
	const next: Project = {
		...project,
		facts: pairs(project.facts) ?? [],
		highlights: points(project.highlights) ?? [],
		build: points(project.build) ?? [],
		usage: points(project.usage),
		timeline: pairs(project.timeline),
		specs: pairs(project.specs) ?? [],
		contributions: project.contributions.map((line) => line.trim()).filter(Boolean),
	};
	if (!next.usage?.length) delete next.usage;
	if (!next.timeline?.length) delete next.timeline;
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

/** 한 줄 입력칸 */
const TextField = ({
	label,
	value,
	onChange,
	hint,
	type = 'text',
	placeholder,
	required = false,
	options,
}: {
	label: string;
	value: string | number | undefined;
	onChange: (value: string) => void;
	hint?: string;
	type?: string;
	placeholder?: string;
	/** 꼭 적어야 하는 칸: 이름 옆에 '필수' */
	required?: boolean;
	/** 고를 수 있는 값 (치면 걸러지는 목록, 다른 값도 쓸 수 있다) */
	options?: readonly string[];
}) => {
	const listId = useId();
	return (
		<div className="projects-field">
			<label>
				<FieldLabel label={label} required={required} />
				<input
					type={type}
					value={value ?? ''}
					placeholder={placeholder}
					spellCheck={false}
					required={required}
					aria-required={required || undefined}
					list={options ? listId : undefined}
					onChange={(event) => onChange(event.target.value)}
				/>
			</label>
			{options && (
				<datalist id={listId}>
					{options.map((option) => (
						<option key={option} value={option} />
					))}
				</datalist>
			)}
			{hint && <p className="about-pane-hint">{hint}</p>}
		</div>
	);
};

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
				hint="날짜 모양이 아니라 글로 고칩니다."
			/>
		);
	return (
		<div className="projects-field">
			<div className="projects-period" role="group" aria-label="기간">
				<FieldLabel label="기간" />
				<DatePicker
					label="시작일"
					placeholder="시작일"
					className="projects-date"
					value={period.start}
					max={period.end && period.end < today ? period.end : today}
					onChange={(start) => update({ start })}
				/>
				<span aria-hidden="true">–</span>
				{period.ongoing ? (
					<input
						type="text"
						aria-label="끝 대신 쓸 글"
						value={period.ongoing}
						onChange={(event) => update({ ongoing: event.target.value || '진행 중' })}
					/>
				) : (
					<DatePicker
						label="끝날"
						placeholder="끝날"
						className="projects-date"
						value={period.end}
						min={period.start || undefined}
						max={today}
						onChange={(end) => update({ end })}
					/>
				)}
				<label className="projects-period-ongoing">
					<input
						type="checkbox"
						checked={Boolean(period.ongoing)}
						onChange={(event) => update({ ongoing: event.target.checked ? '진행 중' : '', end: '' })}
					/>
					진행 중
				</label>
			</div>
			{!period.start && (period.end || period.ongoing) && (
				<p className="about-pane-hint">시작일을 고르면 기간이 저장됩니다.</p>
			)}
		</div>
	);
};

/**
 * 기술: 고른 것은 칩으로, 치면 후보가 걸러져 아래에 나온다. Enter·쉼표로 더하고(목록에 없는 것도), ↑·↓로 후보를 고르고,
 * 빈 칸에서 Backspace는 마지막 칩을 뺀다
 */
const TagInput = ({
	label,
	items,
	options,
	onChange,
}: {
	label: string;
	items: string[];
	options: readonly string[];
	onChange: (items: string[]) => void;
}) => {
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const listId = useId();
	const shown = open ? suggest(options, query, items) : [];
	const add = (raw: string) => {
		const value = raw.trim();
		setQuery('');
		setActive(0);
		if (!value || items.some((item) => item.toLowerCase() === value.toLowerCase())) return;
		onChange([...items, value]);
	};
	return (
		<div className="projects-field">
			<div className="projects-tags">
				<FieldLabel label={label} />
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
				<input
					role="combobox"
					aria-label={label}
					aria-expanded={shown.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
					value={query}
					placeholder={items.length ? '' : '찾거나 적어서 더하기'}
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
			{shown.length > 0 && (
				<ul className="projects-suggestions" role="listbox" id={listId} aria-label={`${label} 후보`}>
					{shown.map((option, index) => (
						<li
							key={option}
							id={`${listId}-${index}`}
							role="option"
							aria-selected={index === active}
							// 누르는 동안 입력칸의 초점이 빠져 목록이 닫히지 않게
							onPointerDown={(event) => event.preventDefault()}
							onClick={() => add(option)}
						>
							{option}
						</li>
					))}
				</ul>
			)}
			<p className="about-pane-hint">찾아서 고르거나 적고 Enter·쉼표로 더합니다.</p>
		</div>
	);
};

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
}) => (
	<label className="settings-toggle projects-switch">
		<span>
			<strong>{label}</strong>
			{hint && <span className="settings-hint">{hint}</span>}
		</span>
		<input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
	</label>
);

/** 사이트 안 그림 전부 (폴더별) → 고르기 목록에 쓴다 */
const ALL_PICTURES = Object.entries(PUBLIC_IMAGES)
	.filter(([folder]) => folder.startsWith('/imgs/projects/'))
	.flatMap(([, files]) => files.filter((src) => !src.endsWith('.mp4')));

/**
 * 그림 한 장 고르기: 미리 보기, 사이트 안 그림에서 고르거나(폴더별 목록), 파일을 올리거나(POST /files), 주소를 적는다.
 * 앱 아이콘은 이미지 폴더 기준 경로(projects/…)라 값을 그대로 두고, 보여 줄 때만 주소로 바꾼다
 */
const ImageField = ({
	label,
	value,
	onChange,
	required = false,
	hint,
	toUrl = (v) => v,
	fromPicked = (src) => src,
}: {
	label: string;
	value: string | undefined;
	onChange: (value: string | undefined) => void;
	required?: boolean;
	hint?: string;
	/** 저장된 값 → 보여 줄 주소 */
	toUrl?: (value: string) => string;
	/** 고른 그림 주소(/imgs/…) → 저장할 값 */
	fromPicked?: (src: string) => string;
}) => {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileId = useId();
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
		<div className="projects-field projects-image">
			<div className="projects-image-row">
				<FieldLabel label={label} required={required} />
				<span className="projects-image-preview" aria-hidden="true">
					{value ? <img src={toUrl(value)} alt="" /> : <i className="fa-regular fa-image" />}
				</span>
				<select
					aria-label={`${label} 고르기`}
					value={value && ALL_PICTURES.some((src) => fromPicked(src) === value) ? value : ''}
					onChange={(event) => onChange(event.target.value ? fromPicked(event.target.value) : undefined)}
				>
					<option value="">{value ? '다른 그림 고르기…' : '사이트 안 그림에서 고르기…'}</option>
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
				</select>
				<label className="showcase-text-button projects-upload">
					{uploading ? '올리는 중…' : '올리기'}
					<input
						id={fileId}
						type="file"
						accept="image/*"
						aria-label={`${label} 올리기`}
						disabled={uploading}
						onChange={(event) => {
							void upload(event.target.files?.[0]);
							event.target.value = '';
						}}
					/>
				</label>
				{value && (
					<button type="button" className="showcase-text-button projects-clear" onClick={() => onChange(undefined)}>
						지우기
					</button>
				)}
			</div>
			<input
				type="text"
				aria-label={`${label} 주소`}
				value={value ?? ''}
				placeholder="직접 적기: /imgs/… 또는 https://…"
				spellCheck={false}
				onChange={(event) => onChange(optional(event.target.value))}
			/>
			{error && <p className="about-pane-hint projects-error">{error}</p>}
			{hint && <p className="about-pane-hint">{hint}</p>}
		</div>
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

/** 목록 편집의 줄 틀: 위·아래·빼기 */
const RowTools = ({
	index,
	count,
	onMove,
	onRemove,
}: {
	index: number;
	count: number;
	onMove: (delta: number) => void;
	onRemove: () => void;
}) => (
	<span className="projects-row-tools">
		<IconButton icon="fa-solid fa-chevron-up" label="위로" disabled={index === 0} onClick={() => onMove(-1)} />
		<IconButton
			icon="fa-solid fa-chevron-down"
			label="아래로"
			disabled={index === count - 1}
			onClick={() => onMove(1)}
		/>
		<IconButton icon="fa-solid fa-xmark" label="빼기" onClick={onRemove} />
	</span>
);

/** 제목·설명(·그림) 묶음 목록: 주요 기능, 만든 방식, 쓰는 법 */
const PointsEditor = ({
	label,
	hint,
	points,
	onChange,
}: {
	label: string;
	hint?: string;
	points: ProjectPoint[];
	onChange: (points: ProjectPoint[]) => void;
}) => {
	const update = (index: number, patch: Partial<ProjectPoint>) =>
		onChange(
			points.map((point, i) => {
				if (i !== index) return point;
				const next = { ...point, ...patch };
				for (const key of Object.keys(patch) as (keyof ProjectPoint)[]) if (next[key] === undefined) delete next[key];
				return next;
			})
		);
	return (
		<section className="about-pane-group projects-list" aria-label={label}>
			<h3>
				{label}
				<span className="showcase-count">{points.length}</span>
			</h3>
			{hint && <p className="about-pane-hint">{hint}</p>}
			<ol>
				{points.map((point, index) => (
					<li key={index}>
						<div className="projects-list-fields">
							<input
								aria-label={`${label} ${index + 1} 제목`}
								placeholder="제목"
								value={point.title}
								onChange={(event) => update(index, { title: event.target.value })}
							/>
							<textarea
								aria-label={`${label} ${index + 1} 설명`}
								placeholder="설명"
								rows={2}
								value={point.body}
								onChange={(event) => update(index, { body: event.target.value })}
							/>
							<ImageField label="그림" value={point.image} onChange={(image) => update(index, { image })} />
						</div>
						<RowTools
							index={index}
							count={points.length}
							onMove={(delta) => onChange(moveItem(points, index, delta))}
							onRemove={() => onChange(points.filter((_, i) => i !== index))}
						/>
					</li>
				))}
			</ol>
			<button
				type="button"
				className="showcase-text-button projects-list-add"
				onClick={() => onChange([...points, { title: '', body: '' }])}
			>
				<i className="fa-solid fa-plus" aria-hidden="true" /> 더하기
			</button>
		</section>
	);
};

/** 두 칸짜리 줄 목록: 진행 과정(때·한 일), 기술 사양(분류·기술) */
const PairsEditor = <K extends string>({
	label,
	keys,
	names,
	rows,
	onChange,
}: {
	label: string;
	keys: [K, K];
	names: [string, string];
	rows: Record<K, string>[];
	onChange: (rows: Record<K, string>[]) => void;
}) => (
	<section className="about-pane-group projects-list" aria-label={label}>
		<h3>
			{label}
			<span className="showcase-count">{rows.length}</span>
		</h3>
		<ol>
			{rows.map((row, index) => (
				<li key={index}>
					<div className="projects-list-fields projects-pair">
						{keys.map((key, k) => (
							<input
								key={key}
								aria-label={`${label} ${index + 1} ${names[k]}`}
								placeholder={names[k]}
								value={row[key]}
								onChange={(event) =>
									onChange(rows.map((other, i) => (i === index ? { ...other, [key]: event.target.value } : other)))
								}
							/>
						))}
					</div>
					<RowTools
						index={index}
						count={rows.length}
						onMove={(delta) => onChange(moveItem(rows, index, delta))}
						onRemove={() => onChange(rows.filter((_, i) => i !== index))}
					/>
				</li>
			))}
		</ol>
		<button
			type="button"
			className="showcase-text-button projects-list-add"
			onClick={() => onChange([...rows, { [keys[0]]: '', [keys[1]]: '' } as Record<K, string>])}
		>
			<i className="fa-solid fa-plus" aria-hidden="true" /> 더하기
		</button>
	</section>
);

/** 한눈에 보는 숫자: 값·이름표 */
const FactsEditor = ({ facts, onChange }: { facts: ProjectFact[]; onChange: (facts: ProjectFact[]) => void }) => (
	<PairsEditor
		label="한눈에 보는 숫자"
		keys={['value', 'label']}
		names={['값 (예: 6주)', '이름표 (예: 개발 기간)']}
		rows={facts}
		onChange={onChange}
	/>
);

/** 한 줄씩: 맡은 일 */
const LinesEditor = ({
	label,
	lines,
	onChange,
}: {
	label: string;
	lines: string[];
	onChange: (lines: string[]) => void;
}) => (
	<section className="about-pane-group projects-list" aria-label={label}>
		<h3>
			{label}
			<span className="showcase-count">{lines.length}</span>
		</h3>
		<ol>
			{lines.map((line, index) => (
				<li key={index}>
					<div className="projects-list-fields">
						<input
							aria-label={`${label} ${index + 1}`}
							value={line}
							onChange={(event) => onChange(lines.map((other, i) => (i === index ? event.target.value : other)))}
						/>
					</div>
					<RowTools
						index={index}
						count={lines.length}
						onMove={(delta) => onChange(moveItem(lines, index, delta))}
						onRemove={() => onChange(lines.filter((_, i) => i !== index))}
					/>
				</li>
			))}
		</ol>
		<button type="button" className="showcase-text-button projects-list-add" onClick={() => onChange([...lines, ''])}>
			<i className="fa-solid fa-plus" aria-hidden="true" /> 더하기
		</button>
	</section>
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
	/** 오른쪽에 Safari 페이지를 그대로 그려 둔다 (고치는 대로 바뀐다) */
	const [preview, setPreview] = useState(true);
	// 폼과 미리 보기가 나란히 들어가게 창을 키운다 (이미 크면 그대로)
	useEffect(() => requestWindowSize('settings', 1120, 720), []);
	const [json, setJson] = useState('');
	const [errors, setErrors] = useState<string[]>([]);
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
		<form
			className="projects-editor"
			aria-label={`${row.project.name} 편집`}
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				finish();
			}}
		>
			<div className="projects-editor-head">
				<button type="button" className="showcase-text-button" onClick={onCancel}>
					<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 프로젝트
				</button>
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
							}}
						>
							{label}
						</button>
					))}
				</div>
				<span className="showcase-head-actions">
					<button
						type="button"
						className={`showcase-text-button ${preview ? 'strong' : ''}`}
						aria-pressed={preview}
						onClick={() => setPreview((value) => !value)}
					>
						<i className="fa-regular fa-eye" aria-hidden="true" /> 미리 보기
					</button>
					<button type="submit" className="showcase-text-button strong">
						완료
					</button>
				</span>
			</div>

			{errors.length > 0 && (
				<ul className="about-pane-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}

			<div className="projects-editor-body">
				<div className="projects-editor-form">
					{tab === 'json' && (
						<div className="projects-json">
							<textarea
								aria-label="프로젝트 JSON"
								value={json}
								spellCheck={false}
								onChange={(event) => setJson(event.target.value)}
							/>
							<p className="about-pane-hint">
								모든 필드를 고칠 수 있습니다 (장, 출처, 조작법 등). 링크·데모는 https:// 주소, 그림은 사이트 안
								경로(/imgs/…)나 https:// 주소만 받습니다.
							</p>
						</div>
					)}
					{tab === 'intro' && (
						<>
							<section className="about-pane-group" aria-label="소개">
								<h3>소개</h3>
								{row.isNew && (
									<TextField
										label="id"
										value={id}
										onChange={setId}
										required
										hint="주소와 앱 이름에 쓰입니다. 영어 소문자·숫자·-로 (예: my-project)"
									/>
								)}
								<TextField label="이름" value={draft.name} onChange={(name) => set({ name })} required />
								<TextField
									label="한 줄 소개"
									value={draft.description}
									onChange={(description) => set({ description })}
								/>
								<TextField label="큰 제목" value={draft.tagline} onChange={(tagline) => set({ tagline })} />
								<TextField label="어떤 프로젝트" value={draft.context} onChange={(context) => set({ context })} />
								<TextField label="맡은 일" value={draft.role} onChange={(role) => set({ role: optional(role) })} />
								<PeriodField value={draft.period} onChange={(period) => set({ period })} />
								<div className="projects-field">
									<label>
										<span>페이지 모양</span>
										<select value={draft.look} onChange={(event) => set({ look: event.target.value as ProjectLook })}>
											{PROJECT_LOOKS.map((look) => (
												<option key={look} value={look}>
													{LOOK_LABEL[look]}
												</option>
											))}
										</select>
									</label>
									{/* 직접 짠 페이지는 코드(apps/safari/project/custom/)에 프로젝트 id로 등록해야 한다 */}
									{draft.look === 'custom' && (
										<p className="about-pane-hint">
											{hasCustomPage(draft.id)
												? `코드에 등록된 ${draft.id} 전용 페이지로 그립니다.`
												: `코드에 ${draft.id} 전용 페이지가 없어 기본 (카드)로 그립니다. 저장소의 safari/project/custom/에 등록하세요.`}
										</p>
									)}
								</div>
							</section>
							<section className="about-pane-group" aria-label="주소와 기술">
								<h3>주소와 기술</h3>
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
								<TextField
									label="주 언어"
									value={draft.language}
									onChange={(language) => set({ language })}
									options={LANGUAGES}
									placeholder="찾거나 적기"
								/>
								<TagInput label="기술" items={draft.stack} options={STACKS} onChange={(stack) => set({ stack })} />
							</section>
						</>
					)}
					{tab === 'pictures' && (
						<>
							<section className="about-pane-group" aria-label="그림">
								<h3>그림</h3>
								{/* 대표 화면(image)은 따로 고르지 않는다: 화면 모음의 첫 그림을 쓴다 (다른 장을 쓰려면 JSON의 image) */}
								<ImageField
									label="프로젝트 아이콘"
									value={draft.icon}
									onChange={(icon) => set({ icon })}
									hint="네모난 앱 아이콘. Safari 탭·Finder·페이지 맨 위에 작게 보입니다. 없으면 기본 모양"
								/>
								<ImageField
									label="글자 로고"
									value={draft.logo}
									onChange={(logo) => set({ logo })}
									hint="가로로 긴 글자 로고(워드마크). 있으면 페이지 머리에서 이름 글자 대신 크게 보입니다. 없어도 됩니다"
								/>
							</section>
							<section className="about-pane-group" aria-label="화면 모음">
								<h3>화면 모음</h3>
								<div className="projects-field">
									<label>
										<span>폴더</span>
										<select
											value={draft.galleryFolder ?? ''}
											onChange={(event) => set({ galleryFolder: optional(event.target.value) })}
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
										</select>
									</label>
									<p className="about-pane-hint">
										폴더를 고르면 그 안의 그림을 이름 순으로 모두 화면 모음으로 보여 줍니다 (설명은 파일 이름). 그림은
										저장소의 apps/react/public/imgs/projects 아래 폴더에 넣고 배포하면 여기에 나옵니다.
									</p>
								</div>
								{draft.galleryFolder && (
									<ul className="projects-folder-preview" aria-label="화면 모음 미리 보기">
										{(PUBLIC_IMAGES[draft.galleryFolder] ?? []).slice(0, 12).map((src) => (
											<li key={src}>
												{src.endsWith('.mp4') ? <video src={src} muted /> : <img src={src} alt="" loading="lazy" />}
											</li>
										))}
									</ul>
								)}
							</section>
						</>
					)}
					{tab === 'content' && (
						<>
							<FactsEditor facts={draft.facts} onChange={(facts) => set({ facts })} />
							<PointsEditor
								label="주요 기능"
								hint="첫 항목은 크게, 그림이 있으면 그림이 바탕이 됩니다."
								points={draft.highlights}
								onChange={(highlights) => set({ highlights })}
							/>
							<PointsEditor
								label="만든 방식"
								hint="번호가 붙어 좌우로 번갈아 놓입니다. 그림이 있으면 옆에 함께."
								points={draft.build}
								onChange={(build) => set({ build })}
							/>
							<PointsEditor
								label="쓰는 법"
								hint="단계로 보입니다."
								points={draft.usage ?? []}
								onChange={(usage) => set({ usage: usage.length ? usage : undefined })}
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
						</>
					)}
					{tab === 'app' && (
						<section className="about-pane-group" aria-label="앱">
							<h3>앱</h3>
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
							{app && (
								<>
									<TextField label="앱 이름" value={app.label} onChange={(label) => setApp({ label })} required />
									<ImageField
										label="앱 아이콘"
										required
										value={app.icon || undefined}
										onChange={(icon) => setApp({ icon: icon ?? '' })}
										toUrl={appIconUrl}
										fromPicked={(src) => src.replace(/^\/imgs\//, '')}
										hint="Dock·Launchpad·휴대폰 홈에 보이는 아이콘 (이미지 폴더 기준 경로 또는 올린 그림)"
									/>
									<Switch
										label="Dock에 고정"
										checked={app.inDock !== false}
										hint="끄면 Launchpad에 두고, 실행 중에만 Dock에 나타납니다."
										onChange={(on) => setApp({ inDock: on ? undefined : false })}
									/>
									<Switch
										label="게임"
										checked={Boolean(app.play)}
										hint="Safari 단추가 '여기서 열기' 대신 '여기서 플레이'가 됩니다."
										onChange={(on) => setApp({ play: on || undefined })}
									/>
									<div className="projects-field">
										<label>
											<span>뜨기 전 창 바탕</span>
											<select
												value={app.tone ?? 'light'}
												onChange={(event) => setApp({ tone: event.target.value === 'dark' ? 'dark' : undefined })}
											>
												<option value="light">밝게</option>
												<option value="dark">어둡게</option>
											</select>
										</label>
									</div>
									<div className="projects-field-pair">
										<TextField
											label="창 너비"
											type="number"
											value={app.windowSize?.width}
											onChange={(width) =>
												setApp({
													windowSize: width
														? { width: Number(width), height: app.windowSize?.height ?? 720 }
														: undefined,
												})
											}
										/>
										<TextField
											label="창 높이"
											type="number"
											value={app.windowSize?.height}
											onChange={(height) =>
												setApp({
													windowSize: height
														? { width: app.windowSize?.width ?? 1100, height: Number(height) }
														: undefined,
												})
											}
										/>
									</div>
								</>
							)}
						</section>
					)}
				</div>
				{preview && (
					<aside className="projects-preview" aria-label="미리 보기">
						<div className="projects-preview-chrome">
							<span /> <span /> <span />
							<em>{draft.demo || `${draft.name} 미리 보기`}</em>
						</div>
						<div className="projects-preview-page">
							<ProjectPage project={{ ...completeProject({ ...draft, id }), id }} />
						</div>
					</aside>
				)}
			</div>
		</form>
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
	const [savedNow, setSavedNow] = useState(false);
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
		setSavedNow(true);
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
					<span>저장했습니다. 새로고침하면 Safari·Dock·Finder·터미널에 적용됩니다.</span>
					<Button tone="primary" onClick={() => window.location.reload()}>
						지금 새로고침
					</Button>
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
