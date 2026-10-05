import { createRoot } from 'react-dom/client';
import ApiReference from '@/apps/apidocs/page/ApiReference';

// api-docs.html의 시작점. 'API 문서' 앱이 iframe으로 띄운다.
// Scalar는 목차를 누를 때마다 pushState로 방문 기록을 쌓는다. iframe의 기록도 사이트의 뒤로 가기에 섞이므로,
// 이 페이지에서는 기록을 쌓지 않고 바꾸기만 한다 (사이트에서 뒤로 가기는 "사이트 밖으로", memo/content/app-links.md)
history.pushState = history.replaceState.bind(history);

createRoot(document.getElementById('root')!).render(<ApiReference />);
