// Re-exports of pure helpers so unit tests can import them without pulling
// in .astro files (which Vitest cannot parse).
export { formatTick, jitter, linearScale, niceTicks, toNumbers } from "../components/charts/chart-utils";
export { roman } from "./roman";
