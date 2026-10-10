import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';
import LikeButton from './LikeButton';
import { fetchPostLikes, setPostLike, toggleLike, type Likes } from './likesApi';

/**
 * 글 아래의 좋아요. 로그인 없이 누르고, 같은 브라우저는 한 번만 센다 (서버의 방문자 쿠키). 서버가 없거나 읽지 못하면 감춘다.
 * 글이 바뀌면 부르는 쪽이 key로 새로 그린다
 */
const PostLike = ({ slug, onChange }: { slug: string; onChange?: (slug: string, likes: Likes) => void }) => {
	const [likes, setLikes] = useState<Likes | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!env.apiUrl) return;
		let alive = true;
		void fetchPostLikes(env.apiUrl, slug).then((next) => alive && setLikes(next));
		return () => {
			alive = false;
		};
	}, [slug]);

	if (!likes) return null;
	return (
		<div className="memo-post-like">
			<LikeButton
				likes={likes}
				what="이 글"
				size="post"
				onToggle={() => {
					if (busy) return;
					setBusy(true);
					void toggleLike(likes, (liked) => setPostLike(env.apiUrl, slug, liked), setLikes).then((saved) => {
						setBusy(false);
						onChange?.(slug, saved);
					});
				}}
			/>
		</div>
	);
};

export default PostLike;
