import { useEffect, useMemo, useState } from 'react';
import { APP_MANIFEST, WINDOW_APP_NAMES } from '@/apps/manifest';
import { getPostRepository } from '@/apps/memo/repository';
import { organizePosts, type Post } from '@macfolio/desktop-core/memo';
import { loadStructure, useStructure } from './structure';
import { PROJECTS } from '@/shared/profile';
import { useProjectsVersion } from '@/shared/site/siteContent';
import { buildTree, find, type FolderItem } from './files';
import { loadDocuments, useDocumentEntries } from './documents';
import { DOC_PATHS } from './docsBundle';
import { parseResume, RESUME_DOC, RESUME_DOC_EN } from './resumeModel';
import { RESUME_PDF_KEYS, resumeFileName } from './resumeDownload';
import { useResume } from '@/shared/site/resumeStore';
import { useProfile } from '@/shared/site/profileStore';
import { ALBUMS } from '@/apps/photos/albums';
import { ALBUMS as MUSIC_ALBUMS, ALL_SONGS, TRACKS } from '@/apps/music/library';
import { useLocalFiles } from './localFiles';

/**
 * Finder의 트리: Macintosh HD › 응용 프로그램, 사용자 › 홈 › 데스크탑·문서·블로그와 macOS 기본 폴더
 * (프로젝트 폴더는 문서 › 포트폴리오 안, 사진은 프로젝트 폴더 안에). 사이드바의 즐겨찾기는 files.ts의 FAVORITE_IDS.
 * Finder와 미리보기의 열기 창이 같은 트리를 본다: 글 목록·프로젝트·올린 문서 파일이 바뀌면 둘 다 바뀐다
 */
export function useLocations(): FolderItem[] {
	return useTree().roots;
}

/** 휴지통 폴더 (휴지통 앱이 보인다). 안의 항목을 되돌리거나 지울 때는 [...위치, 휴지통]에서 찾는다 */
export function useTrash(): FolderItem {
	return useTree().trash;
}

function useTree(): { roots: FolderItem[]; trash: FolderItem } {
	const [list, setList] = useState<Post[]>([]);
	useEffect(() => {
		let alive = true;
		getPostRepository()
			.list()
			.then((loaded) => alive && setList(loaded))
			.catch(() => undefined);
		void loadStructure();
		return () => {
			alive = false;
		};
	}, []);
	// 관리자가 정한 구조 (structure.ts). 블로그는 메모의 정리 내용(옮긴 글·옮긴 폴더·만든 폴더)을 적용해 메모 사이드바와 같은 폴더로 묶는다.
	// 글이 없는 빈 폴더도 보인다
	const { layout, organization } = useStructure();
	const posts = useMemo(() => organizePosts(list, organization), [list, organization]);
	const blogFolders = organization.folders;

	// 시스템 설정에서 프로젝트를 저장하면 프로젝트 폴더도 새로고침 없이 바뀐다
	const projectsVersion = useProjectsVersion();
	const ownerName = useProfile().name;
	// 영문 이력서의 이름 (# 줄). 영문 파일 이름에 쓴다
	const englishName = parseResume(useResume('en')).name || 'Resume';
	const documents = useDocumentEntries();
	useEffect(() => {
		void loadDocuments();
	}, []);
	const localFiles = useLocalFiles();
	return useMemo(() => {
		const tree = buildTree({
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
			// 이력서: 국문·영문 Markdown(텍스트 편집기)과 그 PDF(미리보기, 열 때마다 지금 글로 만든다)
			resume: [
				{ kind: 'doc', id: `docs:${RESUME_DOC}`, name: `${ownerName}_이력서`, path: RESUME_DOC },
				{
					kind: 'doc',
					id: `docs:${RESUME_DOC_EN}`,
					name: resumeFileName('en', englishName),
					path: RESUME_DOC_EN,
				},
				{
					kind: 'pdf',
					id: `file:${RESUME_PDF_KEYS.ko}`,
					name: resumeFileName('ko', ownerName),
					key: RESUME_PDF_KEYS.ko,
				},
				{
					kind: 'pdf',
					id: `file:${RESUME_PDF_KEYS.en}`,
					name: resumeFileName('en', englishName),
					key: RESUME_PDF_KEYS.en,
				},
			],
			albums: ALBUMS,
			// 곡마다 그 앨범의 재생 목록 (음악 앱의 보관함 › 앨범과 같은 id)
			tracks: TRACKS.map((track) => ({
				...track,
				playlistId: MUSIC_ALBUMS.find((album) => album.trackIds.includes(track.id))?.id ?? ALL_SONGS,
			})),
			layout,
		});
		// 방문자가 놓은 파일 (이 브라우저에서만): 놓은 폴더 안에
		for (const { parent, ...file } of localFiles) {
			const folder = find(tree.roots, parent);
			if (folder?.kind === 'folder') folder.children.push(file);
		}
		return tree;
		// eslint-disable-next-line react-hooks/exhaustive-deps -- PROJECTS는 안만 바뀌는 배열이라 판(version)으로 다시 계산한다
	}, [posts, blogFolders, projectsVersion, documents, layout, localFiles, ownerName, englishName]);
}
