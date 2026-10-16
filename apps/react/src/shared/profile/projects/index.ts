// 프로젝트. 프로젝트를 더하거나 빼는 곳은 여기 한 곳이다 (프로젝트마다 한 파일, 순서는 이 목록).
import { HYEONIVERSE } from './hyeoniverse';
import { MACFOLIO } from './macfolio';
import { NEWPICK } from './newpick';
import { QRU } from './qru';
import { WHATTODO } from './whattodo';
import { SPROUTFARM } from './sproutfarm';
import { DEVCOURSE } from './devcourse';
import type { Project } from '../types';

/**
 * 프로젝트의 기본값 (코드). 내용은 각 저장소 README를 따른다.
 * 관리자가 시스템 설정 › 프로젝트에서 고친 것은 서버에 덮어쓸 값으로 두고, 앱을 그리기 전에 아래 PROJECTS에 합친다
 * (shared/site/siteContent.ts). 그래서 코드를 고치지 않고도 순서를 바꾸고, 숨기고, 고치고, 새 프로젝트를 더할 수 있다
 */
export const DEFAULT_PROJECTS: readonly Project[] = [
	HYEONIVERSE,
	MACFOLIO,
	NEWPICK,
	QRU,
	WHATTODO,
	SPROUTFARM,
	DEVCOURSE,
];

/**
 * 보일 프로젝트. Safari 탭, Finder의 프로젝트 폴더, 터미널 projects와 단축어, 사진 앨범, 프로젝트 앱(Dock·Launchpad),
 * GitHub 앱의 스냅샷이 모두 이 목록을 이 순서대로 쓴다.
 * 처음에는 기본값 그대로이고, 앱을 그리기 전에 서버의 내용을 합친다 (shared/site/siteContent.ts의 applySiteContent).
 * 여러 모듈이 읽을 때 한 번 계산해 두므로, 배열을 바꾸지 않고 그 안을 채운다
 */
export const PROJECTS: Project[] = [...DEFAULT_PROJECTS];
