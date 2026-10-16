// devtool 템플릿(문서 사이트)의 작은 조각: 링크 단추, 복사되는 git clone 명령 상자, 폴더 구조 트리
import React, { useEffect, useRef, useState } from 'react';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import type { LandingLink } from '@/apps/safari/project/landing';
import type { TreeRow } from './code';

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
export const CommandBox: React.FC<{ command: string }> = ({ command }) => {
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
		<div className="dv-command">
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

/** 트리 한 줄의 아이콘 (폴더·파일) */
const TreeIcon: React.FC<{ row: TreeRow }> = ({ row }) => (
	<i
		className={row.folder ? 'fa-solid fa-folder dv-tree-folder' : 'fa-regular fa-file-lines dv-tree-file'}
		aria-hidden="true"
	/>
);

/** 폴더 구조를 들여쓴 줄로. note를 보이지 않으면 이름만 */
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
