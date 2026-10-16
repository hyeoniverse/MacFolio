// paper 템플릿: Notion 워크스페이스의 한 페이지처럼. 왼쪽에 고정된 사이드바(워크스페이스 이름, 장식 메뉴, 구역마다 하위 페이지가 달린
// 페이지 트리)와 오른쪽의 문서 한 장(이동 경로 막대, 표지, 걸친 페이지 아이콘, 제목, 속성 표)으로 연다. 구역은 Notion 블록으로 읽힌다:
// 긴 구역은 접힌 토글, 기능은 갤러리 보기, 팀원·배포·진행 과정은 보기(표·보드·갤러리)를 바꾸는 데이터베이스다.
// 사이드바의 하위 페이지를 누르면 그 구역으로 내려가며 토글을 펼친다. 좁은 창에서는 사이드바가 ☰ 단추 뒤로 접힌다. 계약은 templates/README.md
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, scrollParent } from '@/apps/safari/project/scroll';
import {
	FaIcon,
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	MemberAvatar,
	shortLink,
	troubleIcon,
	troubleSteps,
	useLanding,
	useLandingAccent,
	type LandingDeployment,
	type LandingMember,
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { paperAccent } from './accent';
import './Page.css';

/** Notion 태그의 차분한 색 */
const TONES = ['blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'brown', 'red'] as const;
type Tone = (typeof TONES)[number] | 'gray';

/** 같은 이름은 언제나 같은 색 */
const toneOf = (text: string): Tone => {
	let hash = 0;
	for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return TONES[hash % TONES.length];
};

/** 구역마다 하위 페이지의 이모지와 문서 제목 (구역 이름은 aria-label로 그대로 남는다) */
const PAGES: Record<LandingSectionKind, { emoji: string; title: string }> = {
	stats: { emoji: '📊', title: '한눈에 보기' },
	features: { emoji: '✨', title: '주요 기능' },
	screens: { emoji: '🖼️', title: '화면 모음' },
	steps: { emoji: '🧭', title: '시작하는 법' },
	built: { emoji: '🛠️', title: '구현 노트' },
	troubleshooting: { emoji: '🐞', title: '트러블슈팅 기록' },
	stories: { emoji: '📖', title: '더 들려줄 이야기' },
	controls: { emoji: '⌨️', title: '단축키' },
	tech: { emoji: '🧰', title: '기술 스택' },
	team: { emoji: '👥', title: '팀' },
	role: { emoji: '🙋', title: '내가 맡은 일' },
	timeline: { emoji: '🗓️', title: '일정' },
	deployments: { emoji: '🚀', title: '배포' },
	credits: { emoji: '📎', title: '참고 자료와 출처' },
};

const Emoji: React.FC<{ children: string; className?: string }> = ({ children, className = 'pp-emoji' }) => (
	<span className={className} aria-hidden="true">
		{children}
	</span>
);

/** 구역 머리: 이모지 달린 문서 제목(h2)과, 있으면 오른쪽 작은 단추 */
const Head: React.FC<{ section: LandingSection; action?: React.ReactNode }> = ({ section, action }) => (
	<header className="pp-head">
		<h2 id={`pp-${section.kind}`} tabIndex={-1}>
			<Emoji>{PAGES[section.kind].emoji}</Emoji>
			{PAGES[section.kind].title}
		</h2>
		{action}
	</header>
);

const Tag: React.FC<{ children: string; tone?: Tone }> = ({ children, tone }) => (
	<span className="pp-tag" data-tone={tone ?? toneOf(children)}>
		{children}
	</span>
);

/** 쉼표로 이어 쓴 값을 태그 여러 개로 (글로는 원래 문장 그대로 읽힌다) */
const Tags: React.FC<{ value: string }> = ({ value }) => {
	const parts = value
		.split(/\s*,\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
	return (
		<span className="pp-tagrow">
			{parts.map((part, index) => (
				<React.Fragment key={`${part}-${index}`}>
					{index > 0 && <span className="pp-sep">, </span>}
					<Tag>{part}</Tag>
				</React.Fragment>
			))}
		</span>
	);
};

/** 표 머리 칸: Notion 속성 아이콘과 이름 */
const Th: React.FC<{ icon?: string; children: string }> = ({ icon, children }) => (
	<th scope="col">
		{icon ? (
			<i className={icon} aria-hidden="true" />
		) : (
			<span className="pp-aa" aria-hidden="true">
				Aa
			</span>
		)}
		{children}
	</th>
);

/** 숫자 묶음: 나란한 단(column) 블록 */
const FactColumns: React.FC<{ facts: ProjectFact[] }> = ({ facts }) => (
	<dl className="pp-facts" data-count={Math.min(facts.length, 4)}>
		{facts.map((fact) => (
			<div key={fact.label}>
				<dt>{fact.label}</dt>
				<dd>{fact.value}</dd>
			</div>
		))}
	</dl>
);

/** 항목의 그림·영상 (문서 안의 그림 블록) */
const PointMedia: React.FC<{ point: LandingPoint; from?: number }> = ({ point, from = 0 }) => {
	const media = point.media.slice(from);
	return media.length > 0 ? (
		<div className="pp-media" data-count={Math.min(media.length, 3)}>
			{media.map((item) => (
				<Media key={item.src} media={item} />
			))}
		</div>
	) : null;
};

/* ─── 토글 ─── */

/**
 * 토글 묶음: 안의 토글(.pp-tgl)을 지켜보며 '모두 펼치기'·'모두 접기' 단추를 단다.
 * toggle 이벤트는 거품이 일지 않아 붙잡는 단계(capture)에서 듣는다
 */
const ToggleGroup: React.FC<{ section: LandingSection; children: React.ReactNode }> = ({ section, children }) => {
	const box = useRef<HTMLDivElement>(null);
	const [allOpen, setAllOpen] = useState(false);
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const update = () => {
			const toggles = [...el.querySelectorAll<HTMLDetailsElement>('details.pp-tgl')];
			setAllOpen(toggles.length > 0 && toggles.every((toggle) => toggle.open));
		};
		el.addEventListener('toggle', update, true);
		return () => el.removeEventListener('toggle', update, true);
	}, []);
	const flip = () =>
		box.current?.querySelectorAll<HTMLDetailsElement>('details.pp-tgl').forEach((toggle) => {
			toggle.open = !allOpen;
		});
	return (
		<>
			<Head
				section={section}
				action={
					<button type="button" className="pp-head-btn" onClick={flip}>
						<i className={allOpen ? 'fa-solid fa-angles-up' : 'fa-solid fa-angles-down'} aria-hidden="true" />
						{allOpen ? '모두 접기' : '모두 펼치기'}
					</button>
				}
			/>
			<div ref={box} className="pp-toggles">
				{children}
			</div>
		</>
	);
};

/** 토글 한 줄: 제목(h3)만 보이고, 누르면 안의 블록이 펼쳐진다 */
const Toggle: React.FC<{ title: string; icon?: string; meta?: React.ReactNode; children: React.ReactNode }> = ({
	title,
	icon,
	meta,
	children,
}) => (
	<details className="pp-tgl">
		<summary>
			<span className="pp-tgl-arrow" aria-hidden="true" />
			{icon && <i className={`fa-solid ${icon} pp-tgl-icon`} aria-hidden="true" />}
			<h3>{title}</h3>
			{meta}
		</summary>
		<div className="pp-tgl-body">{children}</div>
	</details>
);

/* ─── 데이터베이스 ─── */

interface View {
	id: string;
	label: string;
	icon: string;
	render: () => React.ReactNode;
}

/** 인라인 데이터베이스: 보기 단추(표·보드·갤러리)와 장식 도구 막대, 고른 보기 하나 */
const Database: React.FC<{ name: string; views: View[]; count: number }> = ({ name, views, count }) => {
	const [current, setCurrent] = useState(views[0].id);
	const view = views.find((item) => item.id === current) ?? views[0];
	return (
		<div className="pp-db" data-view={view.id}>
			<div className="pp-db-bar">
				<div className="pp-views" role="group" aria-label={`${name} 보기`}>
					{views.map((item) => (
						<button
							key={item.id}
							type="button"
							className="pp-view-btn"
							aria-pressed={item.id === view.id}
							onClick={() => setCurrent(item.id)}
						>
							<i className={item.icon} aria-hidden="true" />
							{item.label}
						</button>
					))}
				</div>
				<div className="pp-db-tools" aria-hidden="true">
					<span>필터</span>
					<span>정렬</span>
					<i className="fa-solid fa-magnifying-glass" />
					<span className="pp-db-new">새로 만들기</span>
				</div>
			</div>
			<div className="pp-db-view">{view.render()}</div>
			<p className="pp-db-count" aria-hidden="true">
				개수 {count}
			</p>
		</div>
	);
};

const TABLE: Omit<View, 'render'> = { id: 'table', label: '표', icon: 'fa-solid fa-table' };
const BOARD: Omit<View, 'render'> = { id: 'board', label: '보드', icon: 'fa-solid fa-table-columns' };
const GALLERY: Omit<View, 'render'> = { id: 'gallery', label: '갤러리', icon: 'fa-solid fa-table-cells-large' };

/** 보드 보기: 묶음마다 한 열, 열 머리는 태그와 개수 */
function Board<T>({
	items,
	groupOf,
	keyOf,
	card,
}: {
	items: T[];
	groupOf: (item: T) => string;
	keyOf: (item: T) => string;
	card: (item: T) => React.ReactNode;
}) {
	const groups = new Map<string, T[]>();
	for (const item of items) groups.set(groupOf(item), [...(groups.get(groupOf(item)) ?? []), item]);
	return (
		<div className="pp-board">
			{[...groups].map(([group, list]) => (
				<div key={group} className="pp-board-col">
					<p className="pp-board-head">
						<Tag>{group}</Tag>
						<span className="pp-board-count">{list.length}</span>
					</p>
					<ul>
						{list.map((item) => (
							<li key={keyOf(item)} className="pp-board-card">
								{card(item)}
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}

/** 역할의 첫 낱말 (프론트엔드 리드, 모임 일정… → 프론트엔드): 팀원 보드의 묶음 */
const roleGroup = (role: string) => role.split(/[,\s]/)[0] || '팀원';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const MemberName: React.FC<{ member: LandingMember }> = ({ member }) => (
	<span className="pp-person">
		<MemberAvatar member={member} className="pp-avatar" />
		<strong>{member.name}</strong>
		{member.me && <Tag tone="blue">나</Tag>}
	</span>
);

const MemberLink: React.FC<{ member: LandingMember }> = ({ member }) =>
	member.url ? (
		<a className="pp-link" href={member.url} title={member.url} {...external}>
			{shortLink(member.url)}
		</a>
	) : null;

const TeamTable: React.FC<{ members: LandingMember[] }> = ({ members }) => (
	<div className="pp-table-scroll">
		<table className="pp-table">
			<thead>
				<tr>
					<Th>이름</Th>
					<Th icon="fa-solid fa-list-ul">역할</Th>
					<Th icon="fa-solid fa-link">링크</Th>
				</tr>
			</thead>
			<tbody>
				{members.map((member) => (
					<tr key={member.name}>
						<td>
							<MemberName member={member} />
						</td>
						<td>{member.role}</td>
						<td>
							<MemberLink member={member} />
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

const DeployName: React.FC<{ item: LandingDeployment }> = ({ item }) => (
	<span className="pp-deploy-name">
		<FaIcon icon={item.icon} className="pp-deploy-icon" />
		{item.url ? (
			<a className="pp-link" href={item.url} {...external}>
				{item.label}
			</a>
		) : (
			<strong>{item.label}</strong>
		)}
	</span>
);

const DeployTable: React.FC<{ items: LandingDeployment[] }> = ({ items }) => {
	const images = items.some((item) => item.image);
	return (
		<div className="pp-table-scroll">
			<table className="pp-table">
				<thead>
					<tr>
						<Th>이름</Th>
						<Th icon="fa-regular fa-circle-dot">플랫폼</Th>
						<Th icon="fa-solid fa-link">주소</Th>
						<Th icon="fa-solid fa-align-left">설명</Th>
						{images && <Th icon="fa-solid fa-paperclip">미리 보기</Th>}
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.label}>
							<td>
								<DeployName item={item} />
							</td>
							<td>{item.platform && <Tag>{item.platform}</Tag>}</td>
							<td className="pp-muted-cell">{item.host}</td>
							<td>{item.note}</td>
							{images && <td className="pp-thumb">{item.image && <Media media={item.image} />}</td>}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

/* ─── 구역 ─── */

/** 트러블슈팅 단계마다 알림 상자의 색과 이모지 */
const STEP_TONES = { problem: 'red', cause: 'orange', solution: 'blue', result: 'green' } as const;
const STEP_EMOJI = { problem: '🚨', cause: '🔍', solution: '🔧', result: '✅' } as const;

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<Head section={section} />
			<FactColumns facts={section.facts} />
		</>
	),
	features: ({ section }) => (
		<>
			<Head section={section} />
			<div className="pp-db">
				<div className="pp-db-bar">
					<p className="pp-views-static">
						<i className={GALLERY.icon} aria-hidden="true" />
						갤러리 보기
					</p>
					<div className="pp-db-tools" aria-hidden="true">
						<span>필터</span>
						<span>정렬</span>
						<span className="pp-db-new">새로 만들기</span>
					</div>
				</div>
				<div className="pp-gallery">
					{section.items.map((point, index) => {
						const icon = iconOf(point, index);
						return (
							<article key={point.title} className="pp-card" aria-label={point.title} data-reveal="">
								<div className="pp-card-cover">
									{point.media[0] ? (
										<Media media={point.media[0]} />
									) : (
										<div className="pp-tone-cover" data-tone={TONES[index % TONES.length]} aria-hidden="true">
											<i className={`fa-solid ${icon}`} />
										</div>
									)}
								</div>
								<div className="pp-card-body">
									<h3>
										<i className={`fa-solid ${icon}`} aria-hidden="true" />
										{point.title}
									</h3>
									{point.group && <Tag>{point.group}</Tag>}
									<p>{point.body}</p>
									{(point.detail || point.media.length > 1) && (
										<details className="pp-toggle">
											<summary>자세히 보기</summary>
											{point.detail && <p>{point.detail}</p>}
											<PointMedia point={point} from={1} />
										</details>
									)}
								</div>
							</article>
						);
					})}
				</div>
			</div>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="pp-shots">
				{section.shots.map((shot) => (
					<li key={shot.src} data-reveal="">
						<figure>
							<Media media={shot} />
							<figcaption>{shot.caption}</figcaption>
						</figure>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pp-steps">
				{section.items.map((point, index) => (
					<li key={point.title}>
						<span className="pp-step-no" aria-hidden="true">
							{index + 1}.
						</span>
						<div>
							<h3>
								{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
								{point.title}
							</h3>
							<p>{point.body}</p>
							{point.detail && <p className="pp-quiet">{point.detail}</p>}
							<PointMedia point={point} />
						</div>
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<ToggleGroup section={section}>
			{section.items.map((point, index) => (
				<Toggle key={point.title} title={point.title} icon={iconOf(point, index + 2)}>
					<p>{point.body}</p>
					{point.detail && (
						<div className="pp-callout" data-tone="gray">
							<Emoji className="pp-callout-icon">💡</Emoji>
							<p>{point.detail}</p>
						</div>
					)}
					<PointMedia point={point} />
				</Toggle>
			))}
		</ToggleGroup>
	),
	troubleshooting: ({ section }) => (
		<ToggleGroup section={section}>
			{section.items.map((item) => (
				<Toggle
					key={item.title}
					title={item.title}
					icon={troubleIcon(item)}
					meta={
						<span className="pp-tgl-meta">
							<Tag tone="green">해결됨</Tag>
						</span>
					}
				>
					<dl className="pp-trouble">
						{troubleSteps(item).map((step) => (
							<div key={step.key} className="pp-callout" data-tone={STEP_TONES[step.key]}>
								<Emoji className="pp-callout-icon">{STEP_EMOJI[step.key]}</Emoji>
								<div>
									<dt>{step.label}</dt>
									<dd>{step.text}</dd>
								</div>
							</div>
						))}
					</dl>
					{item.image && (
						<figure className="pp-figure">
							<Media media={item.image} />
						</figure>
					)}
				</Toggle>
			))}
		</ToggleGroup>
	),
	stories: ({ section }) => (
		<ToggleGroup section={section}>
			{section.stories.map((story) => (
				<article key={story.title} className="pp-story" aria-label={story.title}>
					<Toggle title={story.title} icon="fa-file-lines">
						{story.lead && (
							<div className="pp-callout" data-tone="yellow">
								<Emoji className="pp-callout-icon">💬</Emoji>
								<p>{story.lead}</p>
							</div>
						)}
						{story.facts.length > 0 && <FactColumns facts={story.facts} />}
						{story.points.length > 0 && (
							<ul className="pp-bullets">
								{story.points.map((point) => (
									<li key={point.title}>
										<strong>{point.title}</strong> {point.body}
										{point.detail && <span className="pp-quiet"> {point.detail}</span>}
										<PointMedia point={point} />
									</li>
								))}
							</ul>
						)}
						{story.image && (
							<figure className="pp-figure">
								<Media media={story.image} />
								<figcaption>{story.image.alt}</figcaption>
							</figure>
						)}
					</Toggle>
				</article>
			))}
		</ToggleGroup>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<table className="pp-table pp-simple">
				<thead>
					<tr>
						<Th icon="fa-regular fa-keyboard">키</Th>
						<Th>하는 일</Th>
					</tr>
				</thead>
				<tbody>
					{section.controls.map((control) => (
						<tr key={control.label}>
							<td className="pp-keys">
								{control.keys.map((key, index) => (
									<kbd key={`${key}-${index}`}>{key}</kbd>
								))}
							</td>
							<td>{control.label}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	),
	tech: ({ section }) => (
		<>
			<Head section={section} />
			{section.stack.length > 0 && (
				<ul className="pp-stack" aria-label="쓴 기술">
					{section.stack.map((item) => (
						<li key={item}>
							<Tag>{item}</Tag>
						</li>
					))}
				</ul>
			)}
			{section.specs.length > 0 && (
				<table className="pp-table pp-simple">
					<thead>
						<tr>
							<Th>분류</Th>
							<Th icon="fa-solid fa-list-ul">기술</Th>
						</tr>
					</thead>
					<tbody>
						{section.specs.map((spec) => (
							<tr key={spec.label}>
								<th scope="row">{spec.label}</th>
								<td>
									<Tags value={spec.value} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{section.structure && (
				<figure className="pp-code">
					<figcaption>폴더 구조</figcaption>
					<pre>{section.structure}</pre>
				</figure>
			)}
		</>
	),
	team: ({ section }) => (
		<>
			<Head section={section} />
			<Database
				name="팀"
				count={section.members.length}
				views={[
					{ ...TABLE, render: () => <TeamTable members={section.members} /> },
					{
						...BOARD,
						render: () => (
							<Board
								items={section.members}
								groupOf={(member) => roleGroup(member.role)}
								keyOf={(member) => member.name}
								card={(member) => (
									<>
										<MemberName member={member} />
										<p>{member.role}</p>
										<MemberLink member={member} />
									</>
								)}
							/>
						),
					},
					{
						...GALLERY,
						render: () => (
							<ul className="pp-db-gallery">
								{section.members.map((member) => (
									<li key={member.name} className="pp-db-card" data-me={member.me || undefined}>
										<div className="pp-db-cover">
											<MemberAvatar member={member} className="pp-avatar-lg" />
										</div>
										<div className="pp-db-card-body">
											<strong>
												{member.name}
												{member.me && <Tag tone="blue">나</Tag>}
											</strong>
											<p>{member.role}</p>
											<MemberLink member={member} />
										</div>
									</li>
								))}
							</ul>
						),
					},
				]}
			/>
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} />
			{(section.role || section.context || section.period) && (
				<div className="pp-callout" data-tone="blue">
					<Emoji className="pp-callout-icon">🙋</Emoji>
					<div>
						{section.role && <p className="pp-callout-strong">{section.role}</p>}
						{(section.context || section.period) && (
							<p className="pp-quiet">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
						)}
					</div>
				</div>
			)}
			{section.contributions.length > 0 && (
				<ul className="pp-todos">
					{section.contributions.map((item) => (
						<li key={item}>
							<span className="pp-check" aria-hidden="true">
								<i className="fa-solid fa-check" />
							</span>
							{item}
						</li>
					))}
				</ul>
			)}
		</>
	),
	timeline: ({ section }) => (
		<>
			<Head section={section} />
			<div className="pp-db">
				<div className="pp-db-bar">
					<p className="pp-views-static">
						<i className={TABLE.icon} aria-hidden="true" />표
					</p>
				</div>
				<div className="pp-table-scroll">
					<table className="pp-table">
						<thead>
							<tr>
								<Th>한 일</Th>
								<Th icon="fa-regular fa-calendar">날짜</Th>
								<Th icon="fa-regular fa-circle-dot">상태</Th>
							</tr>
						</thead>
						<tbody>
							{section.entries.map((entry, index) => (
								<tr key={`${entry.date}-${entry.label}`}>
									<td>
										<span className="pp-row-title">
											<i className="fa-regular fa-file-lines" aria-hidden="true" />
											{entry.label}
										</span>
									</td>
									<td className="pp-muted-cell pp-date">{entry.date}</td>
									<td>
										<Tag tone={index === section.entries.length - 1 ? 'blue' : 'green'}>
											{index === section.entries.length - 1 ? '마무리' : '완료'}
										</Tag>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	),
	deployments: ({ section }) => (
		<>
			<Head section={section} />
			<Database
				name="배포"
				count={section.items.length}
				views={[
					{ ...TABLE, render: () => <DeployTable items={section.items} /> },
					{
						...BOARD,
						render: () => (
							<Board
								items={section.items}
								groupOf={(item) => item.platform ?? '기타'}
								keyOf={(item) => item.label}
								card={(item) => (
									<>
										<DeployName item={item} />
										{item.host && <p className="pp-quiet">{item.host}</p>}
										{item.note && <p>{item.note}</p>}
									</>
								)}
							/>
						),
					},
					{
						...GALLERY,
						render: () => (
							<ul className="pp-db-gallery">
								{section.items.map((item, index) => (
									<li key={item.label} className="pp-db-card">
										<div className="pp-db-cover">
											{item.image ? (
												<Media media={item.image} />
											) : (
												<div className="pp-tone-cover" data-tone={TONES[(index + 3) % TONES.length]} aria-hidden="true">
													<FaIcon icon={item.icon} />
												</div>
											)}
										</div>
										<div className="pp-db-card-body">
											<DeployName item={item} />
											{item.platform && <Tag>{item.platform}</Tag>}
											{item.note && <p>{item.note}</p>}
										</div>
									</li>
								))}
							</ul>
						),
					},
				]}
			/>
		</>
	),
	credits: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="pp-notes">
				{section.credits.map((credit, index) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="pp-note-no" aria-hidden="true">
							{index + 1}
						</span>
						<span>
							<span className="pp-note-role">{credit.role}</span>{' '}
							{credit.href ? (
								<a className="pp-link" href={credit.href} {...external}>
									{credit.name}
								</a>
							) : (
								<strong>{credit.name}</strong>
							)}
							, {credit.by}
							{credit.note && <span className="pp-note-extra">{credit.note}</span>}
						</span>
					</li>
				))}
			</ol>
		</>
	),
};

/* ─── 페이지 ─── */

const PROPERTY_ICONS = {
	context: 'fa-solid fa-align-left',
	role: 'fa-regular fa-user',
	period: 'fa-regular fa-calendar',
	stack: 'fa-solid fa-list-ul',
	links: 'fa-solid fa-link',
};

/** 페이지 아이콘: 프로젝트 아이콘, 없으면 문서 아이콘 */
const PageIcon: React.FC<{ icon?: string; className: string }> = ({ icon, className }) => (
	<span className={className} aria-hidden="true">
		{icon ? <img src={icon} alt="" /> : <i className="fa-regular fa-file-lines" />}
	</span>
);

/** 스크롤 상자의 높이(--pp-view, 사이드바 높이)와 지금 읽는 구역 */
function useScrollSpy(root: React.RefObject<HTMLDivElement | null>, kinds: string) {
	const [active, setActive] = useState<string>('');
	useLayoutEffect(() => {
		const el = root.current;
		if (!el) return;
		return onScrollFrame(el, (scroller) => {
			const view = scroller ? scroller.clientHeight : window.innerHeight;
			el.style.setProperty('--pp-view', `${view}px`);
			const top = (scroller?.getBoundingClientRect().top ?? 0) + 120;
			const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
			// 끝까지 내려 더 내려갈 수 없으면, 화면 안의 마지막 구역을 읽는 중으로 본다
			const end = Boolean(
				scroller && scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
			);
			let current = '';
			el.querySelectorAll<HTMLElement>('section[data-section]').forEach((section) => {
				const at = section.getBoundingClientRect().top;
				if (at <= top || (end && at < bottom - 80)) current = section.dataset.section ?? '';
			});
			setActive(current);
		});
	}, [root, kinds]);
	return active;
}

const PaperPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = paperAccent(useLandingAccent(project.icon));
	const { hero, closing, sections } = landing;
	const active = useScrollSpy(root, sections.map((section) => section.kind).join());
	const [drawer, setDrawer] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);
	const stack = sections.find((section) => section.kind === 'tech')?.stack ?? [];
	const properties = (
		[
			{ key: 'context', label: '프로젝트', value: hero.meta.context },
			{ key: 'role', label: '역할', value: hero.meta.role },
			{ key: 'period', label: '기간', value: hero.meta.period },
		] as const
	).filter((row) => row.value);

	const closeDrawer = useCallback((focus: boolean) => {
		setDrawer(false);
		if (focus) menuButton.current?.focus();
	}, []);

	useEffect(() => {
		if (!drawer) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeDrawer(true);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [drawer, closeDrawer]);

	/** 사이드바의 하위 페이지: 그 구역의 토글을 펼치고 그리로 내려간 뒤 제목에 초점을 둔다 */
	const go = (kind?: LandingSectionKind) => {
		const el = root.current;
		if (!el) return;
		setDrawer(false);
		const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
		if (!kind) {
			const scroller = scrollParent(el);
			if (scroller) scroller.scrollTo({ top: 0, behavior });
			el.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
			return;
		}
		const section = el.querySelector<HTMLElement>(`section[data-section="${kind}"]`);
		if (!section) return;
		section.querySelectorAll<HTMLDetailsElement>('details.pp-tgl').forEach((toggle) => {
			toggle.open = true;
		});
		section.scrollIntoView({ behavior, block: 'start' });
		section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
	};

	const current = sections.find((section) => section.kind === active);

	return (
		<div ref={root} className="tpl tpl-paper" style={accent} data-drawer={drawer || undefined}>
			<div className="pp-app">
				<div className="pp-rail">
					<div className="pp-scrim" aria-hidden="true" onClick={() => closeDrawer(false)} />
					<nav className="pp-side" id="pp-side" aria-label="페이지 목록">
						<div className="pp-ws">
							<span className="pp-ws-icon" aria-hidden="true">
								{hero.icon ? <img src={hero.icon} alt="" /> : hero.name.slice(0, 1)}
							</span>
							<span className="pp-ws-name">{hero.name}</span>
							<i className="fa-solid fa-chevron-down pp-ws-caret" aria-hidden="true" />
							<button
								type="button"
								className="pp-side-close"
								aria-label="사이드바 닫기"
								onClick={() => closeDrawer(true)}
							>
								<i className="fa-solid fa-angles-left" aria-hidden="true" />
							</button>
						</div>
						<ul className="pp-side-tools" aria-hidden="true">
							<li>
								<i className="fa-solid fa-magnifying-glass" />
								검색
							</li>
							<li>
								<i className="fa-solid fa-house" />홈
							</li>
							<li>
								<i className="fa-regular fa-envelope" />
								받은 편지함
							</li>
							<li>
								<i className="fa-solid fa-gear" />
								설정
							</li>
						</ul>
						<p className="pp-side-label">개인 페이지</p>
						<ul className="pp-tree">
							<li>
								<button
									type="button"
									className="pp-tree-item"
									aria-current={!current ? 'location' : undefined}
									onClick={() => go()}
								>
									<i className="fa-solid fa-chevron-down pp-tree-caret" aria-hidden="true" />
									<PageIcon icon={hero.icon} className="pp-tree-icon" />
									<span>개요</span>
								</button>
								{sections.length > 0 && (
									<ul>
										{sections.map((section) => (
											<li key={section.kind}>
												<button
													type="button"
													className="pp-tree-item pp-tree-child"
													aria-current={active === section.kind ? 'location' : undefined}
													onClick={() => go(section.kind)}
												>
													<Emoji>{PAGES[section.kind].emoji}</Emoji>
													<span>{PAGES[section.kind].title}</span>
												</button>
											</li>
										))}
									</ul>
								)}
							</li>
						</ul>
						<ul className="pp-side-tools pp-side-foot" aria-hidden="true">
							<li>
								<i className="fa-regular fa-file" />
								템플릿
							</li>
							<li>
								<i className="fa-regular fa-trash-can" />
								휴지통
							</li>
						</ul>
					</nav>
				</div>

				<div className="pp-main">
					<div className="pp-topbar">
						<button
							ref={menuButton}
							type="button"
							className="pp-menu"
							aria-label="사이드바 열기"
							aria-expanded={drawer}
							aria-controls="pp-side"
							onClick={() => setDrawer(true)}
						>
							<i className="fa-solid fa-bars" aria-hidden="true" />
						</button>
						<p className="pp-crumbs">
							<span className="pp-crumb">{hero.name}</span>
							<span className="pp-crumb-sep" aria-hidden="true">
								/
							</span>
							<span className="pp-crumb">
								<PageIcon icon={hero.icon} className="pp-crumb-icon" />
								개요
							</span>
							{current && (
								<>
									<span className="pp-crumb-sep" aria-hidden="true">
										/
									</span>
									<span className="pp-crumb pp-crumb-now">
										<Emoji>{PAGES[current.kind].emoji}</Emoji>
										{PAGES[current.kind].title}
									</span>
								</>
							)}
						</p>
						<div className="pp-top-tools" aria-hidden="true">
							{hero.meta.period && <span className="pp-edited">{hero.meta.period}</span>}
							<span>공유</span>
							<i className="fa-regular fa-star" />
							<i className="fa-solid fa-ellipsis" />
						</div>
					</div>

					<header className="pp-hero">
						<div className="pp-cover" data-image={hero.image ? '' : undefined}>
							{hero.image && <Media media={hero.image} eager />}
						</div>
						<div className="pp-doc">
							<PageIcon icon={hero.icon} className="pp-page-icon" />
							{hero.logo && (
								<p className="pp-name">
									<img className="pp-logo" src={hero.logo} alt={hero.name} />
								</p>
							)}
							<h1 tabIndex={-1}>{hero.headline}</h1>
							{(properties.length > 0 || stack.length > 0 || hero.links.length > 0) && (
								<dl className="pp-props">
									{properties.map(({ key, label, value }) => (
										<div key={key}>
											<dt>
												<i className={PROPERTY_ICONS[key]} aria-hidden="true" />
												{label}
											</dt>
											<dd>{value}</dd>
										</div>
									))}
									{stack.length > 0 && (
										<div>
											<dt>
												<i className={PROPERTY_ICONS.stack} aria-hidden="true" />
												기술
											</dt>
											<dd className="pp-tagrow">
												{stack.map((item) => (
													<Tag key={item}>{item}</Tag>
												))}
											</dd>
										</div>
									)}
									{hero.links.length > 0 && (
										<div>
											<dt>
												<i className={PROPERTY_ICONS.links} aria-hidden="true" />
												링크
											</dt>
											<dd>
												<LandingLinks links={hero.links} className="pp-links" />
											</dd>
										</div>
									)}
								</dl>
							)}
							{hero.subhead && <p className="pp-lead">{hero.subhead}</p>}
						</div>
					</header>

					<div className="pp-doc pp-body">
						<LandingSections landing={landing} renderers={RENDERERS} className="pp-section" />

						<footer className="pp-closing">
							<div className="pp-callout pp-closing-box" data-tone="gray">
								<Emoji className="pp-callout-icon">👋</Emoji>
								<div>
									<h2>{closing.title}</h2>
									{closing.lead && <p>{closing.lead}</p>}
									<LandingLinks links={closing.links} className="pp-links" />
								</div>
							</div>
						</footer>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PaperPage;
