// 메일함 모양(inbox): 프로젝트 소개를 메일 클라이언트 3단(메일함 → 메일 목록 → 본문)으로 읽는다
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Facts, Favicon, Links, Region } from '@/apps/safari/project/parts';
import { FeatureMedia } from '@/apps/safari/project/CreativeParts';
import { Shots } from '@/apps/safari/project/CreativeChapters';
import { Demo } from '@/apps/safari/project/creative/Demo';
import '@/apps/safari/project/InboxPage.css';

/** 메일 한 통: 어느 메일함에 들었고, 누가 보냈고, 제목·미리 보기·시각. 본문은 kind에 따라 다르게 그린다 */
interface Mail {
	id: string;
	box: string;
	from: string;
	subject: string;
	preview: string;
	stamp: string;
	/** 검색이 뒤지는 글 (제목 + 본문) */
	text: string;
	kind: 'intro' | 'point' | 'timeline' | 'gallery' | 'specs' | 'contrib';
	point?: ProjectPoint;
}

interface Box {
	id: string;
	label: string;
	icon: string;
}

const INBOX = 'all';

/** 아침 8시부터 몇 분씩 늦게 도착한 것처럼 보이는 시각 */
const stampAt = (n: number) => {
	const minutes = 8 * 60 + n * 7;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h < 12 ? '오전' : '오후'} ${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}`;
};

/** 프로젝트를 메일함과 메일 목록으로 바꾼다. 없는 필드의 메일함은 통째로 빠진다 */
function buildMail(project: Project): { boxes: Box[]; mails: Mail[] } {
	const boxes: Box[] = [{ id: INBOX, label: '받은 편지함', icon: 'fa-inbox' }];
	const mails: Mail[] = [];
	const from = project.name;

	const addBox = (box: Box, items: Omit<Mail, 'id' | 'box' | 'stamp'>[]) => {
		if (items.length === 0) return;
		boxes.push(box);
		items.forEach((item, index) =>
			mails.push({ ...item, id: `${box.id}-${index}`, box: box.id, stamp: stampAt(mails.length) })
		);
	};
	const pointMails = (points: ProjectPoint[]) =>
		points.map((point) => ({
			from,
			subject: point.title,
			preview: point.body,
			text: `${point.title} ${point.body} ${point.detail ?? ''}`,
			kind: 'point' as const,
			point,
		}));

	addBox({ id: 'intro', label: '소개', icon: 'fa-envelope-open-text' }, [
		{
			from,
			subject: project.tagline || project.name,
			preview: project.description,
			text: `${project.tagline} ${project.description} ${project.context} ${project.role ?? ''}`,
			kind: 'intro',
		},
	]);
	addBox({ id: 'highlights', label: '주요 기능', icon: 'fa-star' }, pointMails(project.highlights));
	addBox({ id: 'build', label: '만든 방식', icon: 'fa-screwdriver-wrench' }, pointMails(project.build));
	project.chapters?.forEach((chapter, index) =>
		addBox({ id: `chapter-${index}`, label: chapter.title, icon: 'fa-book-open' }, pointMails(chapter.points))
	);
	addBox({ id: 'usage', label: '쓰는 법', icon: 'fa-hand-pointer' }, pointMails(project.usage ?? []));
	// 진행 과정: 보낸 이가 날짜. 날짜순으로 둔다
	addBox(
		{ id: 'timeline', label: '진행 과정', icon: 'fa-calendar-days' },
		(project.timeline ?? []).map((entry) => ({
			from: entry.date,
			subject: entry.label,
			preview: `${entry.date} · ${project.name}`,
			text: `${entry.date} ${entry.label}`,
			kind: 'timeline' as const,
		}))
	);
	addBox(
		{ id: 'gallery', label: '화면 모음', icon: 'fa-images' },
		(project.gallery?.length ?? 0) > 0
			? [
					{
						from,
						subject: '화면 모음',
						preview: project.gallery!.map((shot) => shot.caption).join(', '),
						text: `화면 모음 ${project.gallery!.map((shot) => shot.caption).join(' ')}`,
						kind: 'gallery' as const,
					},
				]
			: []
	);
	addBox(
		{ id: 'specs', label: '기술 사양', icon: 'fa-microchip' },
		project.specs.length > 0
			? [
					{
						from,
						subject: '기술 사양',
						preview: project.stack.join(' · ') || project.specs.map((spec) => spec.value).join(' · '),
						text: `기술 사양 ${project.specs.map((spec) => `${spec.label} ${spec.value}`).join(' ')}`,
						kind: 'specs' as const,
					},
				]
			: []
	);
	addBox(
		{ id: 'contrib', label: '맡은 일', icon: 'fa-user-check' },
		project.contributions.length > 0
			? [
					{
						from,
						subject: '맡은 일',
						preview: project.contributions.join(', '),
						text: `맡은 일 ${project.contributions.join(' ')}`,
						kind: 'contrib' as const,
					},
				]
			: []
	);
	return { boxes, mails };
}

/** 메일 본문: 종류에 따라 소개·글 묶음(데모·그림 포함)·진행 과정·화면 모음·사양·맡은 일 */
const Body: React.FC<{ mail: Mail; project: Project }> = ({ mail, project }) => {
	switch (mail.kind) {
		case 'intro':
			return (
				<>
					<p className="ib-lead">{project.description}</p>
					<p className="ib-dim">{[project.context, project.role, project.period].filter(Boolean).join(' · ')}</p>
					{project.facts.length > 0 && <Facts project={project} className="ib-facts" />}
					{project.image && (
						<figure className="ib-attach">
							<img src={project.image} alt={`${project.name} 화면`} loading="lazy" />
						</figure>
					)}
					<Links project={project} className="sp-links ib-links" />
				</>
			);
		case 'point': {
			const point = mail.point!;
			return (
				<>
					<p className="ib-lead">{point.body}</p>
					{point.detail && <p>{point.detail}</p>}
					{point.demo ? (
						<div className="ib-demo" data-demo={point.demo}>
							<Demo kind={point.demo} />
							{point.shots && <Shots shots={point.shots} />}
						</div>
					) : point.shots ? (
						<div className="ib-demo">
							<Shots shots={point.shots} />
						</div>
					) : (
						<div className="ib-attach">
							<FeatureMedia point={point} />
						</div>
					)}
				</>
			);
		}
		case 'timeline':
			return <p className="ib-lead">{mail.from}에 한 일입니다.</p>;
		case 'gallery':
			return (
				<ul className="ib-gallery">
					{project.gallery!.map((shot) => (
						<li key={shot.src}>
							<img src={shot.src} alt={shot.caption} loading="lazy" />
							<span>{shot.caption}</span>
						</li>
					))}
				</ul>
			);
		case 'specs':
			return (
				<dl className="ib-specs">
					{project.specs.map((spec) => (
						<div key={spec.label}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			);
		case 'contrib':
			return (
				<ul className="ib-checks">
					{project.contributions.map((item) => (
						<li key={item}>
							<i className="fa-solid fa-check" aria-hidden="true" />
							{item}
						</li>
					))}
				</ul>
			);
	}
};

/**
 * 메일함 3단: 왼쪽 메일함 목록(안 읽은 수 뱃지), 가운데 메일 목록(검색으로 거르기, ↑↓로 이동),
 * 오른쪽 본문(누르면 밀려 들어오고 읽음 처리). 좁은 창은 목록 ↔ 본문을 번갈아 보인다
 */
const InboxPage: React.FC<{ project: Project }> = ({ project }) => {
	const { boxes, mails } = useMemo(() => buildMail(project), [project]);
	const [box, setBox] = useState(INBOX);
	const [query, setQuery] = useState('');
	const [openId, setOpenId] = useState<string | null>(mails[0]?.id ?? null);
	const [read, setRead] = useState<Set<string>>(() => new Set(mails[0] ? [mails[0].id] : []));
	// 좁은 창에서 보이는 단 (넓은 창은 둘 다 보여서 뜻이 없다)
	const [pane, setPane] = useState<'list' | 'read'>('read');
	const listRef = useRef<HTMLUListElement>(null);

	const visible = useMemo(() => {
		const words = query.trim().toLowerCase();
		return mails.filter(
			(mail) => (box === INBOX || mail.box === box) && (!words || mail.text.toLowerCase().includes(words))
		);
	}, [mails, box, query]);
	const open = mails.find((mail) => mail.id === openId) ?? null;
	const unread = (id: string) => mails.filter((mail) => (id === INBOX || mail.box === id) && !read.has(mail.id)).length;

	const openMail = (id: string) => {
		setOpenId(id);
		setPane('read');
		setRead((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
	};

	// ↑↓: 보이는 목록에서 앞뒤 메일로
	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		if (visible.length === 0) return;
		event.preventDefault();
		const at = visible.findIndex((mail) => mail.id === openId);
		const next = Math.min(visible.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)));
		openMail(visible[next].id);
	};

	// 열린 메일이 목록 밖으로 밀리지 않게 따라간다
	useEffect(() => {
		listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
	}, [openId]);

	const subscribe = project.demo ?? project.url;

	return (
		<div className="ib" data-pane={pane} onKeyDown={onKeyDown}>
			<div className="ib-toolbar">
				<div className="ib-lights" aria-hidden="true">
					<i />
					<i />
					<i />
				</div>
				<div className="ib-title">
					<Favicon project={project} className="ib-title-icon" />
					<span>{project.name}</span>
					<em>{unread(INBOX) > 0 ? `안 읽음 ${unread(INBOX)}` : '모두 읽음'}</em>
				</div>
				<label className="ib-search">
					<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
					<input
						type="search"
						placeholder="검색"
						aria-label="메일 검색"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</label>
				<a className="ib-subscribe" href={subscribe} target="_blank" rel="noopener noreferrer">
					<i className={`fa-solid ${project.demo ? 'fa-paper-plane' : 'fa-code-branch'}`} aria-hidden="true" />
					{project.demo ? '구독하기' : 'GitHub'}
				</a>
			</div>

			<div className="ib-panes">
				<nav className="ib-boxes" aria-label="메일함">
					<ul>
						{boxes.map((item) => {
							const count = unread(item.id);
							return (
								<li key={item.id}>
									<button
										type="button"
										aria-pressed={box === item.id}
										onClick={() => {
											setBox(item.id);
											setPane('list');
										}}
									>
										<i className={`fa-solid ${item.icon}`} aria-hidden="true" />
										<span>{item.label}</span>
										{count > 0 && (
											<span className="ib-badge" key={count} aria-label={`안 읽음 ${count}`}>
												{count}
											</span>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				</nav>

				<Region label="메일 목록" className="ib-list-pane">
					<header>
						<h2>{boxes.find((item) => item.id === box)?.label}</h2>
						<span>{visible.length}통</span>
					</header>
					<ul ref={listRef} className="ib-list">
						{visible.map((mail) => (
							<li key={mail.id}>
								<button
									type="button"
									className="ib-mail"
									aria-current={mail.id === openId ? 'true' : undefined}
									data-unread={read.has(mail.id) ? undefined : ''}
									onClick={() => openMail(mail.id)}
								>
									<span className="ib-dot" aria-hidden="true" />
									<span className="ib-mail-head">
										<span className="ib-from">{mail.from}</span>
										<time>{mail.kind === 'timeline' ? mail.from : mail.stamp}</time>
									</span>
									<strong>{mail.subject}</strong>
									<span className="ib-preview">{mail.preview}</span>
								</button>
							</li>
						))}
						{visible.length === 0 && <li className="ib-empty">찾는 메일이 없습니다</li>}
					</ul>
				</Region>

				<Region label="본문" className="ib-read-pane">
					{open ? (
						<article key={open.id} className="ib-read">
							<button type="button" className="ib-back" onClick={() => setPane('list')}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 목록
							</button>
							<h1>{open.subject}</h1>
							<div className="ib-sender">
								<Favicon project={project} className="ib-avatar" />
								<div>
									<strong>{open.from}</strong>
									<span>받는 사람: 나 · {open.kind === 'timeline' ? open.from : open.stamp}</span>
								</div>
							</div>
							<div className="ib-body">
								<Body mail={open} project={project} />
							</div>
							<div className="ib-actions" aria-hidden="true">
								<span>
									<i className="fa-solid fa-reply" /> 답장
								</span>
								<span>
									<i className="fa-solid fa-share" /> 전달
								</span>
							</div>
						</article>
					) : (
						<p className="ib-none">메일을 고르면 여기에 보입니다</p>
					)}
				</Region>
			</div>
		</div>
	);
};

export default InboxPage;
