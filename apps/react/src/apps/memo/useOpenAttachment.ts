import { useCallback } from 'react';
import { useAppState } from '@/desktop/useAppState';
import { openInPreview } from '@/apps/preview/previewStore';
import { openInTextEdit } from '@/apps/textedit/textEditStore';
import { requestOpen } from '@/shared/lib/openRequest';
import { FILE_TAB_PREFIX, fileAppOf, rememberFileName } from '@/shared/lib/fileApps';

/**
 * 글에 올린 첨부 파일을 사이트 안의 앱으로 연다 (Finder에서 파일을 여는 것과 같은 앱):
 * PDF·그림은 미리보기, Markdown·글자 파일은 텍스트 편집기, HTML은 Safari의 새 탭.
 * 맞는 앱이 없으면 false (부르는 쪽이 브라우저 기본대로 연다)
 */
export function useOpenAttachment(): (url: string, name: string) => boolean {
	const { openApp, bringAppToFront } = useAppState();
	return useCallback(
		(url: string, name: string) => {
			const target = fileAppOf(name);
			if (!target) return false;
			rememberFileName(url, name);
			openApp(target.app);
			bringAppToFront(target.app);
			if (target.app === 'preview') openInPreview({ key: url, name, kind: target.kind });
			else if (target.app === 'textedit') openInTextEdit(url);
			else requestOpen('safari', `${FILE_TAB_PREFIX}${url}`);
			return true;
		},
		[openApp, bringAppToFront]
	);
}
