/* Keep the mobile navigation state available to keyboard and screen-reader users. */
(() => {
  const menu = document.querySelector('.menu-btn');
  const nav = document.getElementById('mnav');
  if (!menu || !nav) return;
  const setOpen = (open, returnFocus = false) => {
    nav.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    if (returnFocus) menu.focus();
  };
  menu.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false, true);
  });
  document.addEventListener('click', e => {
    if (!nav.contains(e.target) && !menu.contains(e.target)) setOpen(false);
  });
  const desktop = matchMedia('(min-width:1101px)');
  desktop.addEventListener('change', e => { if (e.matches) setOpen(false); });
})();
