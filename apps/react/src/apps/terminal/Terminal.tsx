import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { APP_MANIFEST, APP_NAMES } from '@/apps/manifest';
import { complete, formatDate, runCommand, type CommandContext, type Line } from './commands';
import '@/apps/terminal/Terminal.css';

interface Entry {
	id: number;
	/** 입력한 명령 (안내 문구처럼 입력 없이 출력만 있는 줄은 null) */
	input: string | null;
	lines: Line[];
}

/** open 명령으로 열 수 있는 앱 (공유·휴지통·터미널 자신 제외) */
const OPENABLE_APPS = APP_NAMES.filter((name) => !['share', 'bin', 'terminal'].includes(name)).map((name) => ({
	name,
	label: APP_MANIFEST[name].label,
}));

const welcome = (): Entry => ({
	id: 0,
	input: null,
	lines: [
		{ kind: 'muted', text: `Last login: ${formatDate(new Date())} on ttys000` },
		{ kind: 'text', text: '안녕하세요! help를 입력하면 사용할 수 있는 명령어를 볼 수 있어요.' },
	],
});

/** zsh 테마처럼 색을 나눈 프롬프트: 사용자@호스트(초록) 경로(파랑) % */
const Prompt: React.FC = () => (
	<span className="terminal-prompt" aria-hidden="true">
		<span className="terminal-prompt-user">guest@macfolio</span> <span className="terminal-prompt-path">~</span> %
	</span>
);

const Value: React.FC<{ value: string; href?: string }> = ({ value, href }) =>
	href ? (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{value}
		</a>
	) : (
		<>{value}</>
	);

type Block =
	| { type: 'pairs'; lines: Extract<Line, { kind: 'pair' }>[] }
	| { type: 'items'; lines: Extract<Line, { kind: 'item' }>[] }
	| { type: 'line'; line: Line };

/** 연속된 pair·item 줄을 묶는다. 한 묶음은 한 격자로 그려서 칸이 맞는다 */
function toBlocks(lines: Line[]): Block[] {
	const blocks: Block[] = [];
	for (const line of lines) {
		const last = blocks.at(-1);
		if (line.kind === 'pair') {
			if (last?.type === 'pairs') last.lines.push(line);
			else blocks.push({ type: 'pairs', lines: [line] });
		} else if (line.kind === 'item') {
			if (last?.type === 'items') last.lines.push(line);
			else blocks.push({ type: 'items', lines: [line] });
		} else blocks.push({ type: 'line', line });
	}
	return blocks;
}

const BlockView: React.FC<{ block: Block }> = ({ block }) => {
	if (block.type === 'pairs') {
		return (
			<dl className="terminal-pairs">
				{block.lines.map((line) => (
					<React.Fragment key={line.key}>
						<dt>{line.key}</dt>
						<dd>
							<Value value={line.value} href={line.href} />
						</dd>
					</React.Fragment>
				))}
			</dl>
		);
	}
	if (block.type === 'items') {
		return (
			<ol className="terminal-items">
				{block.lines.map((line) => (
					<li key={line.marker}>
						<span className="terminal-item-marker">{line.marker}</span>
						<span>
							<span className="terminal-item-title">{line.title}</span>
							{line.tag && <span className="terminal-item-tag">{line.tag}</span>}
							{line.detail && <span className="terminal-item-detail">{line.detail}</span>}
						</span>
					</li>
				))}
			</ol>
		);
	}
	const { line } = block;
	if (line.kind === 'link') {
		return (
			<a className="terminal-line link" href={line.href} target="_blank" rel="noopener noreferrer">
				{line.label}
			</a>
		);
	}
	if (line.kind === 'pair' || line.kind === 'item') return null;
	return <div className={`terminal-line ${line.kind}`}>{line.text || '\u00a0'}</div>;
};

/** 터미널: 명령어로 자기소개. 명령 처리는 commands.ts의 순수 함수가 한다. */
const Terminal: React.FC = () => {
	const { openApp, bringAppToFront, closeApp } = useAppState();
	const [entries, setEntries] = useState<Entry[]>(() => [welcome()]);
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<string[]>([]);
	/** ↑↓로 고른 기록 위치 (null이면 새로 입력 중) */
	const [cursor, setCursor] = useState<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: 'end' });
	}, [entries]);

	const context = (): CommandContext => ({ history, now: new Date(), apps: OPENABLE_APPS });
	const append = (entry: Omit<Entry, 'id'>) => setEntries((prev) => [...prev, { ...entry, id: nextId.current++ }]);

	const submit = () => {
		const { lines, effects } = runCommand(input, context());
		append({ input, lines });
		if (input.trim()) setHistory((prev) => [...prev, input.trim()]);
		setInput('');
		setCursor(null);

		for (const effect of effects) {
			if (effect.type === 'clear') setEntries([]);
			if (effect.type === 'close') closeApp('terminal');
			if (effect.type === 'open-url') window.open(effect.url, '_blank', 'noopener');
			if (effect.type === 'open-app') {
				const action = APP_MANIFEST[effect.app].action;
				if (action?.type === 'link') window.open(action.url, '_blank', 'noopener');
				else {
					openApp(effect.app);
					bringAppToFront(effect.app);
				}
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;

		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		} else if (event.key === 'Tab') {
			event.preventDefault();
			const { value, candidates } = complete(input, context());
			setInput(value);
			if (candidates.length > 1) append({ input, lines: [{ kind: 'text', text: candidates.join('   ') }] });
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			if (history.length === 0) return;
			event.preventDefault();
			const next =
				event.key === 'ArrowUp'
					? Math.max(0, (cursor ?? history.length) - 1)
					: cursor === null || cursor + 1 >= history.length
						? null
						: cursor + 1;
			setCursor(next);
			setInput(next === null ? '' : history[next]);
		} else if (event.key === 'c' && event.ctrlKey) {
			// Ctrl+C: 입력 취소
			event.preventDefault();
			append({ input: `${input}^C`, lines: [] });
			setInput('');
			setCursor(null);
		} else if (event.key === 'l' && event.ctrlKey) {
			// Ctrl+L: 화면 지우기
			event.preventDefault();
			setEntries([]);
		}
	};

	return (
		<AppWindow title="guest — zsh" appName="terminal">
			{/* 아무 곳이나 클릭하면 입력 칸으로 (글자를 드래그해 복사할 때는 제외) */}
			<div
				className="terminal"
				onClick={() => {
					if (!window.getSelection()?.toString()) inputRef.current?.focus();
				}}
			>
				<div className="terminal-output" role="log" aria-live="polite" aria-label="터미널 출력">
					{entries.map((entry) => (
						<div key={entry.id} className="terminal-entry">
							{entry.input !== null && (
								<div className="terminal-line terminal-command">
									<Prompt /> <span className="terminal-input-text">{entry.input}</span>
								</div>
							)}
							{entry.lines.length > 0 && (
								<div className="terminal-result">
									{toBlocks(entry.lines).map((block, index) => (
										<BlockView key={index} block={block} />
									))}
								</div>
							)}
						</div>
					))}
				</div>
				<label className="terminal-input-line">
					<Prompt />
					<input
						ref={inputRef}
						aria-label="명령어 입력"
						value={input}
						spellCheck={false}
						autoCapitalize="off"
						autoComplete="off"
						autoFocus
						onChange={(event) => {
							setInput(event.target.value);
							setCursor(null);
						}}
						onKeyDown={handleKeyDown}
					/>
				</label>
				<div ref={endRef} />
			</div>
		</AppWindow>
	);
};

export default Terminal;
