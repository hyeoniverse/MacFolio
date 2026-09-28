import React from 'react';

import AppWindow from '@/desktop/window/Window';
import Profile from '@/apps/github/GithubProfile'; // 프로필 컴포넌트
import '@/apps/github/Github.css';
import { env } from '@/shared/config/env';
import { PROFILE, PROJECTS } from '@/shared/profile';

const imgUrl = env.imageUrl;

const Github: React.FC = () => {
	return (
		<AppWindow title="GitHub" appName="github">
			<div className="github-shell">
				<div className="github-layout">
					<div className="left-section">
						<div className="profile-container">
							<div className="profile-image">
								<img src={`${imgUrl}/me.png`} alt="Profile" />
							</div>
							<div className="profile-info">
								<h2>Kim Jeong Hyeon</h2>
								<p>App Developer | Frontend Enthusiast</p>
								<p>Seoul Women's University</p>
								<p>
									<i className="fa-solid fa-map-marker-alt"></i>
									<strong>Seoul, South Korea</strong>
								</p>
								<div className="profile-links">
									<a href={PROFILE.github} target="_blank" rel="noopener noreferrer">
										GitHub
									</a>
									<a href={`mailto:${PROFILE.email}`}>Email</a>
								</div>
							</div>
						</div>
					</div>

					<div className="right-section">
						<Profile />
						<h2>📌 Pinned Repositories</h2>
						<div className="repos-list">
							{PROJECTS.map((repo) => (
								<div key={repo.id} className="repo-card">
									<div className="repo-card-header">
										<a href={repo.url} target="_blank" rel="noopener noreferrer">
											<h3>{repo.name}</h3>
										</a>
										<span className="badge">Public</span>
									</div>
									<p className="repo-card-description">{repo.description}</p>
									<div className="repo-card-footer">
										<span className="repo-language">
											<span className="repo-language-color" style={{ backgroundColor: repo.languageColor }}></span>
											{repo.language}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</AppWindow>
	);
};

export default Github;
