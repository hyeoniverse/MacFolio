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
 * Safari 탭, Finder의 프로젝트 폴더, 터미널 projects와 단축어, GitHub 앱의 스냅샷(서버에 닿지 않을 때의 고정 저장소)이
 * 모두 이 목록을 이 순서대로 쓴다. 내용은 각 저장소 README를 따른다.
 */
export const PROJECTS: Project[] = [HYEONIVERSE, MACFOLIO, NEWPICK, QRU, WHATTODO, SPROUTFARM, DEVCOURSE];
