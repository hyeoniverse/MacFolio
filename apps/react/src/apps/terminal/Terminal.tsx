import React, { useEffect, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { APP_MANIFEST, APP_NAMES } from '@/apps/manifest';
import { complete, formatDate, runCommand, toBlocks, type Block, type CommandContext, type Line } from './commands';
import { useOpenEffects } from './useOpenEffects';
import Shortcuts from './Shortcuts';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
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

/**
 * 창 제목의 "80×24"처럼 화면에 들어가는 열·행 수. 고정폭 글꼴의 글자 폭(0.6em)과 줄 높이로 계산한다.
 */
function useTerminalSize(ref: React.RefObject<HTMLDivElement | null>) {
	const [size, setSize] = useState({ cols: 80, rows: 24 });
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(() => {
			const style = getComputedStyle(element);
			const fontSize = parseFloat(style.fontSize);
			const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.3;
			const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
			setSize({
				cols: Math.max(1, Math.floor(width / (fontSize * 0.6))),
				rows: Math.max(1, Math.floor(height / lineHeight)),
			});
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return size;
}

/** 터미널: 명령어로 자기소개. 명령 처리는 commands.ts의 순수 함수가 한다. */
const DesktopTerminal: React.FC = () => {
	const { closeApp } = useAppState();
	const runOpenEffects = useOpenEffects();
	const [entries, setEntries] = useState<Entry[]>(() => [welcome()]);
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<string[]>([]);
	/** ↑↓로 고른 기록 위치 (null이면 새로 입력 중) */
	const [cursor, setCursor] = useState<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const screenRef = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);
	const size = useTerminalSize(screenRef);

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
		}
		runOpenEffects(effects);
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
		<AppWindow title={`guest — -zsh — ${size.cols}×${size.rows}`} appName="terminal">
			{/* 아무 곳이나 클릭하면 입력 칸으로 (글자를 드래그해 복사할 때는 제외) */}
			<div
				ref={screenRef}
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

/** 휴대폰에서는 명령어를 치는 대신 같은 명령을 눌러서 실행하는 '단축어'로 보여준다 */
const Terminal: React.FC = () => (useIsMobile() ? <Shortcuts /> : <DesktopTerminal />);

export default Terminal;
