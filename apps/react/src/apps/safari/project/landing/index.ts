// 랜딩 키트: 네 템플릿(project/templates/*)이 함께 쓰는 공통 내용(content.ts)과 작은 조각. 쓰는 법은 templates/README.md
import './landing.css';

export * from './content';
export { useLanding } from './useLanding';
export { LandingLinks } from './LandingLinks';
export { Media, PointArt, PointVisual } from './Media';
export { DeployList, FaIcon, MemberAvatar, TeamList, TroubleList } from './Extras';
export { LandingSections, type SectionRenderer, type SectionRenderers } from './Sections';
export { accentVars, useLandingAccent } from './accent';
