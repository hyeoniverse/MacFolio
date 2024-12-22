import React, { useEffect, useRef } from 'react';
import { SearchInputProps } from '../../../types/MemoTypes';

const SearchInput: React.FC<SearchInputProps> = ({ searchQuery, setSearchQuery }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색창 외부 클릭 시 포커스 해제
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // inputRef가 현재 클릭된 요소인지 확인
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        inputRef.current.blur();  // 검색창 포커스 해제
      }
    };

    // 마우스 다운 이벤트 등록
    document.addEventListener('mousedown', handleClickOutside);

    // 언마운트 시 이벤트 해제
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="search-input">
      <input
        ref={inputRef}
        type="text"
        placeholder="메모 검색"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClick={(e) => e.stopPropagation()}  // 검색창 클릭 시 이벤트 전파 중지
      />
    </div>
  );
};

export default SearchInput;
