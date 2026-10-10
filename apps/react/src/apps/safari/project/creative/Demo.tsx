// HYEONIVERSE 페이지에서 직접 만져 보는 데모: 그 사이트의 관리자 기능(슬라이드 갤러리와 음성, TTS, 파형 편집,
// PDF·PPTX 변환, 자동 번역, AI 요약, AI 커버)과 테마 프리셋을 같은 규칙으로 흉내 낸다.
// 음성 만들기·번역·요약·커버는 MacFolio API를 거쳐 실제 AI 서비스를 부른다 (하루 상한이 있다).
// 데모마다 한 파일(creative/)이고, 이 파일은 종류 → 데모를 잇는다
import React from 'react';
import type { ProjectPoint } from '@/shared/profile';
import { Convert } from './Convert';
import { Cover } from './Cover';
import { Slides } from './Slides';
import { Summary } from './Summary';
import { Translate } from './Translate';
import { Voice } from './Voice';
import { Wave } from './Wave';
import './demos.css';
import { Autosave } from './cms/Autosave';
import { Lifecycle } from './cms/Lifecycle';
import { Comments } from './cms/Comments';
import { Mailbox } from './cms/Mailbox';
import { Invite } from './cms/Invite';
import { Roles } from './cms/Roles';
import { Kitchen } from './cms/Kitchen';
import { Providers } from './cms/Providers';
import './cms/cms.css';

/** 장 글 묶음에 붙는 데모 */
export const Demo: React.FC<{ kind: NonNullable<ProjectPoint['demo']> }> = ({ kind }) => {
	if (kind === 'autosave') return <Autosave />;
	if (kind === 'lifecycle') return <Lifecycle />;
	if (kind === 'comments') return <Comments />;
	if (kind === 'mailbox') return <Mailbox />;
	if (kind === 'invite') return <Invite />;
	if (kind === 'roles') return <Roles />;
	if (kind === 'kitchen') return <Kitchen />;
	if (kind === 'providers') return <Providers />;
	if (kind === 'slides') return <Slides />;
	if (kind === 'voice') return <Voice />;
	if (kind === 'wave') return <Wave />;
	if (kind === 'convert') return <Convert />;
	if (kind === 'translate') return <Translate />;
	if (kind === 'cover') return <Cover />;
	return <Summary />;
};
