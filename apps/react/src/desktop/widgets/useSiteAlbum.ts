import { useCallback } from 'react';
import { useAdmin } from '@/shared/auth/adminStore';
import { notify } from '@/desktop/notifications/notificationStore';
import { saveSiteWidgetDefaults, useSiteWidgetDefaults } from '@/shared/site/widgetDefaultsStore';
import { effectiveAlbum, siteAlbumOf } from './catalog';

/**
 * 사진 위젯의 앨범 고르기 (바탕화면·휴대폰 홈 화면). 고른 값은 이 브라우저에 저장하고(부르는 쪽),
 * 관리자가 고르면 사이트 기본값(PUT /site/widgets)으로도 저장해 다른 기기·다른 방문자에게도 보이게 한다.
 * - shown: 메뉴·시트에 체크할 앨범 (이 브라우저에서 고른 값, 없으면 사이트 기본값)
 * - share: 관리자면 서버에 저장한다. 실패하면 알린다 (이 브라우저의 값은 그대로)
 */
export function useSiteAlbum() {
	const { status } = useAdmin();
	const { photoAlbum } = useSiteWidgetDefaults();
	const shown = useCallback((local: string | undefined) => effectiveAlbum(local, photoAlbum), [photoAlbum]);
	const share = useCallback(
		(album: string | undefined) => {
			if (status !== 'signed-in') return;
			void saveSiteWidgetDefaults({ photoAlbum: siteAlbumOf(album) }).then((result) => {
				if (!result.ok)
					notify({
						app: 'photos',
						title: '저장하지 못함',
						body: `사진 위젯의 기본 앨범을 저장하지 못했습니다. ${result.errors.join(' ')}`,
					});
			});
		},
		[status]
	);
	return { shown, share };
}
