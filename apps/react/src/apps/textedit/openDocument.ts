// 문서 열기: 데스크톱은 텍스트 편집기 창, 휴대폰은 파일 앱 안에서 (iOS에는 텍스트 편집기가 없다).
// Apple 메뉴의 개인정보 처리 방침, 메모 글의 저장소 문서 링크, Finder의 .md 파일이 모두 이 길로 연다
import { useAppState } from '@/desktop/useAppState';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { requestFinderDoc } from '@/apps/finder/openDoc';
import { openInTextEdit } from './textEditStore';

export function useOpenDocument(): (path: string) => void {
	const mobile = useIsMobile();
	const { openApp, bringAppToFront } = useAppState();
	return (path) => {
		if (mobile) {
			requestFinderDoc(path);
			openApp('finder');
			return;
		}
		openInTextEdit(path);
		openApp('textedit');
		bringAppToFront('textedit');
	};
}
