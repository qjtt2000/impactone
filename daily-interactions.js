(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const issueKey=location.pathname.split('/').pop().replace('.html','')||'daily';
  const cfg=window.IMPACTONE_CONFIG||{};
  const storage={get(k,f){try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
  const clientId=storage.get('impactone_client_id','')||(()=>{const v=(crypto.randomUUID?.()||('anon-'+Date.now()+'-'+Math.random().toString(36).slice(2)));storage.set('impactone_client_id',v);return v})();
  let toastTimer;
  function toast(message){let el=$('#ioToast');if(!el){el=document.createElement('div');el.id='ioToast';el.className='io-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400)}

  const sizeMap={small:{body:'15.3px',source:'10px'},medium:{body:'17px',source:'10px'},large:{body:'20px',source:'10.7px'}};
  function setSize(size){const safe=sizeMap[size]?size:'medium';document.documentElement.style.setProperty('--reader-size',sizeMap[safe].body);document.documentElement.style.setProperty('--source-size',sizeMap[safe].source);$$('.font-tool button').forEach(b=>{const on=b.dataset.font===safe;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});storage.set('impactone_reader_size',safe)}
  setSize(storage.get('impactone_reader_size','medium'));$$('.font-tool button').forEach(b=>b.addEventListener('click',()=>setSize(b.dataset.font)));

  // Focus numbering 01–04; scan always continues at 05 even if a sample issue has fewer focus stories.
  $$('.story-number').forEach((el,i)=>el.textContent=String(i+1).padStart(2,'0')+'｜');
  $$('.scan-number').forEach((el,i)=>el.textContent=String(5+i).padStart(2,'0')+'｜');
  const scanSub=$$('.section-title .section-sub').find(el=>el.textContent.includes('值得关注'));if(scanSub)scanSub.textContent=`${$$('.scan-item').length}个值得关注的信号`;

  // DAILY SCAN: summary stays visible; only supplemental details expand/collapse.
  $$('.scan-item').forEach(item=>{const openBtn=$('.scan-toggle',item),closeBtn=$('.scan-collapse',item),body=$('.scan-body',item);if(!openBtn||!body)return;const setOpen=open=>{body.hidden=!open;openBtn.hidden=open;openBtn.setAttribute('aria-expanded',String(open));if(closeBtn)closeBtn.hidden=!open};openBtn.addEventListener('click',()=>setOpen(true));closeBtn?.addEventListener('click',()=>setOpen(false));setOpen(false)});

  // ISSUE NAVIGATION: issue 001 hides automatically. Later issues show when data-previous-url is supplied.
  const issueNav=$('.issue-navigation');if(issueNav){const issueNo=Number(issueNav.dataset.issueNumber||0),prevUrl=(issueNav.dataset.previousUrl||'').trim(),link=$('.previous-issue',issueNav);if(issueNo>1&&prevUrl&&link){link.href=prevUrl;issueNav.hidden=false}else issueNav.hidden=true}

  function openOverlay(el){if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.classList.add('io-panel-open');setTimeout(()=>el.querySelector('input,textarea,button,a')?.focus(),30)}
  function closeOverlay(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');if(!$('.modal-backdrop.open')&&!$('.comments-panel.open'))document.body.classList.remove('io-panel-open')}

  // V3.13 Subscription: install the PWA first, then complete subscription by granting notification permission.
  // Browsers require the notification permission prompt to follow a user action; it cannot be silently enabled.
  const subAction=$('#subscribeAction'),subModal=$('#subscribeModal'),subForm=$('#subscribeForm'),subEmail=$('#subscribeEmail'),subStatus=$('#subscribeStatus');
  const installBtn=$('#installAppButton'),installHelp=$('#installHelp');
  let deferredInstallPrompt=null;
  let swRegistrationPromise=null;
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid=/Android/i.test(navigator.userAgent);
  const standaloneNow=()=>window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
  const notificationsSupported=()=>('Notification' in window)&&('serviceWorker' in navigator);

  function urlBase64ToUint8Array(base64String){
    const padding='='.repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  async function getSWRegistration(){
    if(!('serviceWorker' in navigator))return null;
    if(!swRegistrationPromise){
      swRegistrationPromise=navigator.serviceWorker.register('/service-worker.js').then(()=>navigator.serviceWorker.ready).catch(()=>null);
    }
    return swRegistrationPromise;
  }

  async function registerPushSubscription(reg){
    if(!reg||!cfg.vapidPublicKey||!cfg.pushSubscribeEndpoint)return {connected:false,reason:'backend-pending'};
    try{
      let pushSub=await reg.pushManager.getSubscription();
      if(!pushSub){pushSub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)})}
      const res=await fetch(cfg.pushSubscribeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:pushSub.toJSON(),issue:issueKey,url:location.href,client_id:clientId})});
      if(!res.ok)throw new Error('push subscribe failed');
      storage.set('impactone_push_connected',true);
      return {connected:true};
    }catch(e){
      storage.set('impactone_push_connected',false);
      return {connected:false,reason:'subscribe-failed'};
    }
  }

  async function requestDailyNotifications(){
    if(!notificationsSupported()){
      if(installHelp)installHelp.innerHTML='当前浏览器不支持网页通知。你仍可以把 IMPACTONE 添加到手机桌面。';
      return false;
    }
    let permission=Notification.permission;
    if(permission==='denied'){
      if(installHelp)installHelp.innerHTML='通知已被关闭。如需恢复，请到手机“设置 → 通知”中允许 IMPACTONE 通知。';
      renderSubscribed();renderInstallState();
      return false;
    }
    if(permission==='default'){
      try{permission=await Notification.requestPermission()}catch{permission='default'}
    }
    if(permission!=='granted'){
      if(installHelp)installHelp.innerHTML='你暂未允许通知。以后仍可点底部“订阅”再次设置。';
      renderSubscribed();renderInstallState();
      return false;
    }

    storage.set('impactone_notification_permission',true);
    const reg=await getSWRegistration();
    const result=await registerPushSubscription(reg);

    // During front-end testing the push backend may not be configured yet. Show one local confirmation only.
    if(reg){
      try{await reg.showNotification('IMPACTONE｜通知已允许',{body:result.connected?'《每日必读》更新后将通过这里提醒你。':'手机通知权限已开启；正式每日推送将在推送后台接入后生效。',icon:'/images/brand/impactone-icon-192.png',badge:'/images/brand/impactone-icon-192.png',tag:'impactone-permission-confirm',data:{url:location.pathname}})}catch{}
    }
    if(installHelp){
      installHelp.innerHTML=result.connected
        ?'<strong>订阅完成。</strong>《每日必读》更新后会通过 IMPACTONE 通知提醒你。'
        :'<strong>手机通知权限已开启。</strong>当前测试版尚未连接正式推送后台；接入后即可自动发送每日更新通知。';
    }
    renderSubscribed();renderInstallState();
    return true;
  }

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;renderInstallState()});
  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;storage.set('impactone_pwa_installed',true);renderSubscribed();renderInstallState();
    toast('已添加到手机桌面');
  });

  function renderSubscribed(){
    if(!subAction)return;
    const installed=standaloneNow()||storage.get('impactone_pwa_installed',false);
    const permission=notificationsSupported()?Notification.permission:'unsupported';
    const pushConnected=storage.get('impactone_push_connected',false);
    const complete=installed&&permission==='granted'&&pushConnected;
    const notificationReady=installed&&permission==='granted';
    subAction.classList.toggle('active',complete||notificationReady);
    if(complete)subAction.innerHTML=`${icon('check')}<span>已订阅</span>`;
    else if(notificationReady)subAction.innerHTML=`${icon('check')}<span>已添加</span>`;
    else subAction.innerHTML=`${icon('plus')}<span>订阅</span>`;
  }

  function renderInstallState(){
    if(!installBtn||!installHelp)return;
    const installed=standaloneNow();
    const permission=notificationsSupported()?Notification.permission:'unsupported';

    if(installed){
      if(permission==='granted'){
        installBtn.textContent=storage.get('impactone_push_connected',false)?'✓ 已完成订阅':'✓ 通知已允许';
        installBtn.disabled=true;
        installHelp.innerHTML=storage.get('impactone_push_connected',false)
          ?'你已从桌面进入 IMPACTONE，并已订阅《每日必读》更新通知。'
          :'你已从桌面进入 IMPACTONE，手机通知权限已开启。';
        return;
      }
      if(permission==='denied'){
        installBtn.textContent='通知已关闭';installBtn.disabled=true;
        installHelp.innerHTML='你已经安装 IMPACTONE，但通知被系统关闭。可在手机“设置 → 通知”中重新允许。';
        return;
      }
      installBtn.textContent='完成订阅';installBtn.disabled=false;
      installHelp.innerHTML='最后一步：点“完成订阅”，手机会询问是否允许 IMPACTONE 发送《每日必读》更新通知。';
      return;
    }

    installBtn.disabled=false;installBtn.textContent='＋ 添加到手机桌面';
    if(deferredInstallPrompt){
      installHelp.innerHTML=isAndroid?'Android：点击上方按钮安装。安装完成后，按系统提示允许 IMPACTONE 通知。':'点击上方按钮即可安装，不需要 App Store。';
      return;
    }
    if(isIOS){installHelp.innerHTML='iPhone / iPad：先用 <strong>Safari 分享 → 添加到主屏幕 → 添加</strong>。然后从桌面打开 IMPACTONE，点“订阅”完成通知授权。';return}
    if(isAndroid){installHelp.innerHTML='Android：用 Chrome，点右上角 <strong>⋮ → 添加到主屏幕 / 安装应用 → 安装</strong>。安装后允许 IMPACTONE 通知。';return}
    installHelp.textContent='请打开浏览器菜单，选择“添加到主屏幕”或“安装应用”。';
  }

  renderSubscribed();renderInstallState();getSWRegistration();

  // V3.14: when the installed PWA is opened from the Home Screen for the first time,
  // show a small in-app prompt. The system permission dialog is only requested after the user taps “开启”.
  const notificationOptin=$('#notificationOptin');
  const enableNotificationButton=$('#enableNotificationButton');
  const dismissNotificationButton=$('#dismissNotificationButton');
  function renderNotificationOptin(){
    if(!notificationOptin)return;
    const dismissed=storage.get('impactone_notification_prompt_dismissed',false);
    const shouldShow=standaloneNow()&&notificationsSupported()&&Notification.permission==='default'&&!dismissed;
    notificationOptin.hidden=!shouldShow;
  }
  if(standaloneNow())setTimeout(renderNotificationOptin,650);
  enableNotificationButton?.addEventListener('click',async()=>{
    notificationOptin.hidden=true;
    await requestDailyNotifications();
    renderNotificationOptin();
  });
  dismissNotificationButton?.addEventListener('click',()=>{
    storage.set('impactone_notification_prompt_dismissed',true);
    notificationOptin.hidden=true;
  });

  subAction?.addEventListener('click',async()=>{
    // Once opened from the Home Screen, the same “订阅” button becomes the notification permission action.
    if(standaloneNow()&&notificationsSupported()&&Notification.permission==='default'){
      await requestDailyNotifications();return;
    }
    renderInstallState();openOverlay(subModal);
  });
  $('[data-close-subscribe]')?.addEventListener('click',()=>closeOverlay(subModal));
  subModal?.addEventListener('click',e=>{if(e.target===subModal)closeOverlay(subModal)});

  installBtn?.addEventListener('click',async()=>{
    if(standaloneNow()){
      await requestDailyNotifications();return;
    }
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      try{
        const choice=await deferredInstallPrompt.userChoice;
        if(choice?.outcome==='accepted'){
          storage.set('impactone_pwa_installed',true);renderSubscribed();
          // Android/Chromium may allow the notification prompt to continue from the same user action.
          if(isAndroid)await requestDailyNotifications();
        }
      }catch{}
      deferredInstallPrompt=null;renderInstallState();return;
    }
    if(isIOS){installHelp.innerHTML='iPhone / iPad：<strong>Safari 分享 → 添加到主屏幕 → 添加</strong>。完成后请从桌面打开 IMPACTONE，再点底部“订阅”；系统会直接询问是否允许通知。';return}
    if(isAndroid){installHelp.innerHTML='Android：<strong>Chrome 右上角 ⋮ → 添加到主屏幕 / 安装应用 → 安装</strong>。完成后允许 IMPACTONE 通知即可。';return}
    installHelp.textContent='请打开浏览器菜单，选择“添加到主屏幕”或“安装应用”。';
  });

  $('[data-toggle-email]')?.addEventListener('click',()=>{const f=$('#subscribeForm');if(!f)return;f.hidden=!f.hidden;if(!f.hidden)setTimeout(()=>subEmail?.focus(),20)});
  subForm?.addEventListener('submit',async e=>{e.preventDefault();const email=(subEmail?.value||'').trim();if(!email)return;const btn=subForm.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='提交中…';if(subStatus)subStatus.textContent='';try{if(cfg.subscribeEndpoint){const res=await fetch(cfg.subscribeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'daily',issue:issueKey,url:location.href})});if(!res.ok)throw new Error('subscribe failed')}storage.set('impactone_subscriber_email',email);if(subStatus)subStatus.textContent='邮件订阅成功。';toast('邮件订阅成功')}catch{if(subStatus)subStatus.textContent='暂时无法完成邮件订阅，请稍后再试。'}finally{btn.disabled=false;btn.textContent='邮件订阅'}});

  // V3.11 Share center. Preview shares the current Preview URL; production naturally shares production URL.
  const shareModal=$('#shareModal');
  const shareTitle=document.title, shareText='筛选全球资讯，把握天下大势。';
  const shareUrl=location.href;
  const enc=encodeURIComponent;
  const links={
    linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`,
    whatsapp:`https://wa.me/?text=${enc(shareTitle+' '+shareUrl)}`
  };
  $$('[data-share-link]').forEach(a=>{a.href=links[a.dataset.shareLink]||shareUrl});

  async function nativeShare(){
    if(!navigator.share)return false;
    try{await navigator.share({title:shareTitle,text:shareText,url:shareUrl});return true}
    catch(e){if(e?.name==='AbortError')return true;return false}
  }
  async function copySilently(){
    try{if(navigator.clipboard)await navigator.clipboard.writeText(shareUrl);else fallbackCopyNoToast(shareUrl);return true}catch{fallbackCopyNoToast(shareUrl);return false}
  }
  function openDeepLink(uri,webFallback,label){
    const started=Date.now();
    window.location.href=uri;
    setTimeout(()=>{if(Date.now()-started<1800&&document.visibilityState==='visible'&&webFallback)window.location.href=webFallback},900);
    toast(`${label} 已打开；文章链接已复制，可直接粘贴发布`);
  }

  $('#shareAction')?.addEventListener('click',()=>openOverlay(shareModal));
  $('[data-close-share]')?.addEventListener('click',()=>{closeOverlay(shareModal);$('#wechatShareHint')?.classList.remove('show')});
  shareModal?.addEventListener('click',e=>{if(e.target===shareModal)closeOverlay(shareModal)});
  $('[data-share="system"]')?.addEventListener('click',async()=>{const handled=await nativeShare();if(!handled)toast('当前浏览器不支持系统分享，请使用复制链接')});
  $('[data-share="wechat"]')?.addEventListener('click',async()=>{const handled=await nativeShare();if(!handled){await copyLink();toast('链接已复制，请在微信中发送')}});
  $('[data-share="facebook-native"]')?.addEventListener('click',()=>{window.open(`https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,'_blank','noopener,noreferrer')});
  $('[data-share="instagram"]')?.addEventListener('click',async()=>{await copySilently();openDeepLink('instagram://camera','https://www.instagram.com/','Instagram')});
  $('[data-share="xiaohongshu"]')?.addEventListener('click',async()=>{await copySilently();openDeepLink('xhsdiscover://post','https://www.xiaohongshu.com/explore','小红书')});
  $('[data-share="copy"]')?.addEventListener('click',copyLink);
  async function copyLink(){try{if(navigator.clipboard)await navigator.clipboard.writeText(shareUrl);else fallbackCopy(shareUrl);toast('链接已复制')}catch{fallbackCopy(shareUrl)}}

  // Optional official social profile links in footer.
  const profileNames={facebook:'Facebook',instagram:'Instagram',x:'X',linkedin:'LinkedIn',youtube:'YouTube',wechat:'微信'};const profiles=$('#socialProfiles');
  if(profiles&&cfg.socialProfiles){Object.entries(cfg.socialProfiles).forEach(([k,v])=>{if(!v)return;const a=document.createElement('a');a.href=v;a.target='_blank';a.rel='noopener';a.textContent=profileNames[k]||k;profiles.appendChild(a)})}

  // Favorite: persistent backend when endpoint configured, local preview otherwise.
  const favAction=$('#favoriteAction');
  async function loadFavorite(){if(cfg.favoriteEndpoint){try{const r=await fetch(`${cfg.favoriteEndpoint}?issue=${encodeURIComponent(issueKey)}&client_id=${encodeURIComponent(clientId)}`);if(r.ok){const j=await r.json();storage.set('impactone_favorite_'+issueKey,!!j.favorite)}}catch{}}renderFavorite()}
  function renderFavorite(){const on=storage.get('impactone_favorite_'+issueKey,false);favAction?.classList.toggle('active',on);if(favAction)favAction.innerHTML=on?`${icon('heartFill')}<span>已收藏</span>`:`${icon('heart')}<span>收藏</span>`}
  loadFavorite();favAction?.addEventListener('click',async()=>{const next=!storage.get('impactone_favorite_'+issueKey,false);storage.set('impactone_favorite_'+issueKey,next);renderFavorite();toast(next?'已收藏到 IMPACTONE（当前保存在本机）':'已取消收藏');if(cfg.favoriteEndpoint){try{await fetch(cfg.favoriteEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({issue:issueKey,client_id:clientId,favorite:next,url:location.href})})}catch{toast('收藏已保存在本机，云端同步稍后重试')}}});

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
  function fallbackCopyNoToast(text){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch{}ta.remove()}
  function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('链接已复制')}catch{toast('请复制浏览器地址进行转发')}ta.remove()}
  function icon(type){const paths={plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',heartFill:'<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>'};return `<span class="ico">${paths[type]||''}</span>`}
})();
