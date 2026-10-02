import React, { useCallback, useEffect, useState } from 'react';
import type { RepoCard } from '@/apps/github/githubProfile';
import { isFullName, loadCandidates, lookupRepo, MAX_SHOWCASE, saveShowcase, useGithub } from '@/apps/github/githubApi';
import { groupByOwner, move, sameRepo } from '@/apps/settings/showcase';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';

type Status = 'loading' | 'ready' | 'error';

/** 저장소 한 줄의 이름과 설명 */
const RepoText: React.FC<{ repo: RepoCard }> = ({ repo }) => (
	<span className="showcase-text">
		<strong>
			<span className="showcase-owner">{repo.owner}/</span>
			{repo.name}
		</strong>
		{repo.description && <span className="showcase-description">{repo.description}</span>}
	</span>
);

/**
 * 시스템 설정 → GitHub (관리자만): GitHub 앱의 Pinned에 보일 저장소를 고르고 순서를 정한다.
 * 순서는 ≡ 손잡이를 끌어서 바꾼다. 고를 수 있는 저장소는 내 공개 저장소와 공개로 속한 조직의 저장소이고, 그 밖의 저장소는 owner/이름으로 더한다.
 * 바꿀 때마다 바로 저장한다 (macOS 설정처럼 저장 단추가 없다).
 */
const GithubShowcase: React.FC = () => {
	const { data } = useGithub();
	const login = data.profile.login;
	const [status, setStatus] = useState<Status>('loading');
	const [selected, setSelected] = useState<string[]>([]);
	const [repos, setRepos] = useState<RepoCard[]>([]);
	const [saving, setSaving] = useState(false);
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

	/** 고른 목록을 바꾸고 저장한다. 실패하면 되돌리고 이유를 알린다 */
	const save = async (next: string[]) => {
		const before = selected;
		setSelected(next);
		setSaving(true);
		try {
			setSelected(await saveShowcase(next));
		} catch (cause) {
			setSelected(before);
			setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const card = (name: string) => repos.find((repo) => sameRepo(repo.fullName, name));
	const isSelected = (name: string) => selected.some((item) => sameRepo(item, name));
	const full = selected.length >= MAX_SHOWCASE;

	const addByName = async (event: React.FormEvent) => {
		event.preventDefault();
		const name = input.trim();
		if (!isFullName(name)) {
			setError('저장소는 owner/이름으로 적어 주세요. 예: hyeoniverse/MacFolio');
			return;
		}
		if (isSelected(name)) {
			setError('이미 고른 저장소입니다.');
			return;
		}
		setSaving(true);
		try {
			const found = card(name) ?? (await lookupRepo(name));
			if (!card(found.fullName)) setRepos((list) => [found, ...list]);
			setInput('');
			await save([...selected, found.fullName]);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '저장소를 찾지 못했습니다.');
		} finally {
			setSaving(false);
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
						<h3>
							보일 저장소{' '}
							<span className="showcase-count">
								{selected.length}/{MAX_SHOWCASE}
							</span>
						</h3>
						{selected.length === 0 ? (
							<p className="settings-hint">고른 저장소가 없어서 GitHub 앱에 Pinned가 보이지 않습니다.</p>
						) : (
							<ol className="showcase-list">
								{selected.map((name, index) => {
									const repo = card(name);
									return (
										<li key={name} className="showcase-row">
											{repo ? <RepoText repo={repo} /> : <span className="showcase-text">{name}</span>}
											<span className="showcase-actions">
												<IconButton
													icon="fa-solid fa-minus"
													className="showcase-remove"
													label={`${name} 빼기`}
													disabled={saving}
													onClick={() => void save(selected.filter((item) => item !== name))}
												/>
											</span>
											{/* ≡ 손잡이 (메모 폴더 편집과 같다): 끌거나 ↑·↓ 키로 순서를 바꾼다 */}
											<button
												type="button"
												className="showcase-handle"
												aria-label={`순서 바꾸기 (${name})`}
												title="끌거나 ↑·↓ 키로 순서를 바꿉니다"
												disabled={saving || selected.length < 2}
												onPointerDown={(event) =>
													startPointerReorder(event, (from, to) => void save(move(selected, from, to - from)))
												}
												onKeyDown={(event) => {
													const delta = reorderKeyDelta(event.key);
													if (!delta) return;
													event.preventDefault();
													void save(move(selected, index, delta));
												}}
											>
												<i className="fa-solid fa-bars" aria-hidden="true" />
											</button>
										</li>
									);
								})}
							</ol>
						)}
					</section>

					<form className="showcase-lookup" onSubmit={(event) => void addByName(event)}>
						<input
							aria-label="저장소 이름 (owner/이름)"
							placeholder="owner/저장소 이름으로 더하기"
							value={input}
							disabled={saving || full}
							onChange={(event) => setInput(event.target.value)}
						/>
						<Button type="submit" disabled={saving || full || !input.trim()}>
							더하기
						</Button>
					</form>
					{full && <p className="settings-hint">{MAX_SHOWCASE}개를 모두 골랐습니다. 하나를 빼면 더할 수 있습니다.</p>}

					{groupByOwner(repos, login).map((group) => (
						<section key={group.owner} className="showcase-group" aria-label={`${group.owner}의 저장소`}>
							<h3>
								{group.owner}
								{sameRepo(group.owner, login) ? ' (내 계정)' : ''}
							</h3>
							<ul className="showcase-list">
								{group.repos.map((repo) => {
									const chosen = isSelected(repo.fullName);
									return (
										<li key={repo.fullName} className="showcase-row">
											<RepoText repo={repo} />
											<span className="showcase-actions">
												{chosen ? (
													// Font Awesome의 display가 앞서지 않게 바깥 칸에서 가운데 맞춘다
													<span className="showcase-chosen" role="img" aria-label={`${repo.fullName} 고름`}>
														<i className="fa-solid fa-check" aria-hidden="true" />
													</span>
												) : (
													<IconButton
														icon="fa-solid fa-plus"
														label={`${repo.fullName} 더하기`}
														disabled={saving || full}
														onClick={() => void save([...selected, repo.fullName])}
													/>
												)}
											</span>
										</li>
									);
								})}
							</ul>
						</section>
					))}
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
