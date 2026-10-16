// devtool 템플릿의 조각: 링크 단추, 복사되는 git clone 명령 줄, 첫 화면의 터미널 창(clone·설치·실행 명령과 짧은 출력, 저장소가 없으면 package.json),
// 코드 편집기 모양의 창(파일 트리와 대표 화면, 그림이 없으면 package.json 보기)
import React, { useEffect, useRef, useState } from 'react';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import { Media, type LandingHero, type LandingLink, type LandingPoint } from '@/apps/safari/project/landing';
import { packageEntries, parseTree, type JsonValue, type TreeRow } from './code';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 링크 묶음: 첫 링크는 글자색으로 꽉 찬 단추, 나머지는 테두리 단추. 공용 LandingLinks와 같은 차례와 표시(data-link·data-primary) */
export const DevLinks: React.FC<{ links: LandingLink[]; className?: string }> = ({ links, className }) => {
	const { openApp } = useAppState();
	if (links.length === 0) return null;
	return (
		<div className={['dv-links', className].filter(Boolean).join(' ')}>
			{links.map((link, index) => {
				const marks = {
					className: index === 0 ? 'dv-btn dv-btn-solid' : 'dv-btn',
					'data-link': link.kind,
					'data-primary': index === 0 ? '' : undefined,
				};
				return link.kind === 'app' ? (
					<button key={link.kind} type="button" {...marks} onClick={() => openApp(link.app as AppName)}>
						<i className="fa-solid fa-play" aria-hidden="true" />
						{link.label}
					</button>
				) : (
					<a key={link.kind} href={link.href} {...external} {...marks}>
						<i
							className={link.kind === 'repo' ? 'fa-brands fa-github' : 'fa-solid fa-arrow-up-right-from-square'}
							aria-hidden="true"
						/>
						{link.label}
					</a>
				);
			})}
		</div>
	);
};

/** 복사할 수 있는 명령 상자: 단추를 누르면 클립보드에 넣고 알림 줄에 결과를 적는다 */
export const CommandBox: React.FC<{ command: string; className?: string }> = ({ command, className }) => {
	const [status, setStatus] = useState('');
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setStatus('복사했습니다.');
		} catch {
			setStatus('복사하지 못했습니다. 명령을 직접 선택해 주세요.');
		}
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setStatus(''), 2400);
	};
	const copied = status === '복사했습니다.';
	return (
		<div className={['dv-command', className].filter(Boolean).join(' ')}>
			<span className="dv-command-prompt" aria-hidden="true">
				$
			</span>
			<code className="dv-command-text">{command}</code>
			<button
				type="button"
				className="dv-command-copy"
				onClick={copy}
				aria-label="명령 복사"
				data-copied={copied || undefined}
			>
				<i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} aria-hidden="true" />
			</button>
			<span className="dv-command-status" role="status">
				{status}
			</span>
		</div>
	);
};

/* ─── 편집기 창 ─── */

/** 트리 한 줄의 아이콘 (폴더·파일) */
const TreeIcon: React.FC<{ row: TreeRow }> = ({ row }) => (
	<i
		className={row.folder ? 'fa-solid fa-folder dv-tree-folder' : 'fa-regular fa-file-lines dv-tree-file'}
		aria-hidden="true"
	/>
);

/** 폴더 구조를 들여쓴 줄로 (편집기 탐색기와 기술 사양이 함께 쓴다). note를 보이지 않으면 이름만 */
export const Tree: React.FC<{ rows: TreeRow[]; notes?: boolean; className?: string }> = ({
	rows,
	notes = true,
	className,
}) => (
	<ul className={['dv-tree', className].filter(Boolean).join(' ')}>
		{rows.map((row, i) => (
			<li
				key={`${i}-${row.name}`}
				style={{ '--depth': row.depth } as React.CSSProperties}
				data-folder={row.folder || undefined}
			>
				{Array.from({ length: row.depth }, (_, d) => (
					<span key={d} className="dv-tree-guide" aria-hidden="true" />
				))}
				<TreeIcon row={row} />
				<span className="dv-tree-name">{row.name}</span>
				{notes && row.note && <span className="dv-tree-note">{row.note}</span>}
			</li>
		))}
	</ul>
);

