// 사이트 콘텐츠(관리자가 고친 프로필·프로젝트)를 먼저 합치고, 그다음에 앱을 불러온다.
// 앱 목록·Safari 탭 같은 모듈이 프로젝트 목록을 불러올 때 한 번 계산해 두기 때문이다 (shared/site/siteContent.ts)
import { loadSiteContent } from '@/shared/site/siteContent';

void loadSiteContent().finally(() => import('./boot'));
