// 직접 짠 페이지: 템플릿(모양)으로는 모자라 프로젝트 하나를 위해 코드로 짠 페이지. 프로젝트 id로 등록하고, look을 'custom'으로 두면 쓴다.
// 등록이 없는 프로젝트가 custom을 고르면 기본 모양(showcase)으로 그린다
import type React from 'react';
import type { Project } from '@/shared/profile';
import SproutFarmPage from '@/apps/safari/project/custom/SproutFarmPage';

export const CUSTOM_PAGES: Record<string, React.FC<{ project: Project }>> = {
	sproutfarm: SproutFarmPage,
};

export const hasCustomPage = (id: string) => id in CUSTOM_PAGES;