/** package.json처럼 보이는 줄 (줄 번호, 키는 강조색, 글자 값은 문자열 색, 기호는 흐린 색) */
export const JsonView: React.FC<{ entries: [string, JsonValue][]; className?: string }> = ({ entries, className }) => {
	const lines: React.ReactNode[] = [<span className="dv-punct">{'{'}</span>];
	entries.forEach(([key, value], i) => {
		const comma = i < entries.length - 1 ? ',' : '';
		if (typeof value === 'string') {
			lines.push(
				<>
					{'  '}
					<span className="dv-key">&quot;{key}&quot;</span>
					<span className="dv-punct">: </span>
					<span className="dv-str">&quot;{value}&quot;</span>
					<span className="dv-punct">{comma}</span>
				</>
			);
			return;
		}
		if (!Array.isArray(value)) {
			lines.push(
				<>
					{'  '}
					<span className="dv-key">&quot;{key}&quot;</span>
					<span className="dv-punct">{': {'}</span>
				</>
			);
			value.entries.forEach(([name, text], j) =>
				lines.push(
					<>
						{'    '}
						<span className="dv-key dv-key-inner">&quot;{name}&quot;</span>
						<span className="dv-punct">: </span>
						<span className="dv-str">&quot;{text}&quot;</span>
						<span className="dv-punct">{j < value.entries.length - 1 ? ',' : ''}</span>
					</>
				)
			);
			lines.push(
				<>
					{'  '}
					<span className="dv-punct">
						{'}'}
						{comma}
					</span>
				</>
			);
			return;
		}
		lines.push(
			<>
				{'  '}
				<span className="dv-key">&quot;{key}&quot;</span>
				<span className="dv-punct">: [</span>
			</>
		);
		value.forEach((item, j) =>
			lines.push(
				<>
					{'    '}
					<span className="dv-str">&quot;{item}&quot;</span>
					<span className="dv-punct">{j < value.length - 1 ? ',' : ''}</span>
				</>
			)
		);
		lines.push(
			<>
				{'  '}
				<span className="dv-punct">]{comma}</span>
			</>
		);
	});
	lines.push(<span className="dv-punct">{'}'}</span>);
	return (
		<pre className={['dv-code', className].filter(Boolean).join(' ')}>
			{lines.map((line, i) => (
				<span key={i} className="dv-code-line">
					<span className="dv-ln" aria-hidden="true">
						{i + 1}
					</span>
					<span className="dv-code-text">{line}</span>
				</span>
			))}
		</pre>
	);
};

