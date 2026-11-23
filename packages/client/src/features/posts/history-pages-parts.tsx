export const historyPageCss = `
  :root { color-scheme: light dark; font: 16px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:CanvasText; background:Canvas; }
  * { box-sizing:border-box; }
  body { margin:0; }
  a { color:inherit; text-underline-offset:.2em; }
  header, main { max-width:70rem; margin:auto; padding:1rem 1.25rem; }
  header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; border-bottom:1px solid color-mix(in srgb,CanvasText 16%,Canvas); }
  header a { font-weight:700; text-decoration:none; }
  nav { display:flex; flex-wrap:wrap; gap:.8rem; }
  main { max-width:58rem; padding-top:clamp(1.5rem,4vw,3rem); }
  h1 { line-height:1.2; letter-spacing:-.025em; }
  .meta { color:GrayText; font-size:.9rem; }
  .notice { border-left:3px solid color-mix(in srgb,CanvasText 35%,Canvas); padding:.45rem .8rem; }
  .revision, .frame { margin:1rem 0; border:1px solid color-mix(in srgb,CanvasText 18%,Canvas); border-radius:.75rem; }
  summary { cursor:pointer; padding:1rem; }
  summary span { display:block; color:GrayText; font-size:.88rem; }
  .revision-body, .frame-body { padding:0 1rem 1rem; overflow-wrap:anywhere; }
  .revision-body > div, .frame-body > div { line-height:1.8; }
  .forms { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1rem; }
  button { min-height:2.75rem; border:1px solid color-mix(in srgb,CanvasText 24%,Canvas); border-radius:.55rem; padding:.55rem .8rem; background:Canvas; color:CanvasText; font:inherit; cursor:pointer; }
  .danger { color:#b42318; }
  .pager { display:flex; justify-content:center; gap:1rem; padding:1.5rem; }
  .empty { margin:3rem 0; text-align:center; color:GrayText; }
  @media(max-width:36rem) { header { align-items:flex-start; flex-direction:column; } }
`;
