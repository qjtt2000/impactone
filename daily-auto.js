(() => {
  const OWNER = 'qjtt2000';
  const REPO = 'impactone';
  const BRANCH = 'main';

  const API =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/daily?ref=${BRANCH}`;

  const RAW =
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/daily/`;

  const ISSUE_RE =
    /^(\d{4})-(\d{2})-(\d{2})\.html$/;

  const esc = s =>
    String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);

  const clean = s =>
    String(s || '').replace(/\s+/g, ' ').trim();

  const dot = i =>
    `${i.y}.${i.m}.${i.d}`;

  async function issues() {
    const r = await fetch(API, {
      headers: {
        Accept: 'application/vnd.github+json'
      },
      cache: 'no-store'
    });

    if (!r.ok) {
      throw new Error(`GitHub API ${r.status}`);
    }

    const data = await r.json();

    return data
      .map(f => {
        const m = ISSUE_RE.exec(f.name);

        return m
          ? {
              name: f.name,
              y: m[1],
              m: m[2],
              d: m[3]
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) =>
        b.name.localeCompare(a.name)
      );
  }

  async function issueDoc(i) {
    const r = await fetch(
      RAW + i.name,
      { cache: 'no-store' }
    );

    if (!r.ok) {
      throw new Error(`Issue ${r.status}`);
    }

    return new DOMParser().parseFromString(
      await r.text(),
      'text/html'
    );
  }

  async function renderHome(list) {
    const root =
      document.querySelector('#daily-auto');

    if (!root || !list.length) return;

    const latest = list[0];
    const doc = await issueDoc(latest);

    root
      .querySelector('[data-latest-date]')
      .textContent = dot(latest);

    const target =
      root.querySelector('[data-latest-stories]');

    target.innerHTML = '';

    [...doc.querySelectorAll('.story')]
      .slice(0, 4)
      .forEach((story, idx) => {

        const title = clean(
          story.querySelector('h3')?.textContent
        );

        const p =
          [...story.querySelectorAll('p')]
            .find(el =>
              !el.classList.contains('analysis') &&
              !/^\s*来源[｜|]/.test(el.textContent)
            );

        const summary =
          clean(p?.textContent);

        let analysis =
          clean(
            story.querySelector('.analysis')
              ?.textContent
          );

        analysis =
          analysis.replace(
            /^观察[｜|]\s*/,
            ''
          );

        const article =
          document.createElement('article');

        article.className = 'brief';

        article.innerHTML = `
          <span class="number">
            ${String(idx + 1).padStart(2, '0')}
          </span>

          <div>
            <h3>${esc(title)}</h3>

            <p>${esc(summary)}</p>

            ${
              analysis
                ? `<small>
                     <b>观察：</b>
                     ${esc(analysis)}
                   </small>`
                : ''
            }
          </div>
        `;

        target.appendChild(article);
      });

    const a =
      root.querySelector(
        '[data-latest-link]'
      );

    a.href =
      `daily/${latest.name}`;

    a.textContent =
      `阅读${Number(latest.m)}月${Number(latest.d)}日完整每日必读 →`;
  }

  function renderDaily(list) {
    const card =
      document.querySelector(
        '[data-daily-latest]'
      );

    const archive =
      document.querySelector(
        '[data-daily-archive]'
      );

    if (
      !card ||
      !archive ||
      !list.length
    ) return;

    const latest = list[0];

    card
      .querySelector(
        '[data-latest-date]'
      )
      .textContent = dot(latest);

    const latestLink =
      card.querySelector(
        '[data-latest-link]'
      );

    latestLink.href =
      `daily/${latest.name}`;

    latestLink.textContent =
      `阅读 ${dot(latest)} 完整每日必读 →`;

    archive.innerHTML = '';

    list.slice(1).forEach(i => {

      const a =
        document.createElement('a');

      a.className =
        'daily-archive-item';

      a.href =
        `daily/${i.name}`;

      a.innerHTML = `
        <div class="archive-date">
          ${i.m}.${i.d}
        </div>

        <div class="archive-content">

          <span>
            ${i.y}
          </span>

          <h3>
            影响力·每日必读
          </h3>

          <p>
            全球经济、商业、资本、
            科技与政策重要变化。
          </p>

        </div>

        <div class="archive-arrow">
          →
        </div>
      `;

      archive.appendChild(a);
    });
  }

  async function init() {
    try {
      const list = await issues();

      await renderHome(list);

      renderDaily(list);

    } catch (err) {
      console.error(
        'IMPACTONE daily auto update failed:',
        err
      );
    }
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }
})();
