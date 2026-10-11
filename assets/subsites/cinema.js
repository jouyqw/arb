document.querySelectorAll('.cinema-motion-toggle').forEach(button=>button.addEventListener('click',()=>{const paused=button.closest('.cinema-hero').classList.toggle('is-paused');button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'화면 움직임 재생 ▷':'화면 움직임 정지 Ⅱ';}));
const cinema=document.querySelector('.cinema-hero');
if(cinema&&'IntersectionObserver' in window)new IntersectionObserver(entries=>document.body.classList.toggle('cinema-past',!entries[0].isIntersecting)).observe(cinema);
