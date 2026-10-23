import { useCallback } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { useOpenDocument } from '@/apps/textedit/openDocument';
import { requestOpen } from '@/shared/lib/openRequest';
import type { LinkTarget } from './linkTarget';

/**
 * 글 본문의 링크를 연다 (같은 글 안의 자리는 부르는 쪽이 다룬다).
 * 이 사이트의 앱 항목은 그 앱에서(메모 글은 메모에서, 프로젝트는 Safari 탭으로), 저장소 문서는 Finder에서, 바깥 주소는 새 탭에서
 */
export function useOpenLink(): (target: LinkTarget) => void {
	const { openApp } = useAppState();
	const openDocument = useOpenDocument();
	return useCallback(
		(target: LinkTarget) => {
			if (target.kind === 'app') {
				openApp(target.link.app);
				requestOpen(target.link.app, target.link.id);
			} else if (target.kind === 'doc') {
				openDocument(target.path);
			} else if (target.kind === 'external') {
				window.open(target.href, '_blank', 'noopener,noreferrer');
			}
		},
		[openApp, openDocument]
	);
}
