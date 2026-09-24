/** Inline script run before first paint so a chosen light/dark theme never flashes. */
export const THEME_BOOTSTRAP = `try{var t=JSON.parse(localStorage.getItem("cueframe:pref:theme")||'"system"');if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
