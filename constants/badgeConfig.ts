import type { FC } from 'react';
import { BadgeTone } from '@/components/ui/Badge';
import BadgeLeashIcon from '@/assets/icons/badge-leash.svg';
import BadgeCarrierIcon from '@/assets/icons/badge-carrier.svg';
import BadgeStrollerIcon from '@/assets/icons/badge-stroller.svg';
import FilterCafeIcon from '@/assets/icons/filter-cafe.svg';
import FilterTourIcon from '@/assets/icons/filter-tour.svg';
import FilterFoodIcon from '@/assets/icons/filter-food.svg';

export type BadgeIconComponent = FC<{ width?: number; height?: number; color?: string }>;

interface PlaceTagStyle {
  tone: BadgeTone;
  dot?: boolean;
  Icon?: BadgeIconComponent;
}

// 장소 카드/시트에서 쓰이는 편의시설 태그의 뱃지 스타일 매핑 (반드시 디자인 시안의 라벨과 일치)
export const PLACE_TAG_STYLE: Record<string, PlaceTagStyle> = {
  '실내석': { tone: 'sage', dot: true },
  '야외석': { tone: 'coral', dot: true },
  '애견동반석': { tone: 'neutral', dot: true },
  '리드줄': { tone: 'sage', Icon: BadgeLeashIcon },
  '이동장': { tone: 'coral', Icon: BadgeCarrierIcon },
  '애견유모차': { tone: 'neutral', Icon: BadgeStrollerIcon },
};

export const DEFAULT_PLACE_TAG_STYLE: PlaceTagStyle = { tone: 'neutral', dot: true };

interface CategoryBadgeStyle {
  tone: BadgeTone;
  Icon: BadgeIconComponent;
}

export const CATEGORY_BADGE_STYLE: Record<string, CategoryBadgeStyle> = {
  카페: { tone: 'coral', Icon: FilterCafeIcon },
  관광지: { tone: 'sage', Icon: FilterTourIcon },
  식당: { tone: 'neutral', Icon: FilterFoodIcon },
};
