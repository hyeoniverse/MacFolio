// 자리표: cinema 모양은 아직 쓰는 중이다. 담당이 이 파일을 통째로 바꾼다
import React from 'react';
import type { Project } from '@/shared/profile';
import ShowcasePage from '@/apps/safari/project/ShowcasePage';

const CinemaPage: React.FC<{ project: Project }> = ({ project }) => <ShowcasePage project={project} />;

export default CinemaPage;
