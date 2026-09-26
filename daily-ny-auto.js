(() => {
  const OWNER = 'qjtt2000';
  const REPO = 'impactone';
  const BRANCH = 'main';

  const API =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/daily?ref=${BRANCH}`;

  const RAW =
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/daily/`;

  /*
   * 只识别纽约版：
   *
   * 2026-09-24-ny.html
   * 2026-09-25-ny.html
   * 2026-09-26-ny.html
   *
   * 不会识别国际版：
   * 2026-09-26.html
   */
  const ISSUE_RE =
    /^(\d{4})-(\d{2})-(\d{2})-ny\.html$/;


  const esc = s =>
    String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);


  const clean = s =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim();


  const dot = i =>
    `${i.y}.${i.m}.${i.d}`;


  /*
   * 从 GitHub daily 文件夹读取
   * 所有纽约版日报。
   */
  async function issues() {
    const r = await fetch(API, {
      headers: {
        Accept: 'application/vnd.github+json'
      },
      cache: 'no-store'
    });

    if (!r.ok) {
      throw new Error(
        `GitHub API ${r.status}`
      );
    }

    const data = await r.json();

    return data
      .map(f => {
        const m =
          ISSUE_RE.exec(f.name);

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


  /*
   * 读取某一期纽约日报。
   */
  async function issueDoc(i) {
    const r = await fetch(
      RAW + i.name,
      {
        cache: 'no-store'
      }
    );

    if (!r.ok) {
      throw new Error(
        `Issue ${r.status}`
      );
    }

    return new DOMParser()
      .parseFromString(
        await r.text(),
        'text/html'
      );
  }


  /*
   * 如果以后首页加入纽约日报自动摘要，
   * 这里可以自动读取最新一期4条焦点。
   *
   * 只有页面存在 #daily-ny-auto
   * 才会运行，因此不会影响当前首页。
   */
  async function renderHome(list) {
    const root =
      document.querySelector(
        '#daily-ny-auto'
      );

    if (
      !root ||
      !list.length
    ) {
      return;
    }

    const latest =
      list[0];

    const doc =
      await issueDoc(latest);


    const latestDate =
      root.querySelector(
        '[data-latest-date]'
      );

    if (latestDate) {
      latestDate.textContent =
        dot(latest);
    }


    const target =
      root.querySelector(
        '[data-latest-stories]'
      );

    if (target) {
      target.innerHTML = '';

      [...doc.querySelectorAll('.story')]
        .slice(0, 4)
        .forEach(
          (story, idx) => {

            const title =
              clean(
                story
                  .querySelector('h3')
                  ?.textContent
              );


            const p =
              [
                ...story.querySelectorAll(
                  'p'
                )
              ].find(el =>
                !el.classList.contains(
                  'analysis'
                ) &&
                !/^\s*来源[｜|]/.test(
                  el.textContent
                )
              );


            const summary =
              clean(
                p?.textContent
              );


            let analysis =
              clean(
                story
                  .querySelector(
                    '.analysis'
                  )
                  ?.textContent
              );


            analysis =
              analysis.replace(
                /^观察[｜|]\s*/,
                ''
              );


            const article =
              document.createElement(
                'article'
              );

            article.className =
              'brief';


            article.innerHTML = `
              <span class="number">
                ${String(idx + 1)
                  .padStart(2, '0')}
              </span>

              <div>

                <h3>
                  ${esc(title)}
                </h3>

                <p>
                  ${esc(summary)}
                </p>

                ${
                  analysis
                    ? `
                      <small>
                        <b>观察：</b>
                        ${esc(analysis)}
                      </small>
                    `
                    : ''
                }

              </div>
            `;


            target.appendChild(
              article
            );
          }
        );
    }


    const a =
      root.querySelector(
        '[data-latest-link]'
      );


    if (a) {
      a.href =
        `daily/${latest.name}`;

      a.textContent =
        `阅读${Number(latest.m)}月${Number(latest.d)}日完整纽约日报 →`;
    }
  }


  /*
   * 渲染纽约日报目录页：
   *
   * 最新一期
   * +
   * 往期纽约日报
   */
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
    ) {
      return;
    }


    /*
     * 排序后的第一条
     * 自动作为最新一期。
     */
    const latest =
      list[0];


    const latestDate =
      card.querySelector(
        '[data-latest-date]'
      );


    if (latestDate) {
      latestDate.textContent =
        dot(latest);
    }


    const latestLink =
      card.querySelector(
        '[data-latest-link]'
      );


    if (latestLink) {
      latestLink.href =
        `daily/${latest.name}`;

      latestLink.textContent =
        `阅读 ${dot(latest)} 完整纽约日报 →`;
    }


    /*
     * 其余全部自动进入往期。
     */
    archive.innerHTML = '';


    list
      .slice(1)
      .forEach(i => {

        const a =
          document.createElement(
            'a'
          );


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
              影响力·纽约·每日必读
            </h3>

            <p>
              筛选纽约资讯，
              把握城市脉动。
            </p>

          </div>

          <div class="archive-arrow">
            →
          </div>

        `;


        archive.appendChild(a);
      });
  }


  /*
   * 初始化
   */
  async function init() {
    try {

      const list =
        await issues();


      /*
       * 如果以后首页加入纽约版自动摘要，
       * 自动读取。
       */
      await renderHome(list);


      /*
       * 渲染 daily-ny.html
       */
      renderDaily(list);

    } catch (err) {

      console.error(
        'IMPACTONE New York daily auto update failed:',
        err
      );

    }
  }


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init
    );

  } else {

    init();

  }

})();
