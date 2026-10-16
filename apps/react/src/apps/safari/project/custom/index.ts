// 직접 짠 페이지: 템플릿(모양)으로는 모자라 프로젝트 하나를 위해 코드로 짠 페이지. 프로젝트 id로 등록하고, look을 'custom'으로 두면 쓴다.
// 코드에 있는 일곱 프로젝트는 모두 자기 페이지가 있다. 등록이 없는 프로젝트가 custom을 고르면 기본 모양(showcase)으로 그린다.
// tone은 <article data-look>에 들어가는 이름: 그 페이지의 CSS(와 함께 쓰는 조각의 CSS)가 .sp[data-look='…']로 색을 맞추므로 원래 이름을 지킨다
import type React from 'react';
import type { Project } from '@/shared/profile';
import MacFolioPage from '@/apps/safari/project/custom/MacFolioPage';
import NewPickPage from '@/apps/safari/project/custom/NewPickPage';
import WhatToDoPage from '@/apps/safari/project/custom/WhatToDoPage';
import QruPage from '@/apps/safari/project/custom/QruPage';
import SproutFarmPage from '@/apps/safari/project/custom/SproutFarmPage';
import DevCoursePage from '@/apps/safari/project/custom/DevCoursePage';
import HyeoniversePage from '@/apps/safari/project/custom/HyeoniversePage';

export interface CustomPage {
	page: React.FC<{ project: Project }>;
	tone: string;
}

export const CUSTOM_PAGES: Record<string, CustomPage> = {
	macfolio: { page: MacFolioPage, tone: 'product' },
	newpick: { page: NewPickPage, tone: 'editorial' },
	whattodo: { page: WhatToDoPage, tone: 'playful' },
	qru: { page: QruPage, tone: 'minimal' },
	sproutfarm: { page: SproutFarmPage, tone: 'game' },
	devcourse: { page: DevCoursePage, tone: 'terminal' },
	hyeoniverse: { page: HyeoniversePage, tone: 'creative' },
};

export const hasCustomPage = (id: string) => id in CUSTOM_PAGES;
