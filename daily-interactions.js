(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const cfg = window.IMPACTONE_CONFIG || {};
  const API_BASE = 'https://impactone-gamma.vercel.app';
  const issueKey =
    location.pathname.split('/').pop().replace('.html', '') || 'daily';

  // ===== 本地数据 =====
  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  };

  const clientId =
    storage.get('impactone_client_id', '') ||
    (() => {
      const id =
        globalThis.crypto?.randomUUID?.() ||
        'anon-' + Date.now() + '-' +
        Math.random().toString(36).slice(2);
      storage.set('impactone_client_id', id);
      return id;
    })();

  // ===== 全局提示框：独立于日报布局 =====
  let toastTimer;

  function toast(message) {
    let el = $('#ioToast');

    if (!el) {
      el = document.createElement('div');
      el.id = 'ioToast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }

    // 清除可能与旧版 io-toast 冲突的样式
    el.className = '';

    el.textContent = message;

    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('top', '50%', 'important');
    el.style.setProperty('left', '50%', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty(
      'transform', 'translate(-50%, -50%)', 'important'
    );
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('z-index', '2147483647', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    el.style.setProperty('width', 'max-content', 'important');
    el.style.setProperty('max-width', 'calc(100vw - 40px)', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('padding', '16px 22px', 'important');
    el.style.setProperty('background', '#071B3B', 'important');
    el.style.setProperty('color', '#FFFFFF', 'important');
    el.style.setProperty('border', '1px solid #C8A84B', 'important');
    el.style.setProperty('border-radius', '10px', 'important');
    el.style.setProperty('box-shadow',
      '0 8px 30px rgba(0,0,0,.28)', 'important');
    el.style.setProperty('font-size', '15px', 'important');
    el.style.setProperty('font-weight', '500', 'important');
    el.style.setProperty('line-height', '1.6', 'important');
    el.style.setProperty('text-align', 'center', 'important');
    el.style.setProperty('white-space', 'normal', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('transition', 'none', 'important');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.style.setProperty('display', 'none', 'important');
    }, 3000);
  }

  // ===== 字号 =====
  const sizeMap = {
    small: { body: '15.3px', source: '10px' },
    medium: { body: '17px', source: '10px' },
    large: { body: '20px', source: '10.7px' }
  };

  function setSize(size) {
    const safe = sizeMap[size] ? size : 'medium';

    document.documentElement.style.setProperty(
      '--reader-size', sizeMap[safe].body
    );
    document.documentElement.style.setProperty(
      '--source-size', sizeMap[safe].source
    );

    $$('.font-tool button').forEach(button => {
      const active = button.dataset.font === safe;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    storage.set('impactone_reader_size', safe);
  }

  setSize(storage.get('impactone_reader_size', 'medium'));

  $$('.font-tool button').forEach(button => {
    button.addEventListener('click', () => {
      setSize(button.dataset.font);
    });
  });

  // ===== 自动编号 =====
  $$('.story-number').forEach((el, index) => {
    el.textContent = String(index + 1).padStart(2, '0') + '｜';
  });

  $$('.scan-number').forEach((el, index) => {
    el.textContent = String(index + 5).padStart(2, '0') + '｜';
  });

  const scanSubtitle = $$('.section-title .section-sub')
    .find(el => el.textContent.includes('值得关注'));

  if (scanSubtitle) {
    scanSubtitle.textContent =
      `${$$('.scan-item').length}个值得关注的信号`;
  }

  // ===== 扫描展开 / 收起 =====
  $$('.scan-item').forEach(item => {
    const openBtn = $('.scan-toggle', item);
    const closeBtn = $('.scan-collapse', item);
    const body = $('.scan-body', item);

    if (!openBtn || !body) return;

    function setOpen(open) {
      body.hidden = !open;
      openBtn.hidden = open;
      openBtn.setAttribute('aria-expanded', String(open));
      if (closeBtn) closeBtn.hidden = !open;
    }

    openBtn.addEventListener('click', () => setOpen(true));
    closeBtn?.addEventListener('click', () => setOpen(false));
    setOpen(false);
  });

  // ===== 前一期 =====
  const issueNavigation = $('.issue-navigation');

  if (issueNavigation) {
    const issueNumber = Number(
      issueNavigation.dataset.issueNumber || 0
    );
    const previousUrl =
      (issueNavigation.dataset.previousUrl || '').trim();
    const previousLink =
      $('.previous-issue', issueNavigation);

    if (issueNumber > 1 && previousUrl && previousLink) {
      previousLink.href = previousUrl;
      issueNavigation.hidden = false;
    } else {
      issueNavigation.hidden = true;
    }
  }

  // ===== 弹窗 =====
  function openOverlay(element) {
    if (!element) return;
    element.classList.add('open');
    element.setAttribute('aria-hidden', 'false');
    document.body.classList.add('io-panel-open');

    setTimeout(() => {
      element.querySelector(
        'input,textarea,button,a'
      )?.focus();
    }, 30);
  }

  function closeOverlay(element) {
    if (!element) return;
    element.classList.remove('open');
    element.setAttribute('aria-hidden', 'true');

    if (
      !$('.modal-backdrop.open') &&
      !$('.comments-panel.open')
    ) {
      document.body.classList.remove('io-panel-open');
    }
  }

  // ===== 网站订阅 / Supabase =====
  const subscribeAction = $('#subscribeAction');
  const subscribeModal = $('#subscribeModal');

  const SUBSCRIPTION_KEY = 'impactone_daily_subscribed';
  const CONFIRMED_KEY =
    'impactone_daily_subscription_confirmed';
  const SUBSCRIBE_ENDPOINT =
    `${API_BASE}/api/daily-subscribe`;

  let subscriptionBusy = false;

  function getSubscriptionState() {
    return (
      storage.get(CONFIRMED_KEY, false) === true &&
      storage.get(SUBSCRIPTION_KEY, false) === true
    );
  }

  function renderSubscription() {
    if (!subscribeAction) return;

    const subscribed = getSubscriptionState();

    subscribeAction.innerHTML = subscriptionBusy
      ? '<span>处理中…</span>'
      : subscribed
        ? `${icon('check')}<span>已订阅</span>`
        : `${icon('plus')}<span>订阅</span>`;

    subscribeAction.classList.toggle('active', subscribed);
    subscribeAction.disabled = subscriptionBusy;
    subscribeAction.setAttribute(
      'aria-pressed', String(subscribed)
    );
    subscribeAction.setAttribute(
      'aria-label',
      subscribed
        ? '取消网站每日必读订阅'
        : '订阅网站每日必读'
    );
    subscribeAction.title = subscribed
      ? '点击取消网站订阅'
      : '点击订阅每日必读';
  }

  renderSubscription();

  // 微信公众号绑定为单独的用户主动操作；不会假装已经获得消息推送授权。
  if (/MicroMessenger/i.test(navigator.userAgent) && subscribeAction?.parentElement) {
    const bindButton = document.createElement('button');
    bindButton.type = 'button';
    bindButton.textContent = '绑定微信';
    bindButton.style.cssText = 'font:inherit;color:inherit;background:transparent;border:0;padding:8px;cursor:pointer';
    bindButton.setAttribute('aria-label', '绑定微信公众号接收可用通知');
    subscribeAction.parentElement.appendChild(bindButton);
    bindButton.addEventListener('click', async () => {
      if (!getSubscriptionState()) { toast('请先点击订阅'); return; }
      bindButton.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/wechat-official-start`, {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({client_id:clientId,return_url:location.href})
        });
        const result = await response.json();
        if (!response.ok || !result.authorize_url) throw new Error(result.error || 'OAuth unavailable');
        location.assign(result.authorize_url);
      } catch(error) { console.error('Official bind failed',error);toast('微信绑定暂不可用，请稍后重试');bindButton.disabled=false; }
    });
    const status = new URLSearchParams(location.search).get('wechat_bind');
    if (status === 'success') {
      bindButton.textContent = '微信已绑定';
      toast('微信身份绑定成功（消息通知尚待开通）');
      history.replaceState(null,'',location.pathname + location.search.replace(/([?&])wechat_bind=success&?/,'$1').replace(/[?&]$/,'') + location.hash);
    } else if (status) {
      toast('微信绑定未完成，请稍后重试');
    }
  }

  subscribeAction?.addEventListener('click', async () => {
    if (subscriptionBusy) return;

    const next = !getSubscriptionState();

    subscriptionBusy = true;
    renderSubscription();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(), 12000
      );

      let response;

      try {
        response = await fetch(SUBSCRIBE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            subscribed: next
          }),
          signal: controller.signal,
          cache: 'no-store'
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (
        result?.success !== true ||
        result?.subscribed !== next
      ) {
        throw new Error('Subscription not confirmed');
      }

      storage.set(SUBSCRIPTION_KEY, next);
      storage.set(CONFIRMED_KEY, true);

      closeOverlay(subscribeModal);

      toast(
        next
          ? '网站订阅成功（微信通知尚未开通）'
          : '已取消网站订阅'
      );

    } catch (error) {
      console.error('IMPACTONE subscription failed:', error);

      toast(
        error?.name === 'AbortError'
          ? '订阅请求超时，请稍后重试'
          : '订阅操作失败，请稍后重试'
      );
    } finally {
      subscriptionBusy = false;
      renderSubscription();
    }
  });

  $('[data-close-subscribe]')?.addEventListener(
    'click', () => closeOverlay(subscribeModal)
  );

  subscribeModal?.addEventListener('click', event => {
    if (event.target === subscribeModal) {
      closeOverlay(subscribeModal);
    }
  });

  // ===== 邮件订阅备用 =====
  const subscribeForm = $('#subscribeForm');
  const subscribeEmail = $('#subscribeEmail');
  const subscribeStatus = $('#subscribeStatus');

  $('[data-toggle-email]')?.addEventListener('click', () => {
    if (!subscribeForm) return;

    subscribeForm.hidden = !subscribeForm.hidden;

    if (!subscribeForm.hidden) {
      setTimeout(() => subscribeEmail?.focus(), 20);
    }
  });

  subscribeForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = (subscribeEmail?.value || '').trim();
    if (!email) return;

    const button = subscribeForm.querySelector(
      'button[type="submit"]'
    );

    if (button) {
      button.disabled = true;
      button.textContent = '提交中…';
    }

    if (subscribeStatus) subscribeStatus.textContent = '';

    try {
      if (cfg.subscribeEndpoint) {
        const response = await fetch(cfg.subscribeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            source: 'daily',
            issue: issueKey,
            url: location.href
          })
        });

        if (!response.ok) {
          throw new Error('subscribe failed');
        }
      }

      storage.set('impactone_subscriber_email', email);

      const message = cfg.subscribeEndpoint
        ? '邮件订阅成功。'
        : '邮箱已保存在当前浏览器，尚未开通邮件发送。';

      if (subscribeStatus) {
        subscribeStatus.textContent = message;
      }

      toast(message);
    } catch {
      if (subscribeStatus) {
        subscribeStatus.textContent =
          '暂时无法完成邮件订阅，请稍后再试。';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '邮件订阅';
      }
    }
  });

  // ===== 转发 =====
  const shareModal = $('#shareModal');
  const shareTitle = document.title;
  const shareText = '筛选全球资讯，把握天下大势。';
  const shareUrl = location.href;
  const encode = encodeURIComponent;

  const links = {
    linkedin:
      `https://www.linkedin.com/sharing/share-offsite/?url=${encode(shareUrl)}`,
    whatsapp:
      `https://wa.me/?text=${encode(shareTitle + ' ' + shareUrl)}`
  };

  $$('[data-share-link]').forEach(link => {
    link.href = links[link.dataset.shareLink] || shareUrl;
  });

  async function nativeShare() {
    if (!navigator.share) return false;

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      });
      return true;
    } catch (error) {
      return error?.name === 'AbortError';
    }
  }

  function fallbackCopyNoToast(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } catch {}

    textarea.remove();
  }

  function fallbackCopy(text) {
    fallbackCopyNoToast(text);
    toast('链接已复制');
  }

  async function copySilently() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        fallbackCopyNoToast(shareUrl);
      }
      return true;
    } catch {
      fallbackCopyNoToast(shareUrl);
      return false;
    }
  }

  async function copyLink() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        fallbackCopyNoToast(shareUrl);
      }
      toast('链接已复制');
    } catch {
      fallbackCopy(shareUrl);
    }
  }

  function openDeepLink(uri, webFallback, label) {
    const started = Date.now();
    window.location.href = uri;

    setTimeout(() => {
      if (
        Date.now() - started < 1800 &&
        document.visibilityState === 'visible' &&
        webFallback
      ) {
        window.location.href = webFallback;
      }
    }, 900);

    toast(
      `${label} 已打开；文章链接已复制，可直接粘贴发布`
    );
  }

  $('#shareAction')?.addEventListener('click', () => {
    openOverlay(shareModal);
  });

  $('[data-close-share]')?.addEventListener('click', () => {
    closeOverlay(shareModal);
    $('#wechatShareHint')?.classList.remove('show');
  });

  shareModal?.addEventListener('click', event => {
    if (event.target === shareModal) {
      closeOverlay(shareModal);
    }
  });

  $('[data-share="system"]')?.addEventListener(
    'click', async () => {
      if (!await nativeShare()) {
        toast('当前浏览器不支持系统分享，请使用复制链接');
      }
    }
  );

  $('[data-share="wechat"]')?.addEventListener(
    'click', async () => {
      if (!await nativeShare()) {
        await copyLink();
        toast('链接已复制，请在微信中发送');
      }
    }
  );

  $('[data-share="facebook-native"]')?.addEventListener(
    'click', () => {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encode(shareUrl)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  );

  $('[data-share="instagram"]')?.addEventListener(
    'click', async () => {
      await copySilently();
      openDeepLink(
        'instagram://camera',
        'https://www.instagram.com/',
        'Instagram'
      );
    }
  );

  $('[data-share="xiaohongshu"]')?.addEventListener(
    'click', async () => {
      await copySilently();
      openDeepLink(
        'xhsdiscover://post',
        'https://www.xiaohongshu.com/explore',
        '小红书'
      );
    }
  );

  $('[data-share="copy"]')?.addEventListener(
    'click', copyLink
  );

  // ===== Footer 社交账号 =====
  const profileNames = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    x: 'X',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    wechat: '微信'
  };

  const profiles = $('#socialProfiles');

  if (profiles && cfg.socialProfiles) {
    Object.entries(cfg.socialProfiles).forEach(([key, value]) => {
      if (!value) return;

      const link = document.createElement('a');
      link.href = value;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = profileNames[key] || key;
      profiles.appendChild(link);
    });
  }

  // ===== 收藏 =====
  const favoriteAction = $('#favoriteAction');

  function renderFavorite() {
    const active = storage.get(
      'impactone_favorite_' + issueKey, false
    );

    favoriteAction?.classList.toggle('active', active);

    if (favoriteAction) {
      favoriteAction.innerHTML = active
        ? `${icon('heartFill')}<span>已收藏</span>`
        : `${icon('heart')}<span>收藏</span>`;
    }
  }

  async function loadFavorite() {
    if (cfg.favoriteEndpoint) {
      try {
        const response = await fetch(
          `${cfg.favoriteEndpoint}?issue=${encodeURIComponent(issueKey)}&client_id=${encodeURIComponent(clientId)}`
        );

        if (response.ok) {
          const json = await response.json();
          storage.set(
            'impactone_favorite_' + issueKey,
            !!json.favorite
          );
        }
      } catch {}
    }

    renderFavorite();
  }

  loadFavorite();

  favoriteAction?.addEventListener('click', async () => {
    const next = !storage.get(
      'impactone_favorite_' + issueKey, false
    );

    storage.set('impactone_favorite_' + issueKey, next);
    renderFavorite();

    toast(
      next
        ? '已收藏到 IMPACTONE（当前保存在本机）'
        : '已取消收藏'
    );

    if (cfg.favoriteEndpoint) {
      try {
        await fetch(cfg.favoriteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issue: issueKey,
            client_id: clientId,
            favorite: next,
            url: location.href
          })
        });
      } catch {
        toast('收藏已保存在本机，云端同步稍后重试');
      }
    }
  });

  // ===== 评论 =====
  const commentsPanel = $('#commentsPanel');
  const commentAction = $('#commentAction');
  const commentForm = $('#commentForm');
  const commentList = $('#commentList');
  const commentCount = $('#commentCount');

  const commentsKey = 'impactone_comments_' + issueKey;

  const getLocalComments = () =>
    storage.get(commentsKey, []);

  const setLocalComments = value =>
    storage.set(commentsKey, value);

  let remoteComments = null;

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function formatTime(value) {
    const date = value ? new Date(value) : new Date();

    try {
      return date.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function visibleComments() {
    return remoteComments ?? getLocalComments();
  }

  function renderComments() {
    const comments = visibleComments();

    if (commentCount) {
      commentCount.textContent = comments.length
        ? String(comments.length)
        : '';
    }

    if (!commentList) return;

    commentList.innerHTML = comments.map((comment, index) => `
      <div class="comment-item">
        <div class="comment-meta">
          ${escapeHtml(comment.name || '读者')}
          · ${formatTime(comment.time || comment.created_at)}
          ${comment.pending
            ? '<span class="comment-pending">待审核</span>'
            : ''}
        </div>
        <div>${escapeHtml(comment.text)}</div>
        <div class="comment-actions">
          <button type="button" data-like="${index}">
            ♡ ${Number(comment.likes || 0)}
          </button>
          <button type="button" data-reply="${index}">
            回复
          </button>
        </div>
      </div>
    `).join('') ||
      '<p style="font-size:12px;color:#777">暂无评论。你可以写下第一条看法。</p>';

    $$('[data-like]', commentList).forEach(button => {
      button.addEventListener('click', () => {
        likeComment(Number(button.dataset.like));
      });
    });

    $$('[data-reply]', commentList).forEach(button => {
      button.addEventListener('click', () => {
        const comment =
          visibleComments()[Number(button.dataset.reply)];
        const textarea = $('#commentText');

        if (!textarea) return;

        textarea.value = '@' + (comment?.name || '读者') + ' ';
        textarea.focus();
      });
    });
  }

  async function loadComments() {
    if (!cfg.commentsEndpoint) {
      renderComments();
      return;
    }

    try {
      const response = await fetch(
        `${cfg.commentsEndpoint}?issue=${encodeURIComponent(issueKey)}`
      );

      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      remoteComments = await response.json();

      if (!Array.isArray(remoteComments)) {
        remoteComments = [];
      }

      renderComments();
    } catch {
      remoteComments = null;
      renderComments();
    }
  }

  function likeComment(index) {
    const comments = remoteComments ?? getLocalComments();
    if (!comments[index]) return;

    comments[index].likes =
      Number(comments[index].likes || 0) + 1;

    if (remoteComments === null) {
      setLocalComments(comments);
    }

    renderComments();

    if (cfg.commentsEndpoint && comments[index].id) {
      fetch(
        `${cfg.commentsEndpoint}/${comments[index].id}/like`,
        { method: 'POST' }
      ).catch(() => {});
    }
  }

  loadComments();

  commentAction?.addEventListener('click', () => {
    if (commentsPanel?.classList.contains('open')) {
      closeOverlay(commentsPanel);
    } else {
      openOverlay(commentsPanel);
    }
  });

  $('[data-close-comments]')?.addEventListener(
    'click', () => closeOverlay(commentsPanel)
  );

  commentForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const name = ($('#commentName')?.value || '').trim();
    const text = ($('#commentText')?.value || '').trim();
    if (!name || !text) return;

    const button = commentForm.querySelector(
      'button[type="submit"]'
    );

    if (button) button.disabled = true;

    try {
      if (cfg.commentsEndpoint) {
        const response = await fetch(cfg.commentsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issue: issueKey,
            name,
            text,
            url: location.href
          })
        });

        if (!response.ok) {
          throw new Error('Comment failed');
        }

        const created = await response.json();

        remoteComments = [
          {
            name,
            text,
            time: Date.now(),
            likes: 0,
            pending: true,
            ...created
          },
          ...(remoteComments || [])
        ];

        toast('评论已提交，审核后公开显示');
      } else {
        const comments = getLocalComments();

        comments.unshift({
          name,
          text,
          time: Date.now(),
          likes: 0
        });

        setLocalComments(comments);
        toast('评论已发布（本机预览）');
      }

      const commentText = $('#commentText');
      if (commentText) commentText.value = '';

      renderComments();
    } catch {
      toast('评论提交失败，请稍后再试');
    } finally {
      if (button) button.disabled = false;
    }
  });

  // ===== ESC 关闭弹窗 =====
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeOverlay(subscribeModal);
      closeOverlay(shareModal);
      closeOverlay(commentsPanel);
    }
  });

  // ===== 图标 =====
  function icon(type) {
    const paths = {
      plus:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      check:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
      heart:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
      heartFill:
        '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>'
    };

    return `
      <span class="ico">
        ${paths[type] || ''}
      </span>
    `;
  }

})();

