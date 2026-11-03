// Legacy IDs 11–20 map to a valid current character without changing stored orders.
export const avatarCount=10;
export function avatarIndex(index){const n=Number(index);return Number.isFinite(n)?Math.max(0,Math.trunc(n))%avatarCount:0}
// Ten isolated equal cells in the five-column, two-row production atlas.
export function avatarPosition(index){const i=avatarIndex(index);return `${i%5*25}% ${Math.floor(i/5)*100}%`}
export function avatarStyle(index){return `--avatar-position:${avatarPosition(index)};--avatar-size:500% 200%`}
export function applyAvatar(element,index){if(element)element.style.cssText=avatarStyle(index)}
