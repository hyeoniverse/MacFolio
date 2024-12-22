import React, { ReactNode } from 'react';

interface ScrollAreaProps {
  className?: string;
  children: ReactNode; // children을 명시적으로 정의
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className }) => {
  return (
    <div className={`overflow-auto ${className}`} style={{ maxHeight: 'calc(100vh - 60px)' }}>
      {children}
    </div>
  );
};

export default ScrollArea;