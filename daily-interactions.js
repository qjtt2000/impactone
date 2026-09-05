(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const issueKey=location.pathname.split('/').pop().replace('.html','')||'daily';
  const cfg=window.IMPACTONE_CONFIG||{};
  const storage={get(k,f){try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
  const clientId=storage.get('impactone_client_id','')||(()=>{const v=(crypto.randomUUID?.()||('anon-'+Date.now()+'-'+Math.random().toString(36).slice(2)));storage.set('impactone_client_id',v);return v})();
  let toastTimer;
  function toast(message){let el=$('#ioToast');if(!el){el=document.createElement('div');el.id='ioToast';el.className='io-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400)}

  const sizeMap={small:'15px',medium:'17px',large:'20px'};
  function setSize(size){const safe=sizeMap[size]?size:'medium';document.documentElement.style.setProperty('--reader-size',sizeMap[safe]);$$('.font-tool button').forEach(b=>{const on=b.dataset.font===safe;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});storage.set('impactone_reader_size',safe)}
  setSize(storage.get('impactone_reader_size','medium'));$$('.font-tool button').forEach(b=>b.addEventListener('click',()=>setSize(b.dataset.font)));

  // Focus numbering 01–04; scan always continues at 05 even if a sample issue has fewer focus stories.
  $$('.story-number').forEach((el,i)=>el.textContent=String(i+1).padStart(2,'0')+'｜');
  $$('.scan-number').forEach((el,i)=>el.textContent=String(5+i).padStart(2,'0')+'｜');
  const scanSub=$$('.section-title .section-sub').find(el=>el.textContent.includes('值得关注'));if(scanSub)scanSub.textContent=`${$$('.scan-item').length}个值得关注的信号`;

  // DAILY SCAN: title + 快评 visible; event summary folded by default.
  $$('.scan-toggle').forEach(btn=>btn.addEventListener('click',()=>{const item=btn.closest('.scan-item');const open=item.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'收起 －':'展开全文 ＋'}));

  function openOverlay(el){if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.classList.add('io-panel-open');setTimeout(()=>el.querySelector('input,textarea,button,a')?.focus(),30)}
  function closeOverlay(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');if(!$('.modal-backdrop.open')&&!$('.comments-panel.open'))document.body.classList.remove('io-panel-open')}

  // Subscription -> Supabase Edge Function in production; local fallback in preview.
  const subAction=$('#subscribeAction'),subModal=$('#subscribeModal'),subForm=$('#subscribeForm'),subEmail=$('#subscribeEmail'),subStatus=$('#subscribeStatus');
  function renderSubscribed(){const email=storage.get('impactone_subscriber_email','');if(!subAction)return;subAction.classList.toggle('active',!!email);subAction.innerHTML=email?`${icon('check')}<span>已订阅</span>`:`${icon('plus')}<span>订阅</span>`}
  renderSubscribed();subAction?.addEventListener('click',()=>openOverlay(subModal));$('[data-close-subscribe]')?.addEventListener('click',()=>closeOverlay(subModal));subModal?.addEventListener('click',e=>{if(e.target===subModal)closeOverlay(subModal)});
  subForm?.addEventListener('submit',async e=>{e.preventDefault();const email=(subEmail?.value||'').trim();if(!email)return;const btn=subForm.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='提交中…';if(subStatus)subStatus.textContent='';try{if(cfg.subscribeEndpoint){const res=await fetch(cfg.subscribeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'daily',issue:issueKey,url:location.href})});if(!res.ok)throw new Error('subscribe failed')}storage.set('impactone_subscriber_email',email);renderSubscribed();if(subStatus)subStatus.textContent='订阅成功。新一期发布后将发送到这个邮箱。';toast('已订阅「影响力·每日必读」');setTimeout(()=>closeOverlay(subModal),1000)}catch{if(subStatus)subStatus.textContent='暂时无法完成订阅，请稍后再试。'}finally{btn.disabled=false;btn.textContent='立即订阅'}});

  // Share center: Web Share + direct social share URLs + WeChat guidance.
  const shareModal=$('#shareModal');
  $('#shareAction')?.addEventListener('click',()=>openOverlay(shareModal));$('[data-close-share]')?.addEventListener('click',()=>closeOverlay(shareModal));shareModal?.addEventListener('click',e=>{if(e.target===shareModal)closeOverlay(shareModal)});
  const shareTitle=document.title, shareText='筛选全球资讯，把握天下大势。', shareUrl=location.href;
  const enc=encodeURIComponent;
  const links={facebook:`https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,x:`https://twitter.com/intent/tweet?text=${enc(shareTitle)}&url=${enc(shareUrl)}`,linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`,whatsapp:`https://wa.me/?text=${enc(shareTitle+' '+shareUrl)}`,email:`mailto:?subject=${enc(shareTitle)}&body=${enc(shareText+'\n\n'+shareUrl)}`};
  $$('[data-share-link]').forEach(a=>{a.href=links[a.dataset.shareLink]||shareUrl});
  $('[data-share="system"]')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:shareTitle,text:shareText,url:shareUrl});else await copyLink()}catch(e){if(e?.name!=='AbortError')toast('系统分享暂不可用')}});
  $('[data-share="copy"]')?.addEventListener('click',copyLink);
  $('[data-share="wechat"]')?.addEventListener('click',()=>{$('#wechatHint')?.classList.add('show');toast('请在微信内使用右上角菜单转发')});
  async function copyLink(){try{if(navigator.clipboard)await navigator.clipboard.writeText(shareUrl);else fallbackCopy(shareUrl);toast('链接已复制')}catch{fallbackCopy(shareUrl)}}

  // Optional official social profile links in footer.
  const profileNames={facebook:'Facebook',instagram:'Instagram',x:'X',linkedin:'LinkedIn',youtube:'YouTube',wechat:'微信'};const profiles=$('#socialProfiles');
  if(profiles&&cfg.socialProfiles){Object.entries(cfg.socialProfiles).forEach(([k,v])=>{if(!v)return;const a=document.createElement('a');a.href=v;a.target='_blank';a.rel='noopener';a.textContent=profileNames[k]||k;profiles.appendChild(a)})}

  // Favorite: persistent backend when endpoint configured, local preview otherwise.
  const favAction=$('#favoriteAction');
  async function loadFavorite(){if(cfg.favoriteEndpoint){try{const r=await fetch(`${cfg.favoriteEndpoint}?issue=${encodeURIComponent(issueKey)}&client_id=${encodeURIComponent(clientId)}`);if(r.ok){const j=await r.json();storage.set('impactone_favorite_'+issueKey,!!j.favorite)}}catch{}}renderFavorite()}
  function renderFavorite(){const on=storage.get('impactone_favorite_'+issueKey,false);favAction?.classList.toggle('active',on);if(favAction)favAction.innerHTML=on?`${icon('heartFill')}<span>已收藏</span>`:`${icon('heart')}<span>收藏</span>`}
  loadFavorite();favAction?.addEventListener('click',async()=>{const next=!storage.get('impactone_favorite_'+issueKey,false);storage.set('impactone_favorite_'+issueKey,next);renderFavorite();toast(next?'已收藏':'已取消收藏');if(cfg.favoriteEndpoint){try{await fetch(cfg.favoriteEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({issue:issueKey,client_id:clientId,favorite:next,url:location.href})})}catch{toast('收藏已保存在本机，云端同步稍后重试')}}});

  // Comments: server moderation in production; localStorage fallback for preview.
  const panel=$('#commentsPanel'),commentAction=$('#commentAction'),form=$('#commentForm'),list=$('#commentList'),count=$('#commentCount');const commentsKey='impactone_comments_'+issueKey;const getLocal=()=>storage.get(commentsKey,[]),setLocal=v=>storage.set(commentsKey,v);let remoteComments=null;
  function esc(s){const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML}function visibleComments(){return remoteComments??getLocal()}
  function renderComments(){const cs=visibleComments();if(count)count.textContent=cs.length?String(cs.length):'';if(!list)return;list.innerHTML=cs.map((c,i)=>`<div class="comment-item"><div class="comment-meta">${esc(c.name||'读者')} · ${formatTime(c.time||c.created_at)}${c.pending?'<span class="comment-pending">待审核</span>':''}</div><div>${esc(c.text)}</div><div class="comment-actions"><button type="button" data-like="${i}">♡ ${Number(c.likes||0)}</button><button type="button" data-reply="${i}">回复</button></div></div>`).join('')||'<p style="font-size:12px;color:#777">暂无评论。你可以写下第一条看法。</p>';$$('[data-like]',list).forEach(b=>b.addEventListener('click',()=>likeComment(Number(b.dataset.like))));$$('[data-reply]',list).forEach(b=>b.addEventListener('click',()=>{const c=visibleComments()[Number(b.dataset.reply)],box=$('#commentText');box.value='@'+(c?.name||'读者')+' ';box.focus()}))}
  async function loadComments(){if(!cfg.commentsEndpoint){renderComments();return}try{const res=await fetch(`${cfg.commentsEndpoint}?issue=${encodeURIComponent(issueKey)}`);if(!res.ok)throw 0;remoteComments=await res.json();if(!Array.isArray(remoteComments))remoteComments=[];renderComments()}catch{remoteComments=null;renderComments()}}
  function likeComment(i){const cs=remoteComments??getLocal();if(!cs[i])return;cs[i].likes=Number(cs[i].likes||0)+1;if(remoteComments===null)setLocal(cs);renderComments();if(cfg.commentsEndpoint&&cs[i].id)fetch(`${cfg.commentsEndpoint}/${cs[i].id}/like`,{method:'POST'}).catch(()=>{})}
  loadComments();commentAction?.addEventListener('click',()=>panel.classList.contains('open')?closeOverlay(panel):openOverlay(panel));$('[data-close-comments]')?.addEventListener('click',()=>closeOverlay(panel));
  form?.addEventListener('submit',async e=>{e.preventDefault();const name=($('#commentName')?.value||'').trim(),text=($('#commentText')?.value||'').trim();if(!name||!text)return;const btn=form.querySelector('button[type="submit"]');btn.disabled=true;try{if(cfg.commentsEndpoint){const res=await fetch(cfg.commentsEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({issue:issueKey,name,text,url:location.href})});if(!res.ok)throw 0;const created=await res.json();remoteComments=[{name,text,time:Date.now(),likes:0,pending:true,...created},...(remoteComments||[])];toast('评论已提交，审核后公开显示')}else{const cs=getLocal();cs.unshift({name,text,time:Date.now(),likes:0});setLocal(cs);toast('评论已发布（本机预览）')}$('#commentText').value='';renderComments()}catch{toast('评论提交失败，请稍后再试')}finally{btn.disabled=false}});

  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeOverlay(subModal);closeOverlay(shareModal);closeOverlay(panel)}});
  function formatTime(v){const d=v?new Date(v):new Date();try{return d.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return''}}
  function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('链接已复制')}catch{toast('请复制浏览器地址进行转发')}ta.remove()}
  function icon(type){const paths={plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',heartFill:'<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>'};return `<span class="ico">${paths[type]||''}</span>`}
})();
