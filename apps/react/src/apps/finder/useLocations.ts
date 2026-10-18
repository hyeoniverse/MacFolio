import { useEffect, useMemo, useState } from 'react';
import { APP_MANIFEST, WINDOW_APP_NAMES } from '@/apps/manifest';
import { getPostRepository } from '@/apps/memo/repository';
import { fetchOrganization } from '@/apps/memo/organizationApi';
import { organizePosts } from '@macfolio/desktop-core/memo';
import { env } from '@/shared/config/env';
import { PROJECTS } from '@/shared/profile';
import { useProjectsVersion } from '@/shared/site/siteContent';
import { buildLocations, type FolderItem } from './files';
import { loadDocuments, useDocumentEntries } from './documents';
import { DOC_PATHS } from './docsBundle';
import { ALBUMS } from '@/apps/photos/albums';

/**
 * Finder의 위치들(문서, 프로젝트, 블로그, 응용 프로그램. 사진은 프로젝트 폴더 안에)과 그 안의 트리.
 * Finder와 미리보기의 열기 창이 같은 트리를 본다: 글 목록·프로젝트·올린 문서 파일이 바뀌면 둘 다 바뀐다
 */
export function useLocations(): FolderItem[] {
	const [posts, setPosts] = useState<{ slug: string; title: string; date: string; category: string }[]>([]);
	// 메모에서 만든 폴더: 글이 없는 빈 폴더도 블로그 폴더에 보인다
	const [blogFolders, setBlogFolders] = useState<string[]>([]);
	useEffect(() => {
		let alive = true;
		// 메모의 정리 내용(옮긴 글·옮긴 폴더·만든 폴더)을 적용해 메모 사이드바와 같은 폴더로 묶는다
		Promise.all([getPostRepository().list(), fetchOrganization(env.apiUrl)])
			.then(([list, organization]) => {
				if (!alive) return;
				setPosts(organizePosts(list, organization));
				setBlogFolders(organization.folders);
			})
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, []);

	// 시스템 설정에서 프로젝트를 저장하면 프로젝트 폴더도 새로고침 없이 바뀐다
	const projectsVersion = useProjectsVersion();
	const documents = useDocumentEntries();
	useEffect(() => {
		void loadDocuments();
	}, []);
	return useMemo(
		() =>
			buildLocations({
				docs: DOC_PATHS,
				posts,
				blogFolders,
				projects: PROJECTS.map(({ id, name, icon, period }) => ({ id, name, icon, period })),
				apps: WINDOW_APP_NAMES.filter((name) => name !== 'finder').map((name) => ({
					app: name,
					label: APP_MANIFEST[name].label,
					icon: APP_MANIFEST[name].icon,
				})),
				files: documents,
				albums: ALBUMS,
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- PROJECTS는 안만 바뀌는 배열이라 판(version)으로 다시 계산한다
		[posts, blogFolders, projectsVersion, documents]
	);
}
