import { useEffect, useMemo, useRef, useState } from 'react';
import { PROJECT_LOOKS, type Project, type ProjectAppInfo } from '@macfolio/desktop-core/site';
import { completeProject } from '@/shared/site/publicImages';
import ProjectPage from '@/apps/safari/ProjectPage';
import { hasCustomPage } from '@/apps/safari/project/custom';
import { requestWindowSize } from '@/desktop/window/windowSizeRequest';
import { appIconUrl } from '@/shared/config/appIcon';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import TabList from '@/shared/ui/tabs/TabList';
import { fillWithSample } from '@/apps/settings/lookSamples';
import {
	ChaptersEditor,
	ControlsEditor,
	CreditsEditor,
	DeploymentsEditor,
	LinesEditor,
	PairsEditor,
	PointsEditor,
	ShotsEditor,
	TeamEditor,
	TroubleshootingEditor,
} from './editors';
import { ChoiceInput, FormRow, Group, PeriodField, SwitchRow, TagInput, TextField } from './fields';
import { ImageField } from './images';
import { LookPicker } from './looks';
import { LANGUAGES, NPM, REQUIRED, type Row, STACKS, hasContent, optional, validate, withoutId } from './model';
import { SheetHostContext } from './sheetContext';

type EditorTab = 'intro' | 'pictures' | 'content' | 'app' | 'json';
const TABS: { id: EditorTab; label: string }[] = [
	{ id: 'intro', label: '소개' },
	{ id: 'pictures', label: '그림' },
	{ id: 'content', label: '내용' },
	{ id: 'app', label: '앱' },
	{ id: 'json', label: 'JSON' },
];

/** 오른쪽 패널 버튼 모양 (macOS의 sidebar.right) */
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
export const ProjectEditor = ({
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
	/** 오른쪽에 Safari 페이지를 그대로 그려 둔다 (고치는 대로 바뀐다). 버튼으로 접고 편다 */
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
				{/* 창 맨 위 도구 막대: 왼쪽 돌아가기와 이름, 가운데 탭(세그먼트), 오른쪽 미리 보기 패널 버튼과 완료 */}
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
					<TabList
						className="projects-tabs"
						label="편집 항목"
						items={TABS}
						value={tab}
						onChange={(key) => {
							if (tab === key) return;
							// JSON에서 나갈 때는 고친 JSON을 먼저 읽는다 (틀렸으면 머문다)
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
					/>
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
										label="구현 방법"
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
									<TroubleshootingEditor
										items={draft.troubleshooting ?? []}
										onChange={(troubleshooting) =>
											set({ troubleshooting: troubleshooting.length ? troubleshooting : undefined })
										}
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
									<TeamEditor
										members={draft.team ?? []}
										onChange={(team) => set({ team: team.length ? team : undefined })}
									/>
									<LinesEditor
										label="내가 한 일"
										hint="내 역할 구역에 목록으로 보입니다."
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
									<DeploymentsEditor
										items={draft.deployments ?? []}
										onChange={(deployments) => set({ deployments: deployments.length ? deployments : undefined })}
									/>
									<CreditsEditor
										credits={draft.credits ?? []}
										onChange={(credits) => set({ credits: credits.length ? credits : undefined })}
									/>
								</>
							)}
							{tab === 'app' && (
								<>
									<Group title="앱">
										<SwitchRow
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
											<SwitchRow
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
			{/* 확인 창은 폼 밖에 둔다 (폼 안의 버튼 모양을 물려받지 않고, 설정 창 한가운데에 뜨게) */}
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
