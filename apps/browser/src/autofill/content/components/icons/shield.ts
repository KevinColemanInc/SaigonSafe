// Generated SaigonSafe mark. The Shield export remains for compatibility.
import { html } from "lit";

import { IconProps } from "../common-types";
export function Shield({ ariaHidden = true, color }: IconProps) {
  return html`<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="${ariaHidden}"
  >
    <rect x="2" y="2" width="60" height="60" rx="18" fill="#087F70" />
    <path
      d="M42 20H29C17 20 17 32 29 32H35C47 32 47 44 35 44H22"
      stroke="${color || brandCream}"
      stroke-width="7"
      stroke-linecap="round"
    />
    <circle cx="49" cy="14" r="5" fill="#F27760" />
  </svg>`;
}
const brandCream = "#FFF8E9";
