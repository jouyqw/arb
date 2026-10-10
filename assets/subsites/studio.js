const toggle = document.querySelector('.menu-button');
const nav = document.querySelector('#site-menu');
function closeMenu(){nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');}
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
nav?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();toggle?.focus();}});
matchMedia('(min-width:801px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
