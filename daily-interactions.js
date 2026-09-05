(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const issueKey = location.pathname.split('/').pop().replace('.html','') || 'daily';
  const cfg = window.IMPACTONE_CONFIG || {};
  const storage = {
    get(k, fallback){ try { const v=localStorage.getItem(k); return v===null?fallback:JSON.parse(v); } catch { return fallback; } },
    set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // Small feedback toast (no intrusive alert boxes).
  let toastTimer;
  function toast(message){
    let el=$('#ioToast');
    if(!el){ el=document.createElement('div'); el.id='ioToast'; el.className='io-toast'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); document.body.appendChild(el); }
    el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
  }

  // Reading size persists across all issues.
  const sizeMap={small:'15px',medium:'17px',large:'20px'};
  function setSize(size){
    const safe=sizeMap[size]?size:'medium';
    document.documentElement.style.setProperty('--reader-size',sizeMap[safe]);
    $$('.font-tool button').forEach(b=>{ const on=b.dataset.font===safe; b.classList.toggle('active',on); b.setAttribute('aria-pressed',String(on)); });
    storage.set('impactone_reader_size',safe);
  }
  setSize(storage.get('impactone_reader_size','medium'));
  $$('.font-tool button').forEach(b=>b.addEventListener('click',()=>setSize(b.dataset.font)));

  // Dynamic numbering: focus 01–04, scan continues 05 onward.
  $$('.story-number').forEach((el,i)=>el.textContent=String(i+1).padStart(2,'0')+'｜');
  const focusCount=Math.max(4,$$('.story-number').length);
  $$('.scan-number').forEach((el,i)=>el.textContent=String(focusCount+i+1).padStart(2,'0')+'｜');
  const scanSub=$$('.section-title .section-sub').find(el=>el.textContent.includes('值得关注'));
  if(scanSub) scanSub.textContent=`${$$('.scan-item').length} 个值得关注的信号`;

  // DAILY SCAN: title + quick take by default, body opens only on demand.
  $$('.scan-toggle').forEach(btn=>btn.addEventListener('click',()=>{
    const item=btn.closest('.scan-item');
    const open=item.classList.toggle('open');
    btn.setAttribute('aria-expanded',String(open));
    btn.textContent=open?'收起 －':'展开全文 ＋';
  }));

  function openOverlay(el){
    if(!el) return; el.classList.add('open'); el.setAttribute('aria-hidden','false'); document.body.classList.add('io-panel-open');
    setTimeout(()=>el.querySelector('input,textarea,button')?.focus(),30);
  }
  function closeOverlay(el){
    if(!el) return; el.classList.remove('open'); el.setAttribute('aria-hidden','true');
    if(!$('.modal-backdrop.open')&&!$('.comments-panel.open')) document.body.classList.remove('io-panel-open');
  }

  // Subscription: uses configured endpoint when available, local fallback otherwise.
  const subAction=$('#subscribeAction'),subModal=$('#subscribeModal'),subForm=$('#subscribeForm'),subEmail=$('#subscribeEmail'),subStatus=$('#subscribeStatus');
  function renderSubscribed(){
    const email=storage.get('impactone_subscriber_email','');
    if(!subAction) return;
    subAction.classList.toggle('active',!!email);
    subAction.innerHTML=email?`${icon('check')}<span>已订阅</span>`:`${icon('plus')}<span>订阅</span>`;
  }
  renderSubscribed();
  subAction?.addEventListener('click',()=>openOverlay(subModal));
  $('[data-close-subscribe]')?.addEventListener('click',()=>closeOverlay(subModal));
  subModal?.addEventListener('click',e=>{ if(e.target===subModal) closeOverlay(subModal); });
  subForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=(subEmail?.value||'').trim();
    if(!email) return;
    const btn=subForm.querySelector('button[type="submit"]');
    btn.disabled=true; btn.textContent='提交中…'; if(subStatus) subStatus.textContent='';
    try{
      if(cfg.subscribeEndpoint){
        const res=await fetch(cfg.subscribeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'daily',issue:issueKey,url:location.href})});
        if(!res.ok) throw new Error('subscribe failed');
      }
      storage.set('impactone_subscriber_email',email); renderSubscribed();
      if(subStatus) subStatus.textContent='订阅成功。新一期发布后将发送到这个邮箱。';
      toast('已订阅「影响力·每日必读」');
      setTimeout(()=>closeOverlay(subModal),900);
    }catch(err){
      if(subStatus) subStatus.textContent='暂时无法完成订阅，请稍后再试。';
    }finally{ btn.disabled=false; btn.textContent='立即订阅'; }
  });

  // Share: system share sheet first, clipboard fallback. WeChat gets an explicit hint.
  $('#shareAction')?.addEventListener('click',async()=>{
    const data={title:document.title,text:'筛选全球资讯，把握天下大势。',url:location.href};
    const isWechat=/MicroMessenger/i.test(navigator.userAgent);
    if(isWechat){ toast('请使用微信右上角菜单转发给朋友或朋友圈'); return; }
    try{
      if(navigator.share) await navigator.share(data);
      else if(navigator.clipboard){ await navigator.clipboard.writeText(location.href); toast('链接已复制'); }
      else fallbackCopy(location.href);
    }catch(e){ if(e?.name!=='AbortError') fallbackCopy(location.href); }
  });

  // Favorite: endpoint-ready; local storage keeps V2 usable on static GitHub Pages.
  const favAction=$('#favoriteAction');
  function renderFavorite(){
    const on=storage.get('impactone_favorite_'+issueKey,false);
    favAction?.classList.toggle('active',on);
    if(favAction) favAction.innerHTML=on?`${icon('heartFill')}<span>已收藏</span>`:`${icon('heart')}<span>收藏</span>`;
  }
  renderFavorite();
  favAction?.addEventListener('click',async()=>{
    const next=!storage.get('impactone_favorite_'+issueKey,false);
    storage.set('impactone_favorite_'+issueKey,next); renderFavorite(); toast(next?'已收藏':'已取消收藏');
    if(cfg.favoriteEndpoint){ fetch(cfg.favoriteEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({issue:issueKey,favorite:next,url:location.href})}).catch(()=>{}); }
  });

  // Comments. V2 supports a remote endpoint if configured; otherwise local prototype remains functional.
  const panel=$('#commentsPanel'),commentAction=$('#commentAction'),form=$('#commentForm'),list=$('#commentList'),count=$('#commentCount');
  const commentsKey='impactone_comments_'+issueKey;
  const getLocal=()=>storage.get(commentsKey,[]);
  const setLocal=v=>storage.set(commentsKey,v);
  let remoteComments=null;
  function esc(s){ const d=document.createElement('div'); d.textContent=String(s??''); return d.innerHTML; }
  function visibleComments(){ return remoteComments ?? getLocal(); }
  function renderComments(){
    const cs=visibleComments();
    if(count) count.textContent=cs.length?String(cs.length):'';
    if(!list) return;
    list.innerHTML=cs.map((c,i)=>`<div class="comment-item"><div class="comment-meta">${esc(c.name||'读者')} · ${formatTime(c.time||c.created_at)}${c.pending?'<span class="comment-pending">待审核</span>':''}</div><div>${esc(c.text)}</div><div class="comment-actions"><button type="button" data-like="${i}">♡ ${Number(c.likes||0)}</button><button type="button" data-reply="${i}">回复</button></div></div>`).join('')||'<p style="font-size:11px;color:#777">暂无评论。你可以写下第一条看法。</p>';
    $$('[data-like]',list).forEach(b=>b.addEventListener('click',()=>likeComment(Number(b.dataset.like))));
    $$('[data-reply]',list).forEach(b=>b.addEventListener('click',()=>{ const c=visibleComments()[Number(b.dataset.reply)]; const box=$('#commentText'); box.value='@'+(c?.name||'读者')+' '; box.focus(); }));
  }
  async function loadComments(){
    if(!cfg.commentsEndpoint){ renderComments(); return; }
    try{ const res=await fetch(`${cfg.commentsEndpoint}?issue=${encodeURIComponent(issueKey)}`); if(!res.ok) throw 0; remoteComments=await res.json(); if(!Array.isArray(remoteComments)) remoteComments=[]; renderComments(); }catch{ remoteComments=null; renderComments(); }
  }
  function likeComment(i){
    const cs=remoteComments??getLocal(); if(!cs[i]) return; cs[i].likes=Number(cs[i].likes||0)+1;
    if(remoteComments===null) setLocal(cs); renderComments();
    if(cfg.commentsEndpoint&&cs[i].id) fetch(`${cfg.commentsEndpoint}/${cs[i].id}/like`,{method:'POST'}).catch(()=>{});
  }
  loadComments();
  commentAction?.addEventListener('click',()=>{ panel.classList.contains('open')?closeOverlay(panel):openOverlay(panel); });
  $('[data-close-comments]')?.addEventListener('click',()=>closeOverlay(panel));
  form?.addEventListener('submit',async e=>{
    e.preventDefault(); const name=($('#commentName')?.value||'').trim(),text=($('#commentText')?.value||'').trim(); if(!name||!text) return;
    const btn=form.querySelector('button[type="submit"]'); btn.disabled=true;
    try{
      if(cfg.commentsEndpoint){
        const res=await fetch(cfg.commentsEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({issue:issueKey,name,text,url:location.href})});
        if(!res.ok) throw 0;
        const created=await res.json();
        remoteComments=[{name,text,time:Date.now(),likes:0,pending:true,...created},...(remoteComments||[])];
        toast('评论已提交，审核后公开显示');
      }else{
        const cs=getLocal(); cs.unshift({name,text,time:Date.now(),likes:0}); setLocal(cs); toast('评论已发布（本机预览）');
      }
      $('#commentText').value=''; renderComments();
    }catch{ toast('评论提交失败，请稍后再试'); }
    finally{ btn.disabled=false; }
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ closeOverlay(subModal); closeOverlay(panel); }
  });

  function formatTime(v){
    const d=v?new Date(v):new Date();
    try{return d.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return ''}
  }
  function fallbackCopy(text){
    const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toast('链接已复制'); }catch{ toast('请复制浏览器地址进行转发'); }
    ta.remove();
  }
  function icon(type){
    const paths={
      plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
      heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
      heartFill:'<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>'
    };
    return `<span class="ico">${paths[type]||''}</span>`;
  }
})();
