import { useRef } from 'react';
import { APP_MANIFEST } from '@/apps/manifest';
import { appIconUrl } from '@/shared/config/appIcon';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { dismiss, useNotifications, type Notice } from './notificationStore';
import '@/desktop/notifications/Notifications.css';

/** 위로 이만큼 밀면 닫는다 (iOS 배너) */
const SWIPE_DISMISS_PX = 24;

const Banner = ({ notice, mobile }: { notice: Notice; mobile: boolean }) => {
	const startY = useRef<number | null>(null);
	const { label, icon } = (mobile && APP_MANIFEST[notice.app].mobile) || APP_MANIFEST[notice.app];

	return (
		<div
			className={`notification ${notice.leaving ? 'leaving' : ''}`}
			role="status"
			// iOS: 배너를 위로 밀거나 누르면 닫힌다
			onPointerDown={(event) => {
				startY.current = event.clientY;
			}}
			onPointerUp={(event) => {
				const start = startY.current;
				startY.current = null;
				if (mobile && start !== null && start - event.clientY >= SWIPE_DISMISS_PX) dismiss(notice.id);
			}}
			onClick={() => mobile && dismiss(notice.id)}
		>
			{/* macOS: 마우스를 올리면 왼쪽 위에 닫기 단추가 보인다 */}
			{!mobile && (
				<button type="button" className="notification-close" aria-label="알림 닫기" onClick={() => dismiss(notice.id)}>
					<i className="fa-solid fa-xmark" aria-hidden="true"></i>
				</button>
			)}
			<img className="notification-icon" src={appIconUrl(icon)} alt="" />
			<div className="notification-text">
				<div className="notification-head">
					<strong>{notice.title}</strong>
					<time>지금</time>
				</div>
				<p>{notice.body}</p>
				<span className="visually-hidden">{label}</span>
			</div>
		</div>
	);
};

/** 알림 배너. 데스크톱은 macOS처럼 오른쪽 위, 모바일은 iOS처럼 위쪽 가운데 */
const Notifications = () => {
	const items = useNotifications();
	const mobile = useIsMobile();
	return (
		<div className={`notifications ${mobile ? 'ios' : 'macos'}`} aria-live="polite">
			{items.map((notice) => (
				<Banner key={notice.id} notice={notice} mobile={mobile} />
			))}
		</div>
	);
};

export default Notifications;
