// 랜딩 템플릿 넷: 같은 내용(project/landing/content.ts의 landingOf)을 서로 다른 디자인으로 그린다. 폴더 하나가 템플릿 하나다 (README.md)
import type React from 'react';
import type { Project, ProjectLook } from '@/shared/profile';
import ProductPage from './product/Page';
import FriendlyPage from './friendly/Page';
import PaperPage from './paper/Page';
import BentoPage from './bento/Page';

export type TemplateLook = Exclude<ProjectLook, 'dialogue' | 'custom'>;

export const TEMPLATE_PAGES: Record<TemplateLook, React.FC<{ project: Project }>> = {
	product: ProductPage,
	friendly: FriendlyPage,
	paper: PaperPage,
	bento: BentoPage,
};
