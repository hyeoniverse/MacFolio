import React, { useLayoutEffect, useMemo, useRef } from 'react';
import {
	mergePushes,
	toWeeks,
	type ActivityItem,
	type ContributionDay,
	type Contributions,
} from '@/apps/github/githubActivity';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const DAY = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const SHORT_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const dayTitle = (day: ContributionDay) =>
	`${day.count ? plural(day.count, 'contribution') : 'No contributions'} on ${DAY.format(utc(day.date))}`;

/** 기여 달력 (GitHub 프로필의 잔디). 가로로 넘치면 가장 최근 주가 보이게 끝으로 민다 */
export const ContributionGraph: React.FC<{ contributions: Contributions }> = ({ contributions }) => {
	const scroller = useRef<HTMLDivElement>(null);
	const weeks = useMemo(() => toWeeks(contributions.days), [contributions.days]);
	// 달 이름: 그 달의 1일이 든 주 위에. 첫 주에 1일이 없으면 첫 주의 달 이름
	const months = useMemo(
		() =>
			weeks.flatMap((week, index) => {
				const first =
					week.find((day) => day?.date.endsWith('-01')) ?? (index === 0 ? week.find((day) => day) : undefined);
				return first ? [{ index, label: SHORT_MONTH.format(utc(first.date)) }] : [];
			}),
		[weeks]
	);

	useLayoutEffect(() => {
		const element = scroller.current;
		if (element) element.scrollLeft = element.scrollWidth;
	}, [weeks]);

	const total = contributions.total.toLocaleString('en-US');
	return (
		<section className="gh-contributions" aria-label="Contributions">
			<h2>
				{total} contribution{contributions.total === 1 ? '' : 's'} in the last year
			</h2>
			<div className="gh-graph-box">
				<div className="gh-graph-scroll" ref={scroller}>
					<div
						className="gh-graph"
						role="img"
						aria-label={`지난 1년 동안 기여 ${total}개`}
						style={{ '--weeks': weeks.length } as React.CSSProperties}
					>
						{months.map((month, i) => (
							// 바로 앞 달 이름과 겹치면 (첫 주가 며칠뿐일 때) 앞의 것을 뺀다
							<span
								key={`${month.index}-${month.label}`}
								className="gh-graph-month"
								style={{ gridColumn: month.index + 2 }}
								hidden={months[i + 1] !== undefined && months[i + 1].index - month.index < 3}
							>
								{month.label}
							</span>
						))}
						{['Mon', 'Wed', 'Fri'].map((label, i) => (
							<span key={label} className="gh-graph-weekday" style={{ gridRow: i * 2 + 3 }}>
								{label}
							</span>
						))}
						{weeks.map((week, w) =>
							week.map(
								(day, d) =>
									day && (
										<span
											key={day.date}
											className="gh-day"
											data-level={day.level}
											data-date={day.date}
											title={dayTitle(day)}
											style={{ gridColumn: w + 2, gridRow: d + 2 }}
										/>
									)
							)
						)}
					</div>
				</div>
				<div className="gh-graph-legend" aria-hidden="true">
					Less
					{[0, 1, 2, 3, 4].map((level) => (
						<span key={level} className="gh-day" data-level={level} />
					))}
					More
				</div>
			</div>
		</section>
	);
};

const RepoLink: React.FC<{ repo: string }> = ({ repo }) => (
	<a href={`https://github.com/${repo}`} {...external}>
		{repo}
	</a>
);

const ACTION: Record<string, string> = {
	opened: 'Opened',
	closed: 'Closed',
	reopened: 'Reopened',
	merged: 'Merged',
};

type Merged = ActivityItem & { pushes: number };

/** 활동 한 줄: 아이콘과 문장 (GitHub 영어 문구를 따른다) */
function describe(item: Merged): { icon: string; text: React.ReactNode; detail: string | null } {
	const repo = <RepoLink repo={item.repo} />;
	const target = (label: string) => (
		<a href={item.url} {...external}>
			{label}
		</a>
	);
	switch (item.kind) {
		case 'push':
			return {
				icon: 'fa-code-commit',
				text: (
					<>
						{/* 커밋 수를 모르면 (GitHub가 알려 주지 않을 때) 푸시만 적는다 */}
						Pushed {item.commits !== null ? target(plural(item.commits, 'commit')) : target('changes')} to {repo}
						{item.pushes > 1 && item.commits === null && ` (${item.pushes} times)`}
						{item.ref && <span className="gh-activity-ref">{item.ref}</span>}
					</>
				),
				detail: item.pushes === 1 ? item.title : null,
			};
		case 'create':
			if (item.refType === 'repository' || !item.ref)
				return { icon: 'fa-book-bookmark', text: <>Created repository {repo}</>, detail: null };
			return {
				icon: item.refType === 'tag' ? 'fa-tag' : 'fa-code-branch',
				text: (
					<>
						Created {item.refType ?? 'branch'} {target(item.ref)} in {repo}
					</>
				),
				detail: null,
			};
		case 'pull':
		case 'issue': {
			const pull = item.kind === 'pull';
			const icon = pull ? (item.action === 'merged' ? 'fa-code-merge' : 'fa-code-pull-request') : 'fa-circle-dot';
			return {
				icon,
				text: (
					<>
						{ACTION[item.action ?? ''] ?? 'Updated'} {pull ? 'pull request' : 'issue'}{' '}
						{target(`${item.repo}${item.number !== null ? `#${item.number}` : ''}`)}
					</>
				),
				detail: item.title,
			};
		}
		case 'release':
			return {
				icon: 'fa-tag',
				text: (
					<>
						Released {target(item.title ?? item.ref ?? 'a release')} in {repo}
					</>
				),
				detail: null,
			};
		case 'star':
			return { icon: 'fa-star', text: <>Starred {repo}</>, detail: null };
		case 'fork':
			return {
				icon: 'fa-code-fork',
				text: (
					<>
						Forked {repo}
						{item.ref && <> to {target(item.ref)}</>}
					</>
				),
				detail: null,
			};
		case 'public':
			return { icon: 'fa-lock-open', text: <>Made {repo} public</>, detail: null };
	}
}

/** 최근 공개 활동 (GitHub 프로필의 Contribution activity). 달마다 묶는다 */
export const ActivityHistory: React.FC<{ events: ActivityItem[] }> = ({ events }) => {
	const months = useMemo(() => {
		const groups: { label: string; items: Merged[] }[] = [];
		for (const item of mergePushes(events)) {
			const label = MONTH.format(new Date(item.createdAt));
			const group = groups[groups.length - 1];
			if (group?.label === label) group.items.push(item);
			else groups.push({ label, items: [item] });
		}
		return groups;
	}, [events]);

	return (
		<section className="gh-activity" aria-label="Contribution activity">
			<h2>Contribution activity</h2>
			{months.map((month) => (
				<div key={month.label} className="gh-activity-month">
					<h3>{month.label}</h3>
					<ol>
						{month.items.map((item) => {
							const { icon, text, detail } = describe(item);
							return (
								<li key={item.id}>
									<span className="gh-activity-icon" data-action={item.action ?? undefined}>
										<i className={`fa-solid ${icon}`} aria-hidden="true" />
									</span>
									<div className="gh-activity-body">
										<p>{text}</p>
										{detail && <p className="gh-activity-detail">{detail}</p>}
									</div>
									<time dateTime={item.createdAt}>{SHORT_DAY.format(new Date(item.createdAt))}</time>
								</li>
							);
						})}
					</ol>
				</div>
			))}
		</section>
	);
};
