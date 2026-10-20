import { createContext } from 'react';

/** 시트를 그릴 곳: 편집 화면이 깔아 두는 자리(host)와, 시트가 열린 동안 막아 둘 바탕(background) */
export const SheetHostContext = createContext<{ host: HTMLElement | null; background: HTMLElement | null }>({
	host: null,
	background: null,
});

/** 시트 안의 한 페이지: 안쪽 목록이 항목을 열면 이 페이지를 가리고 그 자리(slot)에 다음 페이지를 민다 */
export interface SheetPageFrame {
	/** 이 페이지의 제목 (다음 페이지의 뒤로 버튼에 쓴다) */
	title: string;
	/** 이 페이지 요소 (다음 페이지가 열린 동안 숨긴다) */
	page: HTMLElement | null;
	/** 다음 페이지를 그릴 자리 */
	slot: HTMLElement | null;
}
export const SheetPageContext = createContext<SheetPageFrame | null>(null);
