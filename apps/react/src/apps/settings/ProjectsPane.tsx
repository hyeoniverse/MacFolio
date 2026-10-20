import { useMemo, useState } from 'react';
import { blankProject, overrideOf, parseProjects } from '@macfolio/desktop-core/site';
import { getSavedProjects, PARSE_OPTIONS, sendProjects } from '@/shared/site/siteContent';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import Switch from '@/shared/ui/switch/Switch';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';
import { move as moveItem } from '@/apps/settings/showcase';
import { RowChevron } from './projects/ListTable';
import { ProjectEditor } from './projects/ProjectEditor';
import { DEFAULTS, type Row, contentFrom, needsReload, rowsFrom } from './projects/model';

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
							<Button className="showcase-text-button" onClick={cancel} disabled={busy}>
								취소
							</Button>
							<Button className="showcase-text-button strong" onClick={() => void finish()} disabled={busy}>
								완료
							</Button>
						</>
					) : (
						<Button
							className="showcase-text-button"
							onClick={() => {
								setEditMode(true);
								setSavedNow(false);
							}}
						>
							편집
						</Button>
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
									{/* 줄 전체가 편집 버튼 (항목 시트처럼 줄을 누르면 연다). 스위치·손잡이는 그 위에 따로 눌린다 */}
									<button
										type="button"
										className="projects-row-open"
										aria-label={`${name} 편집`}
										disabled={busy}
										onClick={() => setEditing(row)}
									/>
									<span className="showcase-actions">
										{/* 코드에 있는 프로젝트는 보이기 스위치로 숨기고, 새로 더한 프로젝트는 빼기(⊖) */}
										{row.isNew ? (
											<IconButton
												icon="fa-solid fa-circle-minus"
												className="showcase-remove"
												label={`${name} 빼기`}
												disabled={busy}
												onClick={() => update(rows.filter((other) => other !== row))}
											/>
										) : (
											<Switch
												size="small"
												className="projects-switch projects-row-switch"
												aria-label={`${name} 보이기`}
												title={row.hidden ? '숨긴 프로젝트입니다.' : '보이는 프로젝트입니다.'}
												checked={!row.hidden}
												disabled={busy}
												onChange={(on) =>
													update(rows.map((other) => (other === row ? { ...row, hidden: !on } : other)))
												}
											/>
										)}
										<RowChevron />
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
				편집을 누르면 ≡로 순서를 바꾸고, 스위치로 보이거나 숨기고, 줄을 눌러 고치고, 맨 아래 칸에 id를 적어 새
				프로젝트를 더합니다. 완료를 누르면 저장합니다. 숨긴 프로젝트는 Safari 탭·Finder·터미널·Dock에서 빠집니다. 코드에
				있는 프로젝트는 숨길 수만 있고, 새로 더한 프로젝트는 지울 수 있습니다.
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
