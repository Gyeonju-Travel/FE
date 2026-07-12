import { BadgeTone } from '@/components/ui/Badge';

interface PlaceTagStyle {
  tone: BadgeTone;
  dot?: boolean;
  icon?: ReturnType<typeof require>;
}

// 장소 카드/시트에서 쓰이는 편의시설 태그의 뱃지 스타일 매핑 (반드시 디자인 시안의 라벨과 일치)
export const PLACE_TAG_STYLE: Record<string, PlaceTagStyle> = {
  '실내석': { tone: 'sage', dot: true },
  '야외석': { tone: 'coral', dot: true },
  '애견동반석': { tone: 'neutral', dot: true },
  '리드줄': { tone: 'sage', icon: require('@/assets/icons/pet-collar.png') },
  '이동장': { tone: 'coral', icon: require('@/assets/icons/pet-transport.png') },
  '애견유모차': { tone: 'neutral', icon: require('@/assets/icons/stroller.png') },
};

export const DEFAULT_PLACE_TAG_STYLE: PlaceTagStyle = { tone: 'neutral', dot: true };

interface CategoryBadgeStyle {
  tone: BadgeTone;
  icon: ReturnType<typeof require>;
}

export const CATEGORY_BADGE_STYLE: Record<string, CategoryBadgeStyle> = {
  카페: { tone: 'coral', icon: require('@/assets/icons/hot-coffee.png') },
  관광지: { tone: 'sage', icon: require('@/assets/icons/tour-spot.png') },
  식당: { tone: 'neutral', icon: require('@/assets/icons/spoon-and-fork.png') },
};
