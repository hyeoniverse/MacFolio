// 랜딩 템플릿 아홉: 같은 내용(project/landing/content.ts의 landingOf)을 서로 다른 디자인으로 그린다. 폴더 하나가 템플릿 하나다 (README.md)
import type React from 'react';
import type { Project, ProjectLook } from '@/shared/profile';
import ProductPage from './product/Page';
import FriendlyPage from './friendly/Page';
import PaperPage from './paper/Page';
import BentoPage from './bento/Page';
import KeynotePage from './keynote/Page';
import MagazinePage from './magazine/Page';
import DevtoolPage from './devtool/Page';
import RepoPage from './repo/Page';
import PlayfulPage from './playful/Page';

export type TemplateLook = Exclude<ProjectLook, 'custom'>;

export const TEMPLATE_PAGES: Record<TemplateLook, React.FC<{ project: Project }>> = {
	product: ProductPage,
	friendly: FriendlyPage,
	paper: PaperPage,
	bento: BentoPage,
	keynote: KeynotePage,
	magazine: MagazinePage,
	devtool: DevtoolPage,
	repo: RepoPage,
	playful: PlayfulPage,
};
