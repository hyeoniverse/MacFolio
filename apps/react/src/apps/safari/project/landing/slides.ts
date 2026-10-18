// 발표 자료: 프로젝트에 붙인 PDF(Finder 문서, R2)를 미리보기 앱에서 연다. 데스크톱은 미리보기 창, 휴대폰은 새 탭.
// 키만 저장되어 있어 파일이 지워졌을 수 있으므로, 문서 목록에 있는 PDF일 때만 버튼을 보인다
import { useEffect } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { loadDocuments, openFileInNewTab, useDocumentEntries, type DocumentEntry } from '@/apps/finder/documents';
import { openInPreview } from '@/apps/preview/previewStore';
import type { LandingLink } from './content';

/** 키에 맞는 PDF 문서. 목록을 아직 받지 않았으면 받는다 (없거나 PDF가 아니면 null) */
export function useSlidesEntry(key: string | undefined): DocumentEntry | null {
	const entries = useDocumentEntries();
	useEffect(() => {
		if (key) void loadDocuments();
	}, [key]);
	if (!key) return null;
	return entries.find((entry) => entry.key === key && entry.kind === 'pdf') ?? null;
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

/** 링크 묶음에서 문서 목록에 없는 발표 자료를 뺀다 (첫 링크 표시 data-primary가 빈 자리에 붙지 않게 그리기 전에) */
export function useShownLinks(links: LandingLink[]): { links: LandingLink[]; openSlides: () => void } {
	const key = links.find((link) => link.kind === 'slides')?.key;
	const entry = useSlidesEntry(key);
	const open = useOpenSlides();
	return {
		links: entry ? links : links.filter((link) => link.kind !== 'slides'),
		openSlides: () => {
			if (entry) open(entry);
		},
	};
}
