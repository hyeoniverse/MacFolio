import { useMemo, useState } from 'react';
import {
	blankProject,
	mergeProjects,
	overrideOf,
	parseProjects,
	PROJECT_LOOKS,
	type Project,
	type ProjectAppInfo,
	type ProjectLook,
	type SiteProjects,
} from '@macfolio/desktop-core/site';
import { DEFAULT_PROJECTS } from '@/shared/profile';
import { getSavedProjects, sendProjects } from '@/shared/site/siteContent';
import { imageFolders, PUBLIC_IMAGES } from '@/shared/site/publicImages';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';

/** 목록의 한 줄: 프로젝트 하나 (코드의 기본값에 덮어쓴 모습) */
interface Row {
	id: string;
	hidden: boolean;
	project: Project;
	/** 코드에 없는, 관리자가 더한 프로젝트 (지울 수 있다) */
	isNew: boolean;
}

const DEFAULTS = new Map(DEFAULT_PROJECTS.map((project) => [project.id, project]));

const LOOK_LABEL: Record<ProjectLook, string> = {
	editorial: '신문 1면',
	playful: '칸반 보드',
	minimal: '명함',
	game: '게임',
	terminal: '터미널',
	product: '제품 페이지',
	creative: '포트폴리오',
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
function validate(id: string, project: Project): { value: Project } | { errors: string[] } {
	const parsed = parseProjects({ items: [{ id, override: withoutId(project) }] });
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
}: {
	label: string;
	value: string | number | undefined;
	onChange: (value: string) => void;
	hint?: string;
	type?: string;
	placeholder?: string;
}) => (
	<div className="projects-field">
		<label>
			<span>{label}</span>
			<input
				type={type}
				value={value ?? ''}
				placeholder={placeholder}
				spellCheck={false}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
		{hint && <p className="about-pane-hint">{hint}</p>}
	</div>
);

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

/**
 * 쉼표로 나눠 쓰는 목록 칸. 치는 동안은 친 그대로 두고(끝의 쉼표·공백이 사라지지 않게), 목록으로 나눈 값만 올려 보낸다
 */
const ListField = ({
	label,
	items,
	onChange,
}: {
	label: string;
	items: string[];
	onChange: (items: string[]) => void;
}) => {
	const [text, setText] = useState(() => items.join(', '));
	return (
		<TextField
			label={label}
			value={text}
			onChange={(raw) => {
				setText(raw);
				onChange(
					raw
						.split(',')
						.map((item) => item.trim())
						.filter(Boolean)
				);
			}}
			hint="쉼표(,)로 나눠 씁니다."
		/>
	);
};

