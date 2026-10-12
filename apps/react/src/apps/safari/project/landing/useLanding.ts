// 템플릿이 프로젝트를 랜딩 내용으로 바꿔 읽는 훅: 이 사이트 안에서 여는 앱 이름(apps/manifest.ts)을 함께 넘긴다
import { useMemo } from 'react';
import type { Project } from '@/shared/profile';
import { projectAppName } from '@/apps/manifest';
import { landingOf, type Landing } from './content';

export function useLanding(project: Project): Landing {
	return useMemo(() => landingOf(project, { app: projectAppName(project.id) }), [project]);
}
