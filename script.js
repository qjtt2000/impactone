// ==========================================
// IMPACTONE
// Mobile Navigation + Newsletter
// ==========================================


// ------------------------------------------
// MOBILE MENU
// ------------------------------------------

const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (menuBtn && mobileMenu) {

  menuBtn.addEventListener("click", function () {

    mobileMenu.classList.toggle("open");

  });

}


// ------------------------------------------
// NEWSLETTER SUBSCRIPTION
// ------------------------------------------

const newsletterForm =
  document.getElementById("newsletterForm");

if (newsletterForm) {

  newsletterForm.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();

      const emailInput =
        document.getElementById("email");

      const message =
        document.getElementById("formMessage");

      const email =
        emailInput.value.trim();


      // Email 为空时停止
      if (!email) {
        return;
      }


      // ======================================
      // CURRENT DEMO STORAGE
      //
      // 目前暂时储存在访问者自己的浏览器。
      //
      // 正式运营时，这里将替换成：
      //
      // Brevo
      // Mailchimp
      // ConvertKit
      // 或
      // Supabase + Resend
      //
      // ======================================

      const subscribers =
        JSON.parse(
          localStorage.getItem(
            "impactone_subscribers"
          ) || "[]"
        );


      // 防止同一邮箱重复加入

      if (!subscribers.includes(email)) {

        subscribers.push(email);

        localStorage.setItem(
          "impactone_subscribers",
          JSON.stringify(subscribers)
        );

      }


      // 显示成功信息

      if (message) {

        message.textContent =
          "订阅成功。感谢关注 IMPACTONE《影响力·每日必读》。";

      }


      // 清空输入框

      newsletterForm.reset();

    }
  );

}
