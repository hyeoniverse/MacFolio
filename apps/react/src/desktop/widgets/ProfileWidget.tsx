import { useProfile } from '@/shared/site/profileStore';

/** 이름과 하는 일 (관리자가 고친 프로필) */
const ProfileWidget = () => {
	const profile = useProfile();
	return (
		<div className="widget-profile-body">
			<p className="widget-profile-eyebrow">Portfolio</p>
			<h2>{profile.name}</h2>
			<p>{profile.role}</p>
			<p className="widget-note">
				<i className="fa-solid fa-location-dot" aria-hidden="true"></i> {profile.location}
			</p>
		</div>
	);
};

export default ProfileWidget;
