// Global singleton to persist feed state across navigation
export const feedState = {
  paused: false,
  alerts: [] as unknown[],
  count:  0,
}