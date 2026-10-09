import React, { useEffect, useMemo, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { requestOpen } from '@/shared/lib/openRequest';
import Button from '@/shared/ui/button/Button';
import { useExitMotion } from '@/shared/ui/motion/useExitMotion';
import { useCanEditMemo } from '@/apps/memo/admin';
import { REMOVED, type RemovedItem } from './removed';
import ServerFiles from './ServerFiles';
import { useServerFiles } from './useServerFiles';
import './Bin.css';

const COMMIT_URL = 'https://github.com/hyeoniverse/MacFolio/commit/';

const formatDate = (date: string) => {
	const [y, m, d] = date.split('-').map(Number);
	return `${y}. ${m}. ${d}.`;
};

const formatCount = (count: number) => count.toLocaleString('ko-KR');

/**
 * 휴지통: 이 사이트를 만들며 버린 기능을 모아 둔다. 고르면 무엇으로 바꿨는지, 언제·왜 바꿨는지,
 * 그 커밋에서 지운 코드와 바꾸기 전 모습이 나오고, 그 이야기를 쓴 개발 일지를 메모 앱에서 연다.
 * 관리자에게는 서버 파일도 보인다: 글에서 빼도 서버에 남는 이미지·첨부 중 쓰는 곳이 없는 것을 지운다
 */
const Bin: React.FC = () => {
	const { openApp } = useAppState();
	const admin = useCanEditMemo();
	const [section, setSection] = useState<'features' | 'files'>('features');
	const inFiles = section === 'files' && admin;
	const serverFiles = useServerFiles(admin);
	const removableCount = serverFiles.rows.filter((row) => row.usage.removable).length;
	const [selectedId, setSelectedId] = useState(REMOVED[0].id);
	const [preview, setPreview] = useState<RemovedItem | null>(null);
	// 최근에 버린 것이 위로
	const items = useMemo(() => [...REMOVED].sort((a, b) => b.date.localeCompare(a.date)), []);
	const selected = items.find((item) => item.id === selectedId) ?? items[0];

	const openPost = (slug: string) => {
		requestOpen('memo', slug);
		openApp('memo');
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		// 스페이스: 바꾸기 전 모습을 크게 (Finder의 훑어보기)
		if (event.key === ' ' && selected.before) {
			event.preventDefault();
			setPreview(preview ? null : selected);
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const index = items.indexOf(selected) + (event.key === 'ArrowDown' ? 1 : -1);
		const next = items[Math.min(items.length - 1, Math.max(0, index))];
		setSelectedId(next.id);
		document.getElementById(`bin-item-${next.id}`)?.scrollIntoView({ block: 'nearest' });
	};

	return (
		<AppWindow title="휴지통" appName="bin" chrome="unified">
			<div className="bin">
				<div className="bin-body">
					<nav className="bin-sidebar" aria-label="휴지통">
						<div className="bin-lights-space" />
						<h2>휴지통</h2>
						<button
							type="button"
							className={`bin-location${inFiles ? '' : ' active'}`}
							aria-current={inFiles ? undefined : 'page'}
							onClick={() => setSection('features')}
						>
							<i className="fa-solid fa-box-archive" aria-hidden="true" />
							<span>지운 기능</span>
							<span className="bin-location-count">{REMOVED.length}</span>
						</button>
						{admin && (
							<button
								type="button"
								className={`bin-location${inFiles ? ' active' : ''}`}
								aria-current={inFiles ? 'page' : undefined}
								onClick={() => setSection('files')}
							>
								<i className="fa-solid fa-server" aria-hidden="true" />
								<span>서버 파일</span>
								{removableCount > 0 && <span className="bin-location-count">{removableCount}</span>}
							</button>
						)}
					</nav>

					<div className="bin-main">
						<div className="bin-toolbar">
							<h1 className="bin-title">{inFiles ? '서버 파일' : '지운 기능'}</h1>
							<span className="bin-count">{inFiles ? serverFiles.rows.length : REMOVED.length}개의 항목</span>
						</div>
						{inFiles ? (
							<ServerFiles files={serverFiles} />
						) : (
							<div className="bin-features">
								<div
									className="bin-list"
									role="listbox"
									aria-label="지운 기능"
									aria-activedescendant={`bin-item-${selected.id}`}
									tabIndex={0}
									onKeyDown={onKeyDown}
								>
									{items.map((item) => (
										<div
											key={item.id}
											id={`bin-item-${item.id}`}
											role="option"
											aria-selected={item.id === selected.id}
											className={`bin-item${item.id === selected.id ? ' selected' : ''}`}
											onClick={() => setSelectedId(item.id)}
											onDoubleClick={() => item.post && openPost(item.post)}
										>
											<i className={`bin-item-icon ${item.icon}`} aria-hidden="true" />
											<span className="bin-item-name">{item.name}</span>
											<span className="bin-item-lines">−{formatCount(item.lines.deleted)}</span>
											<span className="bin-item-date">{formatDate(item.date)}</span>
										</div>
									))}
								</div>
								<FeatureInfo item={selected} onOpenPost={openPost} onPreview={() => setPreview(selected)} />
							</div>
						)}
					</div>
				</div>

				{preview?.before && <QuickLook item={preview} onClose={() => setPreview(null)} />}
			</div>
		</AppWindow>
	);
};

const FeatureInfo = ({
	item,
	onOpenPost,
	onPreview,
}: {
	item: RemovedItem;
	onOpenPost: (slug: string) => void;
	onPreview: () => void;
}) => (
	<section className="bin-info" aria-label={`${item.name} 정보`}>
		{item.before ? (
			<button type="button" className="bin-info-before" aria-label="바꾸기 전 모습 크게 보기" onClick={onPreview}>
				<img src={item.before.src} alt="" />
				<span>바꾸기 전</span>
			</button>
		) : (
			<i className={`bin-info-icon ${item.icon}`} aria-hidden="true" />
		)}
		<h2>{item.name}</h2>
		<dl>
			<dt>대신</dt>
			<dd>{item.replacedBy}</dd>
			<dt>바꾼 날</dt>
			<dd>{formatDate(item.date)}</dd>
			<dt>코드</dt>
			<dd>
				<span className="bin-deleted">−{formatCount(item.lines.deleted)}줄</span>{' '}
				<span className="bin-added">+{formatCount(item.lines.added)}줄</span>
			</dd>
			<dt>커밋</dt>
			<dd className="bin-commits">
				{item.commits.map((hash) => (
					<a key={hash} href={COMMIT_URL + hash} target="_blank" rel="noreferrer">
						{hash.slice(0, 7)}
					</a>
				))}
			</dd>
		</dl>
		<p>{item.why}</p>
		{item.post && (
			<Button icon="fa-regular fa-pen-to-square" onClick={() => onOpenPost(item.post!)}>
				개발 일지 읽기
			</Button>
		)}
	</section>
);

/** 바꾸기 전 모습을 창 가득 (Finder의 훑어보기처럼). Esc·바깥 누르기로 닫는다 */
const QuickLook = ({ item, onClose }: { item: RemovedItem; onClose: () => void }) => {
	const overlay = useExitMotion<HTMLDivElement>('fade-out');
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	return (
		<div
			ref={overlay}
			className="bin-quicklook"
			role="dialog"
			aria-label={`${item.name} 바꾸기 전 모습`}
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<figure>
				<img src={item.before!.src} alt={item.before!.caption} />
				<figcaption>{item.before!.caption}</figcaption>
			</figure>
			<button type="button" className="bin-quicklook-close" aria-label="닫기" onClick={onClose}>
				<i className="fa-solid fa-xmark" aria-hidden="true" />
			</button>
		</div>
	);
};

export default Bin;
