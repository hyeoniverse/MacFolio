import { cssVars } from '@/shared/lib/cssVars';
import React, { useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { APP_MANIFEST, APP_NAMES } from '@/apps/manifest';
import { runCommand, toBlocks, type Block, type CommandContext } from './commands';
import { commandInValue, projectCommand, SHORTCUTS } from './shortcutList';
import { useOpenEffects } from './useOpenEffects';
import '@/apps/terminal/Shortcuts.css';

/** 단축어로 열 수 있는 앱 (터미널의 open과 같다) */
const OPENABLE_APPS = APP_NAMES.filter((name) => !['share', 'bin', 'terminal'].includes(name)).map((name) => ({
	name,
	label: APP_MANIFEST[name].label,
}));

/** "open messages" → "메시지" */
const appLabel = (command: string) => {
	const name = command.split(' ')[1];
	return OPENABLE_APPS.find((app) => app.name === name)?.label ?? name;
};

const context = (): CommandContext => ({ history: [], now: new Date(), apps: OPENABLE_APPS });

interface Page {
	title: string;
	command: string;
}

/** 명령 결과를 iOS 목록처럼 그린다 */
const ResultBlock: React.FC<{ block: Block; onRun: (page: Page) => void }> = ({ block, onRun }) => {
	const runOpenEffects = useOpenEffects();

	if (block.type === 'pairs') {
		return (
			<dl className="shortcut-group">
				{block.lines.map((line) => {
					const command = commandInValue(line.value);
					return (
						<div key={line.key} className="shortcut-row">
							<dt>{line.key}</dt>
							<dd>
								{line.href ? (
									<a href={line.href} target="_blank" rel="noopener noreferrer">
										{line.value}
									</a>
								) : command ? (
									// "open messages" 같은 값은 눌러서 바로 실행한다
									<button type="button" onClick={() => runOpenEffects(runCommand(command, context()).effects)}>
										{appLabel(command)} 열기
									</button>
								) : (
									line.value
								)}
							</dd>
						</div>
					);
				})}
			</dl>
		);
	}

	if (block.type === 'items') {
		return (
			<ul className="shortcut-group">
				{block.lines.map((line) => (
					<li key={line.marker}>
						<button
							type="button"
							className="shortcut-row shortcut-item"
							onClick={() => onRun({ title: line.title, command: projectCommand(line.marker) })}
						>
							<span>
								<strong>{line.title}</strong>
								{line.detail && <small>{line.detail}</small>}
							</span>
							{line.tag && <span className="shortcut-tag">{line.tag}</span>}
							<i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
						</button>
					</li>
				))}
			</ul>
		);
	}

	const { line } = block;
	if (line.kind === 'heading') return <h2 className="shortcut-heading">{line.text}</h2>;
	if (line.kind === 'link') {
		return (
			<a className="shortcut-group shortcut-row" href={line.href} target="_blank" rel="noopener noreferrer">
				{line.label}
			</a>
		);
	}
	// 터미널용 안내("project <번호>로 자세히 보기")는 누르는 화면에서는 필요 없다
	if (line.kind === 'muted') return null;
	if (line.kind === 'text' || line.kind === 'error') {
		return <p className={`shortcut-text ${line.kind}`}>{line.text}</p>;
	}
	return null;
};

/**
 * 모바일의 '단축어': 터미널 명령을 타일로 눌러서 실행한다.
 * 휴대폰 키보드로 명령어를 치지 않아도 같은 자기소개를 볼 수 있다.
 */
const Shortcuts: React.FC = () => {
	const runOpenEffects = useOpenEffects();
	// 누른 단축어를 쌓는다 (프로젝트 → 프로젝트 자세히)
	const [stack, setStack] = useState<Page[]>([]);
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();
	const page = stack.at(-1);

	const run = (next: Page) => {
		const { effects } = runCommand(next.command, context());
		runOpenEffects(effects);
		setNav('forward');
		setStack((prev) => [...prev, next]);
	};

	const pop = () => {
		setNav('back');
		setStack((prev) => prev.slice(0, -1));
	};

	return (
		<AppWindow title="단축어" appName="terminal">
			{/* 모바일 제목 막대의 뒤로 가기 (iOS처럼 화면마다 하나) */}
			<MobileNavigation
				{...(page ? { backLabel: stack.length > 1 ? stack[stack.length - 2].title : '단축어', onBack: pop } : {})}
			/>
			{/* 화면이 바뀔 때마다 새로 그려서 옆에서 들어오는 애니메이션이 돈다 */}
			<div key={stack.length} className="shortcuts" data-nav={nav}>
				{page ? (
					<section className="shortcut-result" aria-label={page.title}>
						<h1 className="phone-title">{page.title}</h1>
						<p className="shortcut-command">
							<span aria-hidden="true">$</span> {page.command}
						</p>
						{toBlocks(runCommand(page.command, context()).lines).map((block, index) => (
							<ResultBlock key={index} block={block} onRun={run} />
						))}
					</section>
				) : (
					<section aria-label="모든 단축어">
						<h1 className="phone-title">단축어</h1>
						<p className="shortcuts-intro">터미널 명령어를 눌러서 실행해 보세요.</p>
						<ul className="shortcut-grid">
							{SHORTCUTS.map((shortcut) => (
								<li key={shortcut.command}>
									<button
										type="button"
										className="shortcut-tile"
										style={cssVars({ from: shortcut.colors[0], to: shortcut.colors[1] })}
										onClick={() => run({ title: shortcut.title, command: shortcut.command })}
									>
										<i className={shortcut.icon} aria-hidden="true"></i>
										<span className="shortcut-tile-title">{shortcut.title}</span>
										<span className="shortcut-tile-command">{shortcut.command}</span>
									</button>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</AppWindow>
	);
};

export default Shortcuts;