/** 편집기 창 (주요 기능 구역의 첫 그림): 탭 막대, 왼쪽 탐색기(폴더 구조가 있을 때), 가운데 대표 화면이나 package.json, 아래 상태 막대 */
export const Editor: React.FC<{
	hero: LandingHero;
	language?: string;
	stack: string[];
	features: LandingPoint[];
	structure?: string;
	repo?: string;
}> = ({ hero, language, stack, features, structure, repo }) => {
	const rows = structure ? parseTree(structure) : [];
	const json = packageEntries({ name: hero.name, description: hero.subhead, language, stack, features, repo });
	const tab = hero.image ? (hero.image.src.split('/').pop() ?? 'preview.png') : 'package.json';
	return (
		<figure className="dv-editor" data-reveal="" data-tree={rows.length ? '' : undefined}>
			<div className="dv-editor-bar" aria-hidden="true">
				<span className="dv-dots">
					<span />
					<span />
					<span />
				</span>
				<span className="dv-tab" data-active="">
					<i className={hero.image ? 'fa-regular fa-image' : 'fa-solid fa-code'} />
					{tab}
				</span>
				{hero.image && (
					<span className="dv-tab">
						<i className="fa-solid fa-code" />
						package.json
					</span>
				)}
			</div>
			<div className="dv-editor-body">
				{rows.length > 0 && (
					<div className="dv-explorer" aria-hidden="true">
						<p className="dv-explorer-label">탐색기</p>
						<Tree rows={rows} notes={false} />
					</div>
				)}
				<div className="dv-editor-main" data-image={hero.image ? '' : undefined}>
					{hero.image ? <Media media={hero.image} eager /> : <JsonView entries={json} />}
				</div>
			</div>
			<div className="dv-status" aria-hidden="true">
				<span>
					<i className="fa-solid fa-code-branch" />
					main
				</span>
				<span className="dv-status-ok">
					<i className="fa-solid fa-check" />
					빌드 통과
				</span>
				{language && <span className="dv-status-end">{language}</span>}
				{hero.meta.period && <span>{hero.meta.period}</span>}
			</div>
		</figure>
	);
};

/* ─── 첫 화면의 터미널 창 ─── */

/** 저장소 주소의 마지막 이름 (cd로 들어갈 폴더) */
const folderOf = (href: string) =>
	href
		.replace(/\/+$/, '')
		.split('/')
		.pop()
		?.replace(/\.git$/, '') || 'project';

/** 터미널의 명령 한 줄 (장식) */
const Line: React.FC<{ children: React.ReactNode; out?: boolean }> = ({ children, out }) => (
	<p className={out ? 'dv-term-out' : 'dv-term-line'}>
		{!out && (
			<span className="dv-command-prompt" aria-hidden="true">
				$
			</span>
		)}
		{children}
	</p>
);

/**
 * 첫 화면 가운데의 넓은 터미널 창. 저장소가 있으면 복사되는 git clone 명령과 폴더 이동·설치·실행 명령, 짧은 출력을 보이고,
 * 없으면 package.json을 연다. 아래 상태 막대에는 가지, 주 언어, 기간을 적는다
 */
export const HeroTerminal: React.FC<{
	command?: string;
	repo?: string;
	json: [string, JsonValue][];
	language?: string;
	period?: string;
}> = ({ command, repo, json, language, period }) => {
	const folder = repo ? folderOf(repo) : undefined;
	return (
		<figure className="dv-hero-term" data-reveal="">
			<div className="dv-terminal-bar" aria-hidden="true">
				<span className="dv-dots">
					<span />
					<span />
					<span />
				</span>
				<span>{folder ? `zsh — ~/${folder}` : 'zsh — package.json'}</span>
			</div>
			<div className="dv-term-body">
				{command && folder ? (
					<>
						<CommandBox command={command} className="dv-command-term" />
						<div aria-hidden="true">
							<Line>cd {folder}</Line>
							<Line>npm install</Line>
							<Line out>
								<i className="fa-solid fa-check" />
								의존성을 모두 설치했습니다.
							</Line>
							<Line>npm run dev</Line>
							<Line out>
								<i className="fa-solid fa-arrow-right" />
								개발 서버가 <span className="dv-term-url">http://localhost:5173</span>에서 실행 중입니다.
							</Line>
						</div>
					</>
				) : (
					<>
						<Line>cat package.json</Line>
						<JsonView entries={json} className="dv-term-json" />
					</>
				)}
			</div>
			<div className="dv-status" aria-hidden="true">
				<span>
					<i className="fa-solid fa-code-branch" />
					main
				</span>
				<span className="dv-status-ok">
					<i className="fa-solid fa-check" />
					빌드 통과
				</span>
				{language && <span className="dv-status-end">{language}</span>}
				{period && <span className={language ? undefined : 'dv-status-end'}>{period}</span>}
			</div>
		</figure>
	);
};
