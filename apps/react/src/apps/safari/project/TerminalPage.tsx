// DevCourse (학습 기록): 페이지 전체가 터미널 창 하나. 명령을 하나씩 치면 그 결과로 소개, 숫자, 기능, 컨벤션, 만든 방식, 맡은 일, 기술 사양이 나온다
import React from 'react';
import type { Project } from '@/shared/profile';
import { Links } from '@/apps/safari/project/parts';
import '@/apps/safari/project/TerminalPage.css';

const Prompt: React.FC<{ command: string }> = ({ command }) => (
	<p className="tm-prompt">
		<span className="tm-user">hyeoniverse@devcourse</span>
		<span className="tm-path">~</span>
		<span className="tm-dollar">$</span> <code>{command}</code>
	</p>
);

/** 폴더 이름처럼 (빈칸은 -) */
const slug = (value: string) => value.replace(/\s+/g, '-');

const TerminalPage: React.FC<{ project: Project }> = ({ project }) => (
	<div className="tm">
		<div className="tm-window">
			<div className="tm-bar" aria-hidden="true">
				<span />
				<span />
				<span />
				<p>{project.url.replace('https://github.com/', '')} — zsh</p>
			</div>
			<div className="tm-screen">
				<header className="tm-block">
					{project.terminal?.map((line) =>
						line.startsWith('$ ') ? (
							<Prompt key={line} command={line.slice(2)} />
						) : (
							<p key={line} className="tm-out">
								{line}
							</p>
						)
					)}
					<Prompt command="cat ABOUT.md" />
					<p className="tm-heading"># {project.name}</p>
					<h1>{project.tagline}</h1>
					<p className="tm-out">{project.description}</p>
				</header>

				<section className="tm-block" aria-label="한눈에 보기">
					<Prompt command="stat ." />
					<dl className="tm-pairs">
						<div>
							<dt>context</dt>
							<dd>{project.context}</dd>
						</div>
						{project.period && (
							<div>
								<dt>period</dt>
								<dd>{project.period}</dd>
							</div>
						)}
						{project.facts.map((fact) => (
							<div key={fact.label}>
								<dt>{fact.label}</dt>
								<dd>{fact.value}</dd>
							</div>
						))}
					</dl>
				</section>

				<section className="tm-block" aria-label="주요 기능">
					<Prompt command="ls -l highlights/" />
					<ul className="tm-ls">
						{project.highlights.map((point) => (
							<li key={point.title}>
								<span className="tm-perm">drwxr-xr-x</span>
								<span className="tm-dir">{slug(point.title)}/</span>
								<span className="tm-comment"># {point.body}</span>
							</li>
						))}
					</ul>
				</section>

				{project.conventions && (
					<section className="tm-block" aria-label="커밋 컨벤션">
						<Prompt command="git log --format=%s | cut -d: -f1 | sort -u" />
						<ul className="tm-types">
							{project.conventions.map((convention) => (
								<li key={convention.type}>
									<code>{convention.type}</code>
									<span>{convention.description}</span>
								</li>
							))}
						</ul>
					</section>
				)}

				<section className="tm-block" aria-label="만든 방식">
					<Prompt command="cat BUILD.md" />
					{project.build.map((point) => (
						<div key={point.title} className="tm-md">
							<p className="tm-heading">## {point.title}</p>
							<p className="tm-out">{point.body}</p>
						</div>
					))}
				</section>

				<section className="tm-block" aria-label="맡은 일">
					<Prompt command="whoami --contributions" />
					<ul className="tm-list">
						{project.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>

				<section className="tm-block" aria-label="기술 사양">
					<Prompt command="cat stack.json" />
					<pre className="tm-json">
						{'{\n'}
						{project.specs.map((spec, i) => (
							<React.Fragment key={spec.label}>
								{'  '}
								<span className="tm-key">"{spec.label}"</span>
								{': '}
								<span className="tm-string">"{spec.value}"</span>
								{i < project.specs.length - 1 ? ',\n' : '\n'}
							</React.Fragment>
						))}
						{'}'}
					</pre>
				</section>

				<footer className="tm-block">
					<Prompt command={`open ${project.url}`} />
					<Links project={project} className="tm-links" />
					<p className="tm-prompt">
						<span className="tm-user">hyeoniverse@devcourse</span>
						<span className="tm-path">~</span>
						<span className="tm-dollar">$</span> <span className="tm-cursor" aria-hidden="true" />
					</p>
				</footer>
			</div>
		</div>
	</div>
);

export default TerminalPage;
