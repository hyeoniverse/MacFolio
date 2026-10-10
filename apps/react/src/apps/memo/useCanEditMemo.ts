import { useAdmin } from '@/shared/auth/adminStore';

/**
 * 메모를 편집(폴더 만들기·이름 변경·삭제, 끌어 옮기기, 고정)할 수 있는지: 관리자로 로그인했을 때만.
 * 화면에서 편집 단추를 보여 줄지만 정한다. 저장할 때마다 서버가 세션을 다시 확인하므로,
 * 브라우저에서 이 값을 바꿔도 저장은 되지 않는다.
 */
export function useCanEditMemo(): boolean {
	return useAdmin().status === 'signed-in';
}
