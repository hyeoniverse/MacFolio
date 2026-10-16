// keynote 템플릿의 슬라이드 차례: 랜딩 내용을 발표 슬라이드 목록으로 편다 (순수 함수, deck.test.ts).
// 표지 → 구역마다 한 장 또는 여러 장(숫자·기능·화면·트러블슈팅·이야기는 하나에 한 장) → 마지막 인사.
// 트러블슈팅 한 건은 문제 → 원인 → 해결 → 결과를 한 단계씩 쌓아 올리는 빌드가 있다
import {
	iconOf,
	troubleIcon,
	troubleSteps,
	type Landing,
	type LandingMedia,
	type LandingSection,
	type LandingSectionKind,
} from '@/apps/safari/project/landing';

export type Slide =
	| { type: 'title'; key: string; name: string; builds: 1; thumb?: LandingMedia }
	| { type: 'end'; key: string; name: string; builds: 1 }
	| {
			type: 'section';
			key: string;
			name: string;
			section: LandingSection;
			/** 구역 안의 몇 번째 장 (0부터) */
			part: number;
			/** 구역의 장 수 */
			parts: number;
			builds: number;
			thumb?: LandingMedia;
			/** 그림이 없을 때 목록에 보일 아이콘 (없으면 구역 종류의 아이콘) */
			icon?: string;
	  };

/** 구역의 장 수: 하나에 한 장인 구역은 항목 수, 나머지는 한 장 */
export function partsOf(section: LandingSection): number {
	switch (section.kind) {
		case 'stats':
			return section.facts.length;
		case 'features':
			return section.items.length;
		case 'screens':
			return section.shots.length;
		case 'troubleshooting':
			return section.items.length;
		case 'stories':
			return section.stories.length;
		default:
			return 1;
	}
}

/** 슬라이드 목록에 보일 이름과 작은 그림 */
function describe(
	section: LandingSection,
	part: number
): { name: string; thumb?: LandingMedia; icon?: string; builds: number } {
	switch (section.kind) {
		case 'stats': {
			const fact = section.facts[part];
			return { name: `${fact.value} ${fact.label}`, builds: 1 };
		}
		case 'features': {
			const point = section.items[part];
			return { name: point.title, thumb: point.media[0], icon: iconOf(point, part), builds: 1 };
		}
		case 'screens': {
			const shot = section.shots[part];
			return { name: shot.caption, thumb: shot, builds: 1 };
		}
		case 'troubleshooting': {
			const item = section.items[part];
			return {
				name: item.title,
				thumb: item.image,
				icon: troubleIcon(item),
				builds: Math.max(1, troubleSteps(item).length),
			};
		}
		case 'stories': {
			const story = section.stories[part];
			return { name: story.title, thumb: story.image, builds: 1 };
		}
		default:
			return { name: section.label, builds: 1 };
	}
}

export function slidesOf(landing: Landing): Slide[] {
	const slides: Slide[] = [
		{ type: 'title', key: 'title', name: landing.hero.name, builds: 1, thumb: landing.hero.image },
	];
	for (const section of landing.sections) {
		const parts = partsOf(section);
		for (let part = 0; part < parts; part++)
			slides.push({
				type: 'section',
				key: `${section.kind}-${part}`,
				section,
				part,
				parts,
				...describe(section, part),
			});
	}
	slides.push({ type: 'end', key: 'end', name: '마무리', builds: 1 });
	return slides;
}

/** 슬라이드 목록의 아이콘 (그림이 없는 장) */
export const KIND_ICONS: Record<LandingSectionKind | 'title' | 'end', string> = {
	title: 'fa-display',
	stats: 'fa-chart-simple',
	features: 'fa-star',
	screens: 'fa-images',
	steps: 'fa-list-ol',
	built: 'fa-screwdriver-wrench',
	troubleshooting: 'fa-bug',
	stories: 'fa-book-open',
	controls: 'fa-keyboard',
	tech: 'fa-microchip',
	team: 'fa-user-group',
	role: 'fa-user-pen',
	timeline: 'fa-timeline',
	deployments: 'fa-cloud-arrow-up',
	credits: 'fa-hand-holding-heart',
	end: 'fa-flag-checkered',
};
