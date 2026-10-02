import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import AdminAccount from '@/shared/auth/AdminAccount';
import '@/apps/passwords/Passwords.css';

/**
 * 암호 (iOS 암호 앱 모양): 이 사이트의 관리자 계정으로 로그인·로그아웃한다.
 * 데스크톱에서는 메뉴 막대의 Apple 메뉴와 시스템 설정에서 같은 일을 한다.
 */
const Passwords = () => (
	<AppWindow title="암호" appName="passwords">
		<MobileNavigation floating />
		<div className="passwords">
			{/* 휴대폰: iOS 암호 앱처럼 큰 제목 */}
			<h1 className="passwords-phone-title phone-title">암호</h1>
			<h2 className="passwords-heading">
				<i className="fa-solid fa-key" aria-hidden="true" /> MacFolio 관리자
			</h2>
			<div className="passwords-card">
				<AdminAccount />
			</div>
		</div>
	</AppWindow>
);

export default Passwords;
