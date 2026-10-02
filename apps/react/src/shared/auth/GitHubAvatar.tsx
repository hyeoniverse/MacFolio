import { useLayoutEffect, useRef, useState } from 'react';
import { avatarUrl } from '@/shared/auth/admin';
import '@/shared/auth/GitHubAvatar.css';

/**
 * GitHub 프로필 사진. github.com에서 받는 데 오래 걸릴 때가 있어서, 받는 동안과 받지 못했을 때는
 * 회색 사람 아이콘을 보여 주고, 다 받으면 그 위에 사진을 살짝 띄운다 (자리가 비어 보이지 않게).
 * 크기는 className으로 정한다.
 */
const GitHubAvatar = ({ login, className = '' }: { login: string; className?: string }) => {
	const image = useRef<HTMLImageElement>(null);
	const [loaded, setLoaded] = useState(false);
	// 캐시에 있어 그리기 전에 이미 받은 사진은 load 이벤트를 놓칠 수 있다
	useLayoutEffect(() => {
		if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
	}, []);

	return (
		<span className={`github-avatar ${className}`} data-loaded={loaded || undefined}>
			<i className="fa-solid fa-user" aria-hidden="true" />
			<img ref={image} src={avatarUrl(login)} alt="" onLoad={() => setLoaded(true)} />
		</span>
	);
};

export default GitHubAvatar;
