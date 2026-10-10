import React from 'react';
import type { Quota } from './liveDemo';

/** 남은 횟수 칩: 받기 전에는 하루 상한을 */
export const QuotaChip: React.FC<{ quota: Quota | null; fallback: number }> = ({ quota, fallback }) => (
	<span className="cd-chip">{quota ? `오늘 ${quota.remaining}번 남음` : `하루 ${fallback}번`}</span>
);
