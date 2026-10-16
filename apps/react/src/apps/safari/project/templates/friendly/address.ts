// friendly 창 틀 위 막대에 보일 주소 (첫 화면, 기능 탐색기, 화면 모음의 창이 함께 쓴다)
import type { Landing } from '@/apps/safari/project/landing';

/** 창 틀 위 막대에 보일 주소: 데모나 저장소의 호스트, 없으면 이름 */
export function addressOf(landing: Landing) {
	for (const link of landing.hero.links) {
		if (link.kind === 'app') continue;
		try {
			return new URL(link.href).host;
		} catch {
			// 주소가 아니면 다음 링크
		}
	}
	return landing.hero.name;
}
