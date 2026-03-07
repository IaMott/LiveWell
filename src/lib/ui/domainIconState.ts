import { Domain } from "../ai/types";

export type IconState = {
  activeDomain: Domain;
  activeColor: string; // from tokens, e.g. "var(--tint)"
  inactiveColor: string; // e.g. "var(--textTertiary)"
};

export function getIconStrokeColor(domain: Domain, state: IconState): string {
  return domain === state.activeDomain ? state.activeColor : state.inactiveColor;
}
