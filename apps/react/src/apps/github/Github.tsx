import React, { useEffect } from 'react';
import AppWindow from '@/desktop/window/Window';
import { env } from '@/shared/config/env';
import { useSettings } from '@/shared/settings/settingsStore';
import { resolveTheme } from '@/shared/settings/settings';
import { LANGUAGE_COLORS, type RepoCard as Repo } from '@/apps/github/githubProfile';
import { loadGithub, useGithub } from '@/apps/github/githubApi';
import GithubReadme from '@/apps/github/GithubReadme';
import '@/apps/github/Github.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 고정 저장소 카드 (GitHub의 Pinned) */
const RepoCard: React.FC<{ repo: Repo; login: string }> = ({ repo, login }) => (
	<li className="gh-repo">
		<div className="gh-repo-head">
			<i className="fa-solid fa-book-bookmark" aria-hidden="true" />
			<a href={repo.url} {...external} className="gh-repo-name">
				{repo.owner.toLowerCase() !== login.toLowerCase() && <span className="gh-repo-owner">{repo.owner}/</span>}
				{repo.name}
			</a>
			<span className="gh-badge">Public</span>
		</div>
		{repo.description && (
			<p className="gh-repo-description" title={repo.description}>
				{repo.description}
			</p>
		)}
		<div className="gh-repo-meta">
			{repo.language && (
				<span>
					<span
						className="gh-language-dot"
						style={{ backgroundColor: LANGUAGE_COLORS[repo.language] ?? 'var(--gh-muted)' }}
					/>
					{repo.language}
				</span>
			)}
			{repo.stars > 0 && (
				<span>
					<i className="fa-regular fa-star" aria-hidden="true" /> {repo.stars}
				</span>
			)}
			{repo.forks > 0 && (
				<span>
					<i className="fa-solid fa-code-fork" aria-hidden="true" /> {repo.forks}
				</span>
			)}
			{repo.homepage && (
				<a href={repo.homepage} {...external}>
					<i className="fa-solid fa-link" aria-hidden="true" /> 데모
				</a>
			)}
		</div>
	</li>
);

/**
 * GitHub: 관리자의 GitHub 프로필을 GitHub 화면처럼 보여준다.
 * 왼쪽에 프로필, 오른쪽에 프로필 README와 고른 저장소(시스템 설정 → GitHub에서 고른다).
 * 값은 API 서버가 GitHub에서 받아 둔 것이고, 서버에 닿지 않으면 넣어 둔 스냅샷을 보여 준다.
 */
const Github: React.FC = () => {
	const { theme } = useSettings();
	// README의 밝은·어두운 그림(통계 카드)을 앱의 화면 모드에 맞춘다
	const dark = resolveTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';
	const { source, data } = useGithub();
	const { profile, repos } = data;

	useEffect(() => {
		void loadGithub();
	}, []);

	return (
		<AppWindow title="GitHub" appName="github">
			<div className="gh-shell">
				<div className="gh" data-source={source}>
					<header className="gh-header">
						<i className="fa-brands fa-github" aria-hidden="true" />
						<strong>{profile.login}</strong>
						<nav className="gh-tabs" aria-label="GitHub 탭">
							<span className="gh-tab active" aria-current="page">
								<i className="fa-solid fa-book-open" aria-hidden="true" /> Overview
							</span>
							<a className="gh-tab" href={`${profile.url}?tab=repositories`} {...external}>
								<i className="fa-solid fa-book-bookmark" aria-hidden="true" /> Repositories
								<span className="gh-counter">{profile.publicRepos}</span>
							</a>
						</nav>
					</header>

					<div className="gh-body">
						<aside className="gh-profile" aria-label="프로필">
							<img
								className="gh-avatar"
								src={profile.avatarUrl}
								alt={`${profile.login}의 프로필 사진`}
								// GitHub 이미지를 못 불러오면 사이트에 있는 사진
								onError={(event) => {
									event.currentTarget.src = `${env.imageUrl}/me.png`;
								}}
							/>
							<div className="gh-names">
								{profile.name && <h1>{profile.name}</h1>}
								<p>{profile.login}</p>
							</div>
							{profile.bio && <p className="gh-bio">{profile.bio}</p>}
							<a className="gh-button" href={profile.url} {...external}>
								Follow
							</a>
							<p className="gh-follow">
								<i className="fa-solid fa-user-group" aria-hidden="true" />
								<strong>{profile.followers}</strong> followers · <strong>{profile.following}</strong> following
							</p>
							<ul className="gh-details">
								{profile.location && (
									<li>
										<i className="fa-solid fa-location-dot" aria-hidden="true" /> {profile.location}
									</li>
								)}
								{profile.website && (
									<li>
										<i className="fa-solid fa-link" aria-hidden="true" />
										<a href={profile.website} {...external}>
											{profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
										</a>
									</li>
								)}
							</ul>
						</aside>

						<main className="gh-main">
							{data.readme && (
								<article className="gh-readme" aria-label="README">
									<p className="gh-readme-path">
										{profile.login} / README<span>.md</span>
									</p>
									<div className="gh-readme-body">
										<GithubReadme
											markdown={data.readme}
											login={profile.login}
											rawBase={data.readmeBaseUrl}
											dark={dark}
										/>
									</div>
								</article>
							)}

							{repos.length > 0 && (
								<section className="gh-pinned" aria-label="Pinned">
									<h2>Pinned</h2>
									<ul>
										{repos.map((repo) => (
											<RepoCard key={repo.fullName} repo={repo} login={profile.login} />
										))}
									</ul>
								</section>
							)}
						</main>
					</div>
				</div>
			</div>
		</AppWindow>
	);
};

export default Github;
