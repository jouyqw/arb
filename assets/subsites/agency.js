document.querySelectorAll('[data-demo-view]').forEach(button=>button.addEventListener('click',()=>{
 const section=button.closest('.design-section');
 section.querySelector('.showcase-stage').classList.toggle('is-mobile',button.dataset.demoView==='mobile');
 section.querySelectorAll('[data-demo-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
