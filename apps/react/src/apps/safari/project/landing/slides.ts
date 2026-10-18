// 발표 자료: 프로젝트 폴더(Finder › 프로젝트 › <프로젝트>, 문서 폴더 값 project:<id>)에 올린 PDF를 미리보기 앱에서 연다.
// 데스크톱은 미리보기 창, 휴대폰은 새 탭. PDF가 여럿이면 이름순(한국어) 첫 파일. 폴더에 PDF가 없으면 버튼을 보이지 않는다
import { useEffect } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
	loadDocuments,
	openFileInNewTab,
	projectFolderValue,
	useDocumentEntries,
	type DocumentEntry,
} from '@/apps/finder/documents';
import { openInPreview } from '@/apps/preview/previewStore';
import type { LandingLink } from './content';

/** 프로젝트 폴더의 PDF 가운데 이름순 첫 파일 */
export function firstProjectPdf(entries: DocumentEntry[], projectId: string): DocumentEntry | null {
	const folder = projectFolderValue(projectId);
	return (
		entries
			.filter((entry) => entry.folder === folder && entry.kind === 'pdf')
			.sort((a, b) => a.name.localeCompare(b.name, 'ko'))[0] ?? null
	);
}

/** 프로젝트의 발표 자료 (프로젝트 폴더의 첫 PDF). 목록을 아직 받지 않았으면 받는다. 없으면 null */
export function useProjectSlides(projectId: string | undefined): DocumentEntry | null {
	const entries = useDocumentEntries();
	useEffect(() => {
		if (projectId) void loadDocuments();
	}, [projectId]);
	return projectId ? firstProjectPdf(entries, projectId) : null;
}

/** 발표 자료를 여는 함수: 미리보기 앱을 열어 맨 앞으로 올리고 그 PDF를 보인다 (휴대폰은 새 탭) */
export function useOpenSlides(): (entry: DocumentEntry) => void {
	const { openApp, bringAppToFront } = useAppState();
	const mobile = useIsMobile();
	return (entry) => {
		if (mobile) {
			openFileInNewTab(entry.key);
			return;
		}
		openApp('preview');
		bringAppToFront('preview');
		openInPreview({ key: entry.key, name: entry.name, kind: 'pdf', size: entry.size });
	};
}

/** 링크 묶음에서 PDF가 없는 발표 자료를 뺀다 (첫 링크 표시 data-primary가 빈 자리에 붙지 않게 그리기 전에) */
export function useShownLinks(links: LandingLink[]): { links: LandingLink[]; openSlides: () => void } {
	const projectId = links.find((link) => link.kind === 'slides')?.projectId;
	const entry = useProjectSlides(projectId);
	const open = useOpenSlides();
	return {
		links: entry ? links : links.filter((link) => link.kind !== 'slides'),
		openSlides: () => {
			if (entry) open(entry);
		},
	};
}
