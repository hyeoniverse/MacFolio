import { useState } from 'react';
import { PROFILE_LIMITS } from '@macfolio/desktop-core/site';
import { parseProfile } from '@macfolio/contracts';
import { REPO_URL } from '@/apps/finder/repoDocs';
import { fullName } from '@/desktop/about/profileInfo';
import ProfileLink from '@/desktop/about/ProfileLink';
import { notify } from '@/desktop/notifications/notificationStore';
import { useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import {
	githubLogin,
	photoUrl,
	resetProfile,
	saveProfile,
	useProfileState,
	type SiteProfile,
} from '@/shared/site/profileStore';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';

/** 묶음 하나: 작은 회색 제목, 둥근 칸 안에 이름표·값 줄. hint는 칸 아래의 작은 안내 (macOS 설정의 설명 글처럼) */
const Group = ({
	title,
	rows,
	hint,
}: {
	title: string;
	rows: { label: string; value: React.ReactNode }[];
	hint?: { id: string; text: string };
}) => (
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
		{hint && (
			<p id={hint.id} className="about-pane-hint">
				{hint.text}
			</p>
		)}
	</section>
);

/** 기술 칸 아래 안내 (입력칸이 aria-describedby로 가리킨다) */
const LIST_HINT = { id: 'about-pane-list-hint', text: '쉼표(,)로 나눠 씁니다. 예: React, TypeScript, Vite' };

/** 편집 중인 값: 기술 목록은 쉼표로 이은 한 줄로 고친다 */
type Draft = Record<
	| 'name'
	| 'nameEn'
	| 'role'
	| 'school'
	| 'location'
	| 'email'
	| 'github'
	| 'frontend'
	| 'backend'
	| 'interaction'
	| 'siteStack',
	string
>;

const toDraft = (profile: SiteProfile): Draft => ({
	name: profile.name,
	nameEn: profile.nameEn,
	role: profile.role,
	school: profile.school,
	location: profile.location,
	email: profile.email,
	github: profile.github,
	frontend: profile.skills.frontend.join(', '),
	backend: profile.skills.backend.join(', '),
	interaction: profile.skills.interaction.join(', '),
	siteStack: profile.siteStack.join(', '),
});

const items = (text: string) => text.split(',');

const fromDraft = (draft: Draft) => ({
	name: draft.name,
	nameEn: draft.nameEn,
	role: draft.role,
	school: draft.school,
	location: draft.location,
	email: draft.email,
	github: draft.github,
	skills: { frontend: items(draft.frontend), backend: items(draft.backend), interaction: items(draft.interaction) },
	siteStack: items(draft.siteStack),
});

/** 편집 칸의 묶음: 보기와 같은 둥근 칸에 이름표와 입력칸 */
const FIELDS: {
	title: string;
	hint?: typeof LIST_HINT;
	rows: { key: keyof Draft; label: string; type?: string; list?: boolean }[];
}[] = [
	{
		title: '프로필',
		rows: [
			{ key: 'name', label: '이름' },
			{ key: 'nameEn', label: '영문 이름' },
			{ key: 'role', label: '직무' },
			{ key: 'school', label: '학교' },
			{ key: 'location', label: '위치' },
		],
	},
	{
		title: '연락처',
		rows: [
			{ key: 'email', label: '이메일', type: 'email' },
			{ key: 'github', label: 'GitHub 주소', type: 'url' },
		],
	},
	{
		title: '기술',
		hint: LIST_HINT,
		rows: [
			{ key: 'frontend', label: '프론트엔드', list: true },
			{ key: 'backend', label: '백엔드', list: true },
			{ key: 'interaction', label: '인터랙션', list: true },
			{ key: 'siteStack', label: '이 사이트를 만든 기술', list: true },
		],
	},
];

/**
 * 시스템 설정의 '정보' (macOS의 일반 › 정보): 이 Mac 대신 만든 사람. '이 Mac에 관하여'의 '추가 정보…'가 여기를 연다.
 * 작은 창보다 자세히: 프로필, 연락처, 기술 전부, 이 사이트를 만든 기술과 저장소.
 * 관리자는 편집을 눌러 프로필을 고친다. 저장하면 서버에 남아 모든 방문자의 화면(이 Mac에 관하여, 메일, 메시지, 터미널…)이 바뀐다
 */
const AboutPane = () => {
	const { profile, custom } = useProfileState();
	const admin = useAdmin().status === 'signed-in' && Boolean(env.apiUrl);
	const photo = photoUrl(profile);
	/** 불러오지 못한 사진 주소 (GitHub 주소가 바뀌면 다시 시도한다) */
	const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
	/** 편집 중인 값 (null이면 보기) */
	const [draft, setDraft] = useState<Draft | null>(null);
	const [errors, setErrors] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [confirmingReset, setConfirmingReset] = useState(false);

	const startEditing = () => {
		setDraft(toDraft(profile));
		setErrors([]);
	};
	const cancel = () => {
		setDraft(null);
		setErrors([]);
	};
	const save = async () => {
		if (!draft) return;
		// 서버와 같은 규칙으로 먼저 확인한다 (서버도 다시 확인한다)
		const parsed = parseProfile(fromDraft(draft));
		if ('errors' in parsed) return setErrors(parsed.errors);
		setBusy(true);
		const result = await saveProfile(parsed.value);
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		setDraft(null);
		setErrors([]);
		notify({ app: 'settings', title: '프로필을 저장했습니다', body: '모든 방문자에게 바뀐 프로필이 보입니다.' });
	};
	const reset = async () => {
		setConfirmingReset(false);
		setBusy(true);
		const result = await resetProfile();
		setBusy(false);
		if (!result.ok) return setErrors(result.errors);
		setDraft(null);
		setErrors([]);
		notify({ app: 'settings', title: '기본 프로필로 되돌렸습니다', body: '코드에 적힌 프로필이 다시 보입니다.' });
	};

	return (
		<div className="about-pane">
			<header className="about-pane-head">
				{brokenPhoto !== photo ? (
					<img src={photo} alt="" onError={() => setBrokenPhoto(photo)} />
				) : (
					<span className="about-pane-monogram" aria-hidden="true">
						{profile.name.slice(-2)}
					</span>
				)}
				<div>
					<h3>{profile.name}</h3>
					<p>{profile.role}</p>
				</div>
				{admin && (
					<span className="showcase-head-actions about-pane-actions">
						{draft ? (
							<>
								<button type="button" className="showcase-text-button" onClick={cancel} disabled={busy}>
									취소
								</button>
								<button type="submit" form="about-pane-form" className="showcase-text-button strong" disabled={busy}>
									완료
								</button>
							</>
						) : (
							<button type="button" className="showcase-text-button" onClick={startEditing}>
								편집
							</button>
						)}
					</span>
				)}
			</header>

			{draft ? (
				<form
					id="about-pane-form"
					className="about-pane-form"
					aria-label="프로필 편집"
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					{errors.length > 0 && (
						<ul className="about-pane-errors" role="alert">
							{errors.map((error) => (
								<li key={error}>{error}</li>
							))}
						</ul>
					)}
					{FIELDS.map((group) => (
						<Group
							key={group.title}
							title={group.title}
							hint={group.hint}
							rows={group.rows.map(({ key, label, type = 'text', list }) => ({
								label,
								value: (
									<input
										type={type}
										aria-label={label}
										value={draft[key]}
										maxLength={list ? undefined : PROFILE_LIMITS.text}
										aria-describedby={list ? LIST_HINT.id : undefined}
										spellCheck={false}
										onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
									/>
								),
							}))}
						/>
					))}
					{custom && (
						<button
							type="button"
							className="showcase-text-button about-pane-reset"
							onClick={() => setConfirmingReset(true)}
							disabled={busy}
						>
							기본값으로 되돌리기
						</button>
					)}
				</form>
			) : (
				<>
					<Group
						title="프로필"
						rows={[
							{ label: '이름', value: fullName(profile) },
							{ label: '직무', value: profile.role },
							{ label: '학교', value: profile.school },
							{ label: '위치', value: profile.location },
						].filter((row) => row.value)}
					/>
					<Group
						title="연락처"
						rows={[
							{
								label: '이메일',
								value: <ProfileLink href={`mailto:${profile.email}`}>{profile.email}</ProfileLink>,
							},
							{ label: 'GitHub', value: <ProfileLink href={profile.github}>{githubLogin(profile)}</ProfileLink> },
						]}
					/>
					<Group
						title="기술"
						rows={[
							{ label: '프론트엔드', value: profile.skills.frontend.join(' · ') },
							{ label: '백엔드', value: profile.skills.backend.join(' · ') },
							{ label: '인터랙션', value: profile.skills.interaction.join(' · ') },
						].filter((row) => row.value)}
					/>
					<Group
						title="이 사이트 (MacFolio)"
						rows={[
							...(profile.siteStack.length ? [{ label: '만든 기술', value: profile.siteStack.join(' · ') }] : []),
							{ label: '저장소', value: <ProfileLink href={REPO_URL}>{REPO_URL.replace('https://', '')}</ProfileLink> },
						]}
					/>
				</>
			)}

			{confirmingReset && (
				<AlertDialog
					title="기본 프로필로 되돌릴까요?"
					message="저장한 프로필을 지우고, 코드에 적힌 프로필을 다시 보여 줍니다."
					confirmLabel="되돌리기"
					onConfirm={() => void reset()}
					onCancel={() => setConfirmingReset(false)}
				/>
			)}
		</div>
	);
};

export default AboutPane;