/** 빈 글자는 필드를 지운다 (고를 수 있는 필드) */
const optional = (value: string) => (value.trim() ? value : undefined);

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
	const [tab, setTab] = useState<'basic' | 'json'>('basic');
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
				<div className="projects-tabs" role="tablist" aria-label="편집 방식">
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'basic'}
						onClick={() => {
							if (tab === 'basic') return;
							const project = readJson();
							if (project) {
								setDraft(project);
								setErrors([]);
								setTab('basic');
							}
						}}
					>
						기본
					</button>
					<button type="button" role="tab" aria-selected={tab === 'json'} onClick={() => tab !== 'json' && openJson()}>
						고급 (JSON)
					</button>
				</div>
				<button type="submit" className="showcase-text-button strong">
					완료
				</button>
			</div>

			{errors.length > 0 && (
				<ul className="about-pane-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}

			{tab === 'json' ? (
				<div className="projects-json">
					<textarea
						aria-label="프로젝트 JSON"
						value={json}
						spellCheck={false}
						onChange={(event) => setJson(event.target.value)}
					/>
					<p className="about-pane-hint">
						모든 필드를 고칠 수 있습니다 (주요 기능, 장, 화면 모음, 출처 등). 링크·데모는 https:// 주소, 그림은 사이트
						안 경로(/imgs/…)나 https:// 주소만 받습니다.
					</p>
				</div>
			) : (
				<>
					<section className="about-pane-group" aria-label="소개">
						<h3>소개</h3>
						{row.isNew && (
							<TextField
								label="id"
								value={id}
								onChange={setId}
								hint="주소와 앱 이름에 쓰입니다. 영어 소문자·숫자·-로 (예: my-project)"
							/>
						)}
						<TextField label="이름" value={draft.name} onChange={(name) => set({ name })} />
						<TextField label="한 줄 소개" value={draft.description} onChange={(description) => set({ description })} />
						<TextField label="큰 제목" value={draft.tagline} onChange={(tagline) => set({ tagline })} />
						<TextField label="어떤 프로젝트" value={draft.context} onChange={(context) => set({ context })} />
						<TextField label="맡은 일" value={draft.role} onChange={(role) => set({ role: optional(role) })} />
						<TextField label="기간" value={draft.period} onChange={(period) => set({ period: optional(period) })} />
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
						</div>
					</section>

					<section className="about-pane-group" aria-label="주소와 기술">
						<h3>주소와 기술</h3>
						<TextField
							label="저장소"
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
						<TextField label="주 언어" value={draft.language} onChange={(language) => set({ language })} />
						<ListField label="기술" items={draft.stack} onChange={(stack) => set({ stack })} />
						<TextField
							label="화면 캡처"
							value={draft.image}
							onChange={(image) => set({ image })}
							placeholder="/imgs/projects/아이디/screenshot.jpg"
							hint="사이트 안 경로(/imgs/…)나 https:// 주소"
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
									{imageFolders().map((folder) => (
										<option key={folder} value={folder}>
											{folder.replace(/^\/imgs\//, '')} ({PUBLIC_IMAGES[folder].length}장)
										</option>
									))}
								</select>
							</label>
							<p className="about-pane-hint">
								폴더를 고르면 그 안의 그림을 이름 순으로 모두 화면 모음으로 보여 줍니다 (설명은 파일 이름). 그림은
								저장소의 apps/react/public/imgs 아래 폴더에 넣고 배포하면 여기에 나옵니다.
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
												icon: draft.icon ? draft.icon.replace(/^\/imgs\//, '') : 'safari.png',
											})
										: undefined,
								})
							}
						/>
						{app && (
							<>
								<TextField label="앱 이름" value={app.label} onChange={(label) => setApp({ label })} />
								<TextField
									label="앱 아이콘"
									value={app.icon}
									onChange={(icon) => setApp({ icon })}
									hint="이미지 폴더 기준 경로 (예: projects/newpick/app-icon.png)나 https:// 주소"
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
												windowSize: width ? { width: Number(width), height: app.windowSize?.height ?? 720 } : undefined,
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
					<p className="about-pane-hint">주요 기능, 장, 화면 모음 같은 나머지 내용은 고급 (JSON)에서 고칩니다.</p>
				</>
			)}
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
	const dirty = JSON.stringify(contentFrom(rows)) !== JSON.stringify(contentFrom(initial));

	const update = (next: Row[]) => {
		setRows(next);
		setSavedNow(false);
	};
	const move = (index: number, delta: number) => {
		const next = [...rows];
		const [row] = next.splice(index, 1);
		next.splice(index + delta, 0, row);
		update(next);
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
		const parsed = parseProjects(content);
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

			<ul className="showcase-list" aria-label="프로젝트">
				{rows.map((row, index) => {
					const changed = !row.isNew && Object.keys(overrideOf(row.project, DEFAULTS.get(row.id)) ?? {}).length > 0;
					const tags = [
						row.project.app && row.project.demo ? '앱' : null,
						row.isNew ? '새 프로젝트' : changed ? '고침' : null,
						row.hidden ? '숨김' : null,
					].filter(Boolean);
					return (
						<li key={row.id} className={`showcase-row projects-row ${row.hidden ? 'hidden' : ''}`}>
							<span className="showcase-lines">
								<strong>{row.project.name}</strong>
								<span className="showcase-meta">{[row.id, ...tags].join(' · ')}</span>
							</span>
							{editMode && (
								<span className="showcase-actions">
									<IconButton
										label={`${row.project.name} 위로`}
										icon="fa-solid fa-chevron-up"
										disabled={index === 0}
										onClick={() => move(index, -1)}
									/>
									<IconButton
										label={`${row.project.name} 아래로`}
										icon="fa-solid fa-chevron-down"
										disabled={index === rows.length - 1}
										onClick={() => move(index, 1)}
									/>
									<IconButton
										label={row.hidden ? `${row.project.name} 보이기` : `${row.project.name} 숨기기`}
										icon={row.hidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'}
										onClick={() =>
											update(rows.map((other) => (other === row ? { ...row, hidden: !row.hidden } : other)))
										}
									/>
									{row.isNew && (
										<IconButton
											label={`${row.project.name} 지우기`}
											icon="fa-solid fa-trash-can"
											onClick={() => update(rows.filter((other) => other !== row))}
										/>
									)}
									<button type="button" className="showcase-text-button projects-edit" onClick={() => setEditing(row)}>
										편집
									</button>
								</span>
							)}
						</li>
					);
				})}
				{editMode && (
					<li className="showcase-row projects-row projects-add">
						<button
							type="button"
							className="showcase-text-button"
							onClick={() => {
								let n = 1;
								while (rows.some((row) => row.id === `new-project-${n}`)) n += 1;
								const id = `new-project-${n}`;
								setEditing({ id, hidden: false, isNew: true, project: { ...blankProject(id), name: '새 프로젝트' } });
							}}
						>
							<i className="fa-solid fa-plus" aria-hidden="true" /> 새 프로젝트
						</button>
					</li>
				)}
			</ul>

			<p className="about-pane-hint">
				편집을 누르면 순서를 바꾸고, 숨기고, 고치고, 새 프로젝트를 더할 수 있습니다. 완료를 누르면 저장합니다. 숨긴
				프로젝트는 Safari 탭·Finder·터미널·Dock에서 빠집니다. 코드에 있는 프로젝트는 숨길 수만 있고, 새로 더한
				프로젝트는 지울 수 있습니다.
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
