import React from 'react';
import Container from '../common/Container';
import { useAppState } from '../../contexts/AppContext';
import '../../styles/Container.css';

const Blog: React.FC = () => {
  const { apps, bringAppToFront } = useAppState();

  // 'blog' 앱의 실행 상태 및 최소화 상태를 가져옴
  const isRunning = apps.blog.isRunning;
  const isMinimized = apps.blog.isMinimized;

  // 현재 blog 앱이 상위에 있는지 확인 (가장 높은 zIndex 값을 가진 앱인지)
  const isTopApp = Object.values(apps).every(app => app.zIndex <= apps.blog.zIndex);

  // 앱이 실행 중이 아닌 경우나 최소화된 경우에는 렌더링하지 않음
  if (!isRunning || isMinimized) return null;

  return (
    <Container
      title="My Blog"
      appName="blog"
      appStyle={{
        overflow: 'hidden',  // 스크롤을 없앰
      }}
    >
      <div
        style={{
          position: 'relative', 
          width: '100%', 
          height: '100%'
        }}
      >
        {/* Iframe을 오버레이 아래에 배치 */}
        <iframe
          src="https://codingkirby.github.io/"
          title="GitHub Pages"
          style={{
            border: 'none', 
            width: '100%', 
            height: '100%', 
            display: 'block',
          }}
          allowFullScreen
        ></iframe>
        {/* 오버레이 div, 클릭 이벤트 처리. blog 앱이 상위에 있지 않을 때만 표시 */}
        {!isTopApp && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
              cursor: 'pointer',
              backgroundColor: 'transparent',  // 투명한 오버레이
            }}
            onClick={() => bringAppToFront('blog')}
          ></div>
        )}
      </div>
    </Container>
  );
};

export default Blog;
