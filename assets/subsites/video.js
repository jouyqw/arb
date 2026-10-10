document.querySelectorAll('.interior-film').forEach(video=>{
 const button=video.parentElement.querySelector('.film-toggle'),mobile=matchMedia('(max-width:600px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let userPaused=false,visible=false,selected='';
 const label=()=>{button.textContent=video.paused?'영상 재생 ▷':'영상 정지 Ⅱ';button.setAttribute('aria-label',video.paused?'공간 영상 재생':'공간 영상 정지');};
 const source=()=>{const next=mobile.matches?video.dataset.mobile:video.dataset.desktop;if(selected!==next){selected=next;video.src=next;video.load();}};
 const sync=()=>{if(visible&&!document.hidden&&!userPaused&&!reduced.matches&&!navigator.connection?.saveData){source();video.play().catch(label);}else video.pause();};
 button.addEventListener('click',()=>{if(video.paused){userPaused=false;source();video.play().catch(label);}else{userPaused=true;video.pause();}});
 video.addEventListener('play',label);video.addEventListener('pause',label);video.addEventListener('error',()=>{button.textContent='영상 다시 재생 ▷';});
 mobile.addEventListener('change',()=>{if(selected)source();sync();});reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.1}).observe(video);else{visible=true;sync();}
});
