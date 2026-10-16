// friendly 구역 머리의 문장: Stripe의 구역 소개처럼 두 줄로 끊은 큰 제목과 오른쪽 단의 짧은 본문.
// 공용 sectionTitle 대신 이 템플릿의 말투로 쓰고, 본문은 구역의 항목 수로만 만든다 (프로젝트에 없는 말을 지어내지 않는다)
import type { LandingSection } from '@/apps/safari/project/landing';

export interface HeadCopy {
	/** 두 줄 제목: 앞줄과 뒷줄 */
	title: [string, string];
	lead?: string;
}

export function headCopyOf(section: LandingSection): HeadCopy {
	switch (section.kind) {
		case 'stats':
			return { title: ['숫자로 보는', '프로젝트입니다.'] };
		case 'features':
			return {
				title: ['꼭 필요한 기능을', '하나씩 소개합니다.'],
				lead: `이 프로젝트가 제공하는 주요 기능 ${section.items.length}가지를 정리했습니다.`,
			};
		case 'screens':
			return {
				title: ['실제 화면으로', '먼저 살펴보세요.'],
				lead: `주요 화면 ${section.shots.length}장을 한곳에 모았습니다.`,
			};
		case 'steps':
			return {
				title: ['몇 단계만 거치면', '바로 시작할 수 있습니다.'],
				lead:
					section.items.length > 1
						? `${section.items.length}단계를 차례대로 따라가면 됩니다.`
						: '아래 한 단계만 따라가면 됩니다.',
			};
		case 'built':
			return {
				title: ['보이지 않는 곳의', '설계를 소개합니다.'],
				lead: `구현하며 내린 결정 ${section.items.length}가지를 정리했습니다.`,
			};
		case 'troubleshooting':
			return {
				title: ['문제를 만나고', '해결한 기록입니다.'],
				lead: `문제, 원인, 해결, 결과의 차례로 ${section.items.length}건을 정리했습니다.`,
			};
		case 'stories':
			return {
				title: ['숫자 너머의', '이야기를 전합니다.'],
				lead: `${section.stories.length}편의 이야기로 프로젝트를 더 깊이 소개합니다.`,
			};
		case 'controls':
			return {
				title: ['키보드만으로', '모두 다룰 수 있습니다.'],
				lead: `조작 ${section.controls.length}가지를 정리했습니다.`,
			};
		case 'tech':
			return {
				title: ['어떤 기술로', '만들었는지 소개합니다.'],
				lead: section.structure
					? '사용한 기술과 사양, 폴더 구조를 한눈에 정리했습니다.'
					: '사용한 기술과 사양을 한눈에 정리했습니다.',
			};
		case 'team':
			return {
				title: ['함께 만든', '사람들을 소개합니다.'],
				lead: `${section.members.length}명이 함께 만들었습니다.`,
			};
		case 'role':
			return { title: ['이 프로젝트에서', '맡은 일입니다.'] };
		case 'timeline':
			return {
				title: ['시작부터 마무리까지', '걸어온 길입니다.'],
				lead: `${section.entries.length}개의 이정표로 정리했습니다.`,
			};
		case 'deployments':
			return {
				title: ['결과물을', '직접 확인해 보세요.'],
				lead: `${section.items.length}곳에 배포한 결과물입니다.`,
			};
		case 'credits':
			return {
				title: ['도움을 받은', '곳을 밝힙니다.'],
				lead: '사용한 자료와 그 출처를 정리했습니다.',
			};
	}
}
