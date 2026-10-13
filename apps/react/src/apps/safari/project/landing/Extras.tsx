// 트러블슈팅·팀원·배포 결과물의 공통 짜임. 템플릿은 구역 머리만 자기 것으로 두고 이 목록을 그린 뒤, 접두사 클래스(예: pd-trouble)와
// landing.css의 --lk-x-* 변수로 자기 디자인에 맞춘다. 그림이 없어도 아이콘·단계 띠·이름 첫 글자로 비어 보이지 않게 짠다
import React from 'react';
import {
	faClass,
	troubleIcon,
	troubleSteps,
	type LandingDeployment,
	type LandingMember,
	type LandingTrouble,
} from './content';
import { Media } from './Media';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 공통 클래스와 템플릿 접두사 클래스를 함께 단다 (예: cx('pd', 'trouble') → 'lk-trouble pd-trouble') */
const cx = (prefix: string | undefined, name: string, extra?: string) =>
	[`lk-${name}`, prefix && `${prefix}-${name}`, extra].filter(Boolean).join(' ');

/** 나타나는 차례 (0부터): 목록 안에서 조금씩 늦게 */
const delay = (index: number) => ({ '--d': Math.min(index, 4) }) as React.CSSProperties;

/** Font Awesome 아이콘 하나 (브랜드 아이콘이면 fa-brands) */
export const FaIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className }) => (
	<i className={[faClass(icon), className].filter(Boolean).join(' ')} aria-hidden="true" />
);

/** 팀원 사진. 없으면 이름 첫 글자를 담은 동그라미를 그린다 (장식: 이름은 옆에 글로 있다) */
export const MemberAvatar: React.FC<{ member: LandingMember; className?: string }> = ({ member, className }) =>
	member.avatar ? (
		<img
			className={['lk-avatar', className].filter(Boolean).join(' ')}
			src={member.avatar}
			alt=""
			loading="lazy"
			aria-hidden="true"
		/>
	) : (
		<span
			className={['lk-avatar', 'lk-avatar-initials', className].filter(Boolean).join(' ')}
			data-me={member.me || undefined}
			aria-hidden="true"
		>
			{member.initials}
		</span>
	);

/** 트러블슈팅 목록: 한 건마다 아이콘과 제목, 문제 → 원인 → 해결 → 결과 띠, 그림이 있으면 옆에 */
export const TroubleList: React.FC<{ items: LandingTrouble[]; prefix?: string; reveal?: boolean }> = ({
	items,
	prefix,
	reveal = true,
}) => (
	<ol className={cx(prefix, 'troubles')}>
		{items.map((item, index) => (
			<li
				key={item.title}
				className={cx(prefix, 'trouble')}
				data-image={item.image ? '' : undefined}
				data-reveal={reveal ? '' : undefined}
				style={delay(index)}
			>
				<div className={cx(prefix, 'trouble-main')}>
					<header className={cx(prefix, 'trouble-head')}>
						<span className={cx(prefix, 'trouble-icon')}>
							<FaIcon icon={troubleIcon(item)} />
						</span>
						<span className={cx(prefix, 'trouble-num')}>{String(index + 1).padStart(2, '0')}</span>
						<h3>{item.title}</h3>
					</header>
					<dl className={cx(prefix, 'trouble-steps')}>
						{troubleSteps(item).map((step) => (
							<div key={step.key} className={cx(prefix, 'trouble-step')} data-step={step.key}>
								<dt>{step.label}</dt>
								<dd>{step.text}</dd>
							</div>
						))}
					</dl>
				</div>
				{item.image && (
					<figure className={cx(prefix, 'trouble-image')}>
						<Media media={item.image} />
					</figure>
				)}
			</li>
		))}
	</ol>
);

/** 팀원 목록: 사진(없으면 이름 첫 글자), 이름, 역할, 주소. 나는 강조색 테두리와 '나' 표시 */
export const TeamList: React.FC<{ members: LandingMember[]; prefix?: string; reveal?: boolean }> = ({
	members,
	prefix,
	reveal = true,
}) => (
	<ul className={cx(prefix, 'team')} data-count={Math.min(members.length, 4)}>
		{members.map((member, index) => (
			<li
				key={member.name}
				className={cx(prefix, 'member')}
				data-me={member.me ? '' : undefined}
				data-reveal={reveal ? '' : undefined}
				style={delay(index)}
			>
				<MemberAvatar member={member} className={prefix && `${prefix}-avatar`} />
				<div className={cx(prefix, 'member-text')}>
					<h3>
						{member.name}
						{member.me && <span className={cx(prefix, 'member-me')}>나</span>}
					</h3>
					<p className={cx(prefix, 'member-role')}>{member.role}</p>
					{member.url && (
						<a className={cx(prefix, 'member-link')} href={member.url} {...external}>
							<FaIcon icon={/github\.com/.test(member.url) ? 'fa-github' : 'fa-link'} />
							<span>{member.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
						</a>
					)}
				</div>
			</li>
		))}
	</ul>
);

/** 배포 결과물: 올린 곳 아이콘, 이름(주소가 있으면 카드 전체가 링크), 올린 곳·호스트, 설명, 공개 상태 */
export const DeployList: React.FC<{ items: LandingDeployment[]; prefix?: string; reveal?: boolean }> = ({
	items,
	prefix,
	reveal = true,
}) => (
	<ul className={cx(prefix, 'deploys')} data-count={Math.min(items.length, 3)}>
		{items.map((item, index) => (
			<li
				key={item.label}
				className={cx(prefix, 'deploy')}
				data-image={item.image ? '' : undefined}
				data-live={item.url ? '' : undefined}
				data-reveal={reveal ? '' : undefined}
				style={delay(index)}
			>
				{item.image && (
					<figure className={cx(prefix, 'deploy-image')}>
						<Media media={item.image} />
					</figure>
				)}
				<div className={cx(prefix, 'deploy-body')}>
					<div className={cx(prefix, 'deploy-top')}>
						<span className={cx(prefix, 'deploy-icon')}>
							<FaIcon icon={item.icon} />
						</span>
						<span className={cx(prefix, 'deploy-status')}>{item.url ? '공개' : '링크 없음'}</span>
					</div>
					<h3>
						{item.url ? (
							<a className={cx(prefix, 'deploy-link')} href={item.url} {...external}>
								{item.label}
							</a>
						) : (
							item.label
						)}
					</h3>
					{(item.platform || item.host) && (
						<p className={cx(prefix, 'deploy-meta')}>{[item.platform, item.host].filter(Boolean).join(' · ')}</p>
					)}
					{item.note && <p className={cx(prefix, 'deploy-note')}>{item.note}</p>}
					{item.url && (
						<span className={cx(prefix, 'deploy-go')} aria-hidden="true">
							열어 보기 <i className="fa-solid fa-arrow-up-right-from-square" />
						</span>
					)}
				</div>
			</li>
		))}
	</ul>
);
