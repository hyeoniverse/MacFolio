import { useState } from 'react';
import { REPO_URL } from '@/apps/finder/repoDocs';
import { GITHUB_LOGIN, PHOTO_URL } from '@/desktop/about/profileInfo';
import ProfileLink from '@/desktop/about/ProfileLink';
import { PROFILE, SITE_STACK, SKILLS } from '@/shared/profile';

/** 묶음 하나: 작은 회색 제목, 둥근 칸 안에 이름표·값 줄 */
const Group = ({ title, rows }: { title: string; rows: { label: string; value: React.ReactNode }[] }) => (
	<section className="about-pane-group" aria-label={title}>
		<h3>{title}</h3>
		<dl>
			{rows.map(({ label, value }) => (
				<div key={label}>
					<dt>{label}</dt>
					<dd>{value}</dd>
				</div>
			))}
		</dl>
	</section>
);

/**
 * 시스템 설정의 '정보' (macOS의 일반 › 정보): 이 Mac 대신 만든 사람. '이 Mac에 관하여'의 '추가 정보…'가 여기를 연다.
 * 작은 창보다 자세히: 프로필, 연락처, 기술 전부, 이 사이트를 만든 기술과 저장소
 */
const AboutPane = () => {
	const [photo, setPhoto] = useState(true);
	return (
		<div className="about-pane">
			<header className="about-pane-head">
				{photo ? (
					<img src={PHOTO_URL} alt="" onError={() => setPhoto(false)} />
				) : (
					<span className="about-pane-monogram" aria-hidden="true">
						{PROFILE.name.slice(-2)}
					</span>
				)}
				<div>
					<h3>{PROFILE.name}</h3>
					<p>{PROFILE.role}</p>
				</div>
			</header>

			<Group
				title="프로필"
				rows={[
					{ label: '이름', value: `${PROFILE.name} (${PROFILE.nameEn})` },
					{ label: '직무', value: PROFILE.role },
					{ label: '학교', value: PROFILE.school },
					{ label: '위치', value: PROFILE.location },
				]}
			/>
			<Group
				title="연락처"
				rows={[
					{ label: '이메일', value: <ProfileLink href={`mailto:${PROFILE.email}`}>{PROFILE.email}</ProfileLink> },
					{ label: 'GitHub', value: <ProfileLink href={PROFILE.github}>{GITHUB_LOGIN}</ProfileLink> },
				]}
			/>
			<Group
				title="기술"
				rows={[
					{ label: '프론트엔드', value: SKILLS.frontend.join(' · ') },
					{ label: '백엔드', value: SKILLS.backend.join(' · ') },
					{ label: '인터랙션', value: SKILLS.interaction.join(' · ') },
				]}
			/>
			<Group
				title="이 사이트 (MacFolio)"
				rows={[
					{ label: '만든 기술', value: SITE_STACK.join(' · ') },
					{ label: '저장소', value: <ProfileLink href={REPO_URL}>{REPO_URL.replace('https://', '')}</ProfileLink> },
				]}
			/>
		</div>
	);
};

export default AboutPane;
