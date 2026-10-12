// 랜딩 페이지 키트: 템플릿(*Page.tsx)이 함께 쓰는 히어로·구역 조각 (쓰는 법은 README.md)
export { DeviceFrame, type DeviceFrameProps, type DeviceKind } from './DeviceFrame';
export { MockScreen, type MockScreenProps } from './MockScreen';
export { FeatureVisual, type FeatureVisualProps } from './FeatureVisual';
export { GlowBackdrop, type GlowBackdropProps } from './GlowBackdrop';
export { StatBand, type StatBandProps } from './StatBand';
export { LogoStrip, type LogoStripProps } from './LogoStrip';
export { CtaBand, type CtaBandProps } from './CtaBand';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { BentoGrid, type BentoGridProps } from './BentoGrid';
export { bentoLayout, BENTO_COLUMNS, type BentoCell } from './bento';
export {
	pickMockKind,
	MOCK_KINDS,
	FEATURE_VARIANTS,
	type FeatureVariant,
	mockSeries,
	parseFactNumber,
	shortName,
	iconOf,
	type MockKind,
} from './mock';
export { accentVars, useLandingAccent } from './accent';
