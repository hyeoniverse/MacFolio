// 앱 아이콘 주소. manifest의 icon은 보통 이미지 폴더 기준 경로(예: finder.png, projects/qru/app-icon.png)이고,
// 관리자가 올린 그림이면 절대 주소(https://…/files/<id>)다. 둘 다 받는다
import { env } from '@/shared/config/env';

export const appIconUrl = (icon: string) =>
	/^(https?:)?\/\//.test(icon) || icon.startsWith('/') ? icon : `${env.imageUrl}/${icon}`;
