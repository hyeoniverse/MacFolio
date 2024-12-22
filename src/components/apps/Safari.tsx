import React, { useEffect } from 'react';
import Container from '../common/Container';
import { useAppState } from '../../contexts/AppContext';
import '../../styles/Safari.css';
import '../../styles/Container.css';

const Safari: React.FC = () => {
  const imageUrl = `${process.env.REACT_APP_IMAGE_URL}`;
  
  // useAppState를 이용해 앱 상태를 관리
  const { apps, closeApp, minimizeApp } = useAppState();

  // 'safari' 앱의 실행 상태 및 최소화 상태를 가져옴
  const isRunning = apps.safari.isRunning;
  const isMinimized = apps.safari.isMinimized;

  // 프로젝트 데이터
  const projects = [
    {
      imgSrc: `${imageUrl}/sproutfarm.png`,
      title: 'SproutFarm',
      subtitle: '새싹 농장🌱',
      description: '캐주얼 픽셀 미니게임',
      link: 'https://codingkirby.github.io/SproutFarm/'
    },
    {
      imgSrc: `${imageUrl}/purrfectday.png`,
      title: 'PurrFectDay.',
      subtitle: '퍼펙데이.',
      description: '고양이와 함께 나만의 방을 만들어가는 귀여운 투두리스트😻',
      link: 'https://codingkirby.github.io/projects/PurrFectDay'
    },
    {
      imgSrc: `${imageUrl}/chatbuddy.png`,
      title: 'CHATBuddy',
      subtitle: '챗벗👀',
      description: '우울감을 지닌 청년들을 위한 AI 채팅 서비스',
      link: 'https://codingkirby.github.io/projects/CHATBuddy'
    }
  ];

  // 앱이 실행 중이 아닌 경우나 최소화된 경우에는 렌더링하지 않음
  if (!isRunning || isMinimized) return null;

  return (
    <Container title="Portfolio" appName="safari">
      <header>
        <h1><strong>김정현의 포트폴리오</strong></h1>
        <p>안녕하세요, 늘 고민하는 개발자 김정현입니다.<br />제 프로젝트들을 소개합니다.</p>
      </header>
      <div className="projects">
        {projects.map((project, index) => (
          <div key={index} className="project">
            <div className="img-container">
              <img src={project.imgSrc} alt={project.title} />
            </div>
            <h2>{project.title}</h2>
            <h2>{project.subtitle}</h2>
            <span>{project.description}</span>
            <button onClick={() => window.open(project.link, '_blank')}>자세히 보러가기</button>
          </div>
        ))}
      </div>
    </Container>
  );
};

export default Safari;
