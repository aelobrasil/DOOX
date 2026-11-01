// Legacy IDs 11–20 map to a valid current character without changing stored orders.
export const avatarCount=10;
export function avatarIndex(index){const n=Number(index);return Number.isFinite(n)?Math.max(0,Math.trunc(n))%avatarCount:0}
// Explicit source rectangles exclude adjacent characters; the UI adds its own margin.
const frames=[[0,25,400,380],[430,25,335,380],[790,25,385,380],[1190,25,375,380],[1570,25,413,380],[30,410,350,360],[400,410,395,360],[810,410,380,360],[1205,410,340,360],[1570,410,413,360]];
export function avatarPosition(index){const [x,y,w,h]=frames[avatarIndex(index)];return `${x/(1983-w)*100}% ${y/(793-h)*100}%`}
export function avatarStyle(index){const [, ,w,h]=frames[avatarIndex(index)];return `--avatar-position:${avatarPosition(index)};--avatar-size:${1983/w*100}% ${793/h*100}%`}
export function applyAvatar(element,index){if(element)element.style.cssText=avatarStyle(index)}
