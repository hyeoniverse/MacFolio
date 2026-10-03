import React, { useCallback, useEffect, useState } from 'react';
import type { RepoCard } from '@/apps/github/githubProfile';
import { isFullName, loadCandidates, lookupRepo, MAX_SHOWCASE, saveShowcase, useGithub } from '@/apps/github/githubApi';
import { groupByOwner, move, sameRepo } from '@/apps/settings/showcase';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';

type Status = 'loading' | 'ready' | 'error';

/** 저장소 한 줄: 책 아이콘, 이름, 그 아래 owner · 설명 */
const RepoText: React.FC<{ repo?: RepoCard; name: string }> = ({ repo, name }) => {
	const [owner, repoName] = (repo?.fullName ?? name).split('/');
	return (
		<span className="showcase-text">
			<i className="fa-solid fa-book-bookmark showcase-icon" aria-hidden="true" />
			<span className="showcase-lines">
				{/* 스크린 리더와 시험은 owner/이름 한 덩어리로 읽는다 */}
				<strong aria-label={`${owner}/${repoName}`}>{repoName}</strong>
				<span className="showcase-meta">
					{owner}
					{repo?.description && ` · ${repo.description}`}
				</span>
			</span>
		</span>
	);
};

/**
 * 시스템 설정 → GitHub (관리자만): GitHub 앱의 Pinned에 보일 저장소를 고르고 순서를 정한다.
 * 평소에는 고른 목록만 보이고, 편집을 누르면 빼기(−)·순서(≡ 끌기)·더하기(＋, owner/이름)가 나타난다.
 * 편집 중에 바꾼 것은 완료를 누를 때 한 번에 저장한다 (저장할 때마다 서버가 GitHub에서 새로 받으므로 요청을 아낀다).
 * 취소하거나 다른 항목으로 넘어가면 바꾼 것은 버린다.
 */
