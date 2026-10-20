import { useState } from 'react';

import { movePost, type FolderPath, type Organization, type Post } from '@macfolio/desktop-core/memo';

/** 휴대폰 메모 선택: 여러 메모를 골라 한 번에 옮기거나 지운다 (picked가 null이면 고르는 중이 아니다) */
export function usePickedNotes(
	organized: readonly Post[],
	edit: (change: (prev: Organization) => Organization) => void
) {
	const [picked, setPicked] = useState<Set<string> | null>(null);
	const pickedPosts = picked ? organized.filter((post) => picked.has(post.slug)) : [];
	return {
		picked,
		setPicked,
		pickedPosts,
		/** 누를 때마다 넣고 뺀다 */
		togglePicked: (slug: string) =>
			setPicked((current) => {
				const next = new Set(current);
				if (next.has(slug)) next.delete(slug);
				else next.add(slug);
				return next;
			}),
		/** 고른 메모들을 한 폴더로 옮기고 고르기를 끝낸다 */
		movePicked: (path: FolderPath) => {
			edit((prev) => pickedPosts.reduce((next, post) => movePost(next, post.slug, path, post.category), prev));
			setPicked(null);
		},
	};
}
