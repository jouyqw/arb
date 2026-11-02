(() => {
  'use strict';
  const q = s => document.querySelector(s);
  const input=q('#copy'), status=q('#status'), list=q('#findings'), preview=q('#preview');
  const samples=['최고의 시술로 100% 완치를 약속드립니다. 부작용 없는 안전한 수술입니다.', '치료 후기와 전후 사진을 확인하세요. 오늘만 반값, 선착순으로 안내합니다.', '진료 시간은 평일 오전 9시부터 오후 6시까지입니다. 치료 계획과 발생 가능한 부작용은 진료 후 안내합니다.'];
  let sampleIndex=0, report='', timer;
  function render() {
    const value=input.value, matches=AubMedicalCheck.scan(value);
    q('#results').classList.toggle('is-empty', !value.trim());
    q('#copy-state').textContent='';
    q('#count').textContent=`${value.length.toLocaleString()} / 20,000자`;
    const urgent=matches.filter(m=>m.level==='우선 검토').length;
    q('#urgent').textContent=urgent; q('#caution').textContent=matches.length-urgent;
    status.textContent=!value.trim()?'원고를 입력하면 검수가 시작됩니다.':matches.length?`${matches.length}곳의 검토 신호가 있습니다. 문맥과 근거를 확인하세요.`:'탐지된 표현이 없습니다. 적법성·심의 통과를 의미하지 않습니다.';
    preview.replaceChildren(); list.replaceChildren();
    let pos=0;
    for(const m of matches){
      if(m.start<pos) continue;
      preview.append(document.createTextNode(value.slice(pos,m.start)));
      const mark=document.createElement('mark'); mark.textContent=value.slice(m.start,m.end); mark.title=m.title; preview.append(mark); pos=m.end;
    }
    preview.append(document.createTextNode(value.slice(pos)||(!value?'입력한 원고의 검토 지점을 여기에 표시합니다.':'')));
    for(const m of matches){
      const li=document.createElement('li');
      const badge=document.createElement('span'); badge.className=m.level==='우선 검토'?'badge urgent':'badge'; badge.textContent=m.level;
      const title=document.createElement('h3'); title.textContent=`“${m.text}” · ${m.title}`;
      const reason=document.createElement('p'); reason.textContent=m.reason;
      const suggest=document.createElement('p'); suggest.className='suggestion'; suggest.textContent=`수정 방향: ${m.suggestion}`;
      li.append(badge,title,reason,suggest); list.append(li);
    }
    q('#copy-report').disabled=!value.trim();
    report=['아비컴퍼니 의료광고 사전 점검',status.textContent,...matches.map(m=>`[${m.level}] ${m.text}: ${m.reason}\n수정 방향: ${m.suggestion}`),'자동 단어 탐지 결과이며 법률 자문·심의 승인이 아닙니다.'].join('\n\n');
  }
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,160);});
  q('#sample').addEventListener('click',()=>{input.value=samples[sampleIndex++%samples.length];render();});
  q('#clear').addEventListener('click',()=>{input.value='';render();input.focus();});
  q('#copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(report);q('#copy-state').textContent='결과를 복사했습니다.';}catch{q('#copy-state').textContent='복사를 허용하지 않는 브라우저입니다. 화면에서 결과를 선택해 복사해 주세요.';}});
  q('#rules').textContent=AubMedicalCheck.rules.map(r=>`${r.id}. ${r.title}`).join(' · ');
  render();
})();
