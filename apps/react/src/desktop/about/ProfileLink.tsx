import { useAppState } from '@/desktop/useAppState';
import { composeRequest } from '@/apps/mail/composeRequest';
import { openExternal } from '@/shared/analytics/analytics';
import { closeAbout } from './aboutStore';

/**
 * 프로필의 링크.
 * - mailto: 기기의 메일 앱이 아니라 이 사이트의 메일 앱에서 '새로운 메시지'를 연다 (받는 사람은 늘 사이트 주인).
 *   누를 수 있다는 것이 보이게 바깥 링크와 같은 색과 ↗를 붙인다
 * - 나머지(GitHub, 저장소): 바깥 링크라 새 탭으로 열고 ↗ 표시를 붙인다. openExternal로 연다 (나간 링크로 센다)
 * 이 Mac에 관하여 창은 다른 창보다 위에 떠 있어서, 앱을 열 때는 닫는다
 */
const ProfileLink = ({ href, children }: { href: string; children: string }) => {
	const { openApp } = useAppState();
	if (href.startsWith('mailto:'))
		return (
			<a
				className="profile-external-link"
				href={href}
				title="메일 앱에서 새로운 메시지 쓰기"
				onClick={(event) => {
					event.preventDefault();
					closeAbout();
					composeRequest.setState({ pending: true });
					openApp('mail');
				}}
			>
				{children}
				{/* GitHub처럼 누를 수 있다는 것이 보이게 ↗ (가는 곳은 이 사이트의 메일 앱) */}
				<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
				<span className="visually-hidden"> (메일 앱에서 쓰기)</span>
			</a>
		);
	return (
		<a
			className="profile-external-link"
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(event) => {
				event.preventDefault();
				openExternal(href);
			}}
		>
			{children}
			<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
			<span className="visually-hidden"> (새 탭)</span>
		</a>
	);
};

export default ProfileLink;
