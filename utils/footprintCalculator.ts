const METERS_PER_FOOTPRINT = 100;

/** 100m당 발자국 1개. 값이 없거나 유효하지 않으면 0개. */
export function calculateFootprintCount(totalDistanceInMeters?: number): number {
  if (
    totalDistanceInMeters == null ||
    !Number.isFinite(totalDistanceInMeters) ||
    totalDistanceInMeters < 0
  ) {
    return 0;
  }
  return Math.floor(totalDistanceInMeters / METERS_PER_FOOTPRINT);
}
