document.querySelectorAll('[data-demo-view]').forEach(button=>button.addEventListener('click',()=>{
 const section=button.closest('.design-section');
 section.querySelector('.showcase-stage').classList.toggle('is-mobile',button.dataset.demoView==='mobile');
 section.querySelectorAll('[data-demo-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
document.querySelectorAll('.service-ribbon').forEach(ribbon=>{
 const button=ribbon.querySelector('.ribbon-toggle');
 button.addEventListener('click',()=>{
  const paused=ribbon.classList.toggle('ribbon-paused');
  button.setAttribute('aria-pressed',String(paused));
  button.setAttribute('aria-label',paused?'서비스 띠 움직임 재생':'서비스 띠 움직임 정지');
  button.textContent=paused?'다시 재생 ▷':'일시정지 Ⅱ';
 });
 const syncVisibility=()=>ribbon.classList.toggle('ribbon-hidden',document.hidden);
 document.addEventListener('visibilitychange',syncVisibility);
 syncVisibility();
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>ribbon.classList.toggle('ribbon-offscreen',!entries[0].isIntersecting));observer.observe(ribbon);}
});
