(() => {
 if(document.getElementById('arb-contact-ui'))return;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/assets/subsites/shared-contact.css?v=20261126';document.head.append(style);
 const host=document.createElement('div');host.id='arb-contact-ui';
 host.innerHTML=`<aside class="arb-review" aria-label="홈페이지 제작 고객 후기"><button type="button" aria-label="후기 닫기">×</button><small>홈페이지 제작 고객 후기</small><strong>새로고침 인테리어</strong><p>홈페이지 제작 후 문의량이 늘었다는<br>피드백을 주셨습니다.</p><a href="https://interior-f5.com/" target="_blank" rel="noopener noreferrer">제작 홈페이지 보기 ↗</a></aside><nav class="arb-contact" aria-label="빠른 상담"><a class="arb-call" href="tel:01055010152"><span>전화 상담</span><small>010-5501-0152</small></a><a class="arb-chat" href="https://pf.kakao.com/_wxjxiSX/chat" target="_blank" rel="noopener noreferrer"><span>카카오톡 상담</span><small>프로젝트 문의 ↗</small></a></nav>`;
 document.body.append(host);host.querySelector('button').addEventListener('click',()=>host.querySelector('.arb-review').remove());
 const ribbon=document.createElement('aside');ribbon.className='arb-banner';ribbon.setAttribute('aria-label','홈페이지 제작 및 마케팅 상담');ribbon.innerHTML='<span>홈페이지 제작부터 검색·숏폼 마케팅까지</span><a href="https://pf.kakao.com/_wxjxiSX/chat" target="_blank" rel="noopener noreferrer">프로젝트 상담 ↗</a>';
 const hero=document.querySelector('.cinema-hero, .hero, main');if(hero)hero.after(ribbon);else document.body.prepend(ribbon);
})();
