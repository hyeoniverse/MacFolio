import type { AdminPost, Post } from '@macfolio/desktop-core/memo';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { setPostSecret } from './postsApi';

/**
 * 비밀 글 지정·해제 (관리자): 관리자에게만 보이게 한다. 서버에만 있는 글에만 메뉴가 열린다 (noteMenus.tsx의 secretItem).
 * 서버가 돌려준 글로 관리자 목록을 바꾸고, 실패하면 이유를 알린다
 */
export function useSecretPost(upsertAdminPost: (post: AdminPost) => void) {
	return async (post: Post) => {
		const secret = !post.status?.secret;
		const result = await setPostSecret(env.apiUrl, post.slug, secret);
		if (!result.ok) {
			notify({
				app: 'memo',
				title: secret ? '비밀 글로 지정하지 못함' : '비밀 글을 해제하지 못함',
				body: result.errors.join(' '),
			});
			return;
		}
		upsertAdminPost(result.post);
	};
}