const GithubShowcase: React.FC = () => {
	const { data } = useGithub();
	const login = data.profile.login;
	const [status, setStatus] = useState<Status>('loading');
	/** 저장된 목록 */
	const [selected, setSelected] = useState<string[]>([]);
	/** 편집 중인 목록 (null이면 편집 중이 아니다) */
	const [draft, setDraft] = useState<string[] | null>(null);
	const [repos, setRepos] = useState<RepoCard[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [input, setInput] = useState('');

	/** 고를 수 있는 저장소를 받는다 (값은 받은 뒤에 콜백에서 바꾼다) */
	const load = useCallback(
		() =>
			loadCandidates().then(
				(result) => {
					setSelected(result.selected);
					setRepos(result.repos);
					setStatus('ready');
				},
				() => setStatus('error')
			),
		[]
	);

	useEffect(() => {
		void load();
	}, [load]);

	const retry = () => {
		setStatus('loading');
		void load();
	};

	const editing = draft !== null;
	const list = draft ?? selected;
	const card = (name: string) => repos.find((repo) => sameRepo(repo.fullName, name));
	const isChosen = (name: string) => list.some((item) => sameRepo(item, name));
	const full = list.length >= MAX_SHOWCASE;

	const startEditing = () => {
		setDraft(selected);
		setInput('');
	};

	/** 완료: 바뀐 것이 있으면 한 번에 저장한다. 실패하면 편집 중인 채로 이유를 알린다 */
	const finish = async () => {
		if (!draft) return;
		if (draft.length === selected.length && draft.every((name, index) => name === selected[index])) {
			setDraft(null);
			return;
		}
		setBusy(true);
		try {
			setSelected(await saveShowcase(draft));
			setDraft(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.');
		} finally {
			setBusy(false);
		}
	};

	/** owner/이름으로 더한다 (GitHub에 있는 공개 저장소인지 서버에 묻는다. 저장은 완료할 때) */
	const addByName = async (event: React.FormEvent) => {
		event.preventDefault();
		const name = input.trim();
		if (!isFullName(name)) {
			setError('저장소는 owner/이름으로 적어 주세요. 예: hyeoniverse/MacFolio');
			return;
		}
		if (isChosen(name)) {
			setError('이미 고른 저장소입니다.');
			return;
		}
		setBusy(true);
		try {
			const found = card(name) ?? (await lookupRepo(name));
			if (!card(found.fullName)) setRepos((current) => [found, ...current]);
			setDraft((current) => [...(current ?? []), found.fullName]);
			setInput('');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '저장소를 찾지 못했습니다.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="showcase">
			<p className="settings-hint showcase-intro">
				GitHub 앱의 Pinned에 보일 저장소입니다. {MAX_SHOWCASE}개까지 고를 수 있고, 위에서부터 차례로 보입니다.
			</p>

			{status === 'loading' && <p className="settings-hint">저장소를 불러오는 중…</p>}
			{status === 'error' && (
				<div className="showcase-error">
					<p className="settings-hint">GitHub 저장소를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>
					<Button onClick={retry}>다시 시도</Button>
				</div>
			)}

			{status === 'ready' && (
				<>
					<section className="showcase-group" aria-label="보일 저장소">
						<div className="showcase-head">
							<h3>
								보일 저장소{' '}
								<span className="showcase-count">
									{list.length}/{MAX_SHOWCASE}
								</span>
							</h3>
							<span className="showcase-head-actions">
								{editing ? (
									<>
										<button
											type="button"
											className="showcase-text-button"
											disabled={busy}
											onClick={() => setDraft(null)}
										>
											취소
										</button>
										<button
											type="button"
											className="showcase-text-button strong"
											disabled={busy}
											onClick={() => void finish()}
										>
											완료
										</button>
									</>
								) : (
									<button type="button" className="showcase-text-button" onClick={startEditing}>
										편집
									</button>
								)}
							</span>
						</div>
						{list.length === 0 ? (
							<p className="settings-hint">
								{editing
									? '아래 목록에서 ＋를 누르거나 owner/이름으로 더해 주세요.'
									: '고른 저장소가 없어서 GitHub 앱에 Pinned가 보이지 않습니다.'}
							</p>
						) : (
							<ol className={`showcase-list ${editing ? 'editing' : ''}`}>
								{list.map((name, index) => {
									const repo = card(name);
									return (
										<li key={name} className="showcase-row">
											<RepoText repo={repo} name={name} />
											{editing && (
												<>
													<span className="showcase-actions">
														<IconButton
															icon="fa-solid fa-circle-minus"
															className="showcase-remove"
															label={`${name} 빼기`}
															disabled={busy}
															onClick={() => setDraft(list.filter((item) => item !== name))}
														/>
													</span>
													{/* ≡ 손잡이 (메모 폴더 편집과 같다): 끌거나 ↑·↓ 키로 순서를 바꾼다 */}
													<button
														type="button"
														className="showcase-handle"
														aria-label={`순서 바꾸기 (${name})`}
														title="끌거나 ↑·↓ 키로 순서를 바꿉니다"
														disabled={busy || list.length < 2}
														onPointerDown={(event) =>
															startPointerReorder(event, (from, to) => setDraft(move(list, from, to - from)))
														}
														onKeyDown={(event) => {
															const delta = reorderKeyDelta(event.key);
															if (!delta) return;
															event.preventDefault();
															setDraft(move(list, index, delta));
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
						)}
					</section>

					{editing && (
						<>
							<form className="showcase-lookup" onSubmit={(event) => void addByName(event)}>
								<input
									aria-label="저장소 이름 (owner/이름)"
									placeholder="owner/저장소 이름으로 더하기"
									value={input}
									disabled={busy || full}
									onChange={(event) => setInput(event.target.value)}
								/>
								<Button type="submit" disabled={busy || full || !input.trim()}>
									더하기
								</Button>
							</form>
							{full && (
								<p className="settings-hint">{MAX_SHOWCASE}개를 모두 골랐습니다. 하나를 빼면 더할 수 있습니다.</p>
							)}

							{groupByOwner(repos, login).map((group) => (
								<section key={group.owner} className="showcase-group" aria-label={`${group.owner}의 저장소`}>
									<h3>
										{group.owner}
										{sameRepo(group.owner, login) ? ' (내 계정)' : ''}
									</h3>
									<ul className="showcase-list">
										{group.repos.map((repo) => (
											<li key={repo.fullName} className="showcase-row">
												<RepoText repo={repo} name={repo.fullName} />
												<span className="showcase-actions">
													{isChosen(repo.fullName) ? (
														// Font Awesome의 display가 앞서지 않게 바깥 칸에서 가운데 맞춘다
														<span className="showcase-chosen" role="img" aria-label={`${repo.fullName} 고름`}>
															<i className="fa-solid fa-circle-check" aria-hidden="true" />
														</span>
													) : (
														<IconButton
															icon="fa-solid fa-circle-plus"
															className="showcase-add"
															label={`${repo.fullName} 더하기`}
															disabled={busy || full}
															onClick={() => setDraft([...list, repo.fullName])}
														/>
													)}
												</span>
											</li>
										))}
									</ul>
								</section>
							))}
						</>
					)}
				</>
			)}

			{error && (
				<AlertDialog
					title="저장소를 바꾸지 못했습니다"
					message={error}
					confirmLabel="확인"
					cancelLabel={null}
					onConfirm={() => setError(null)}
					onCancel={() => setError(null)}
				/>
			)}
		</div>
	);
};

export default GithubShowcase;
