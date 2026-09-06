/* IMPACTONE runtime endpoints and social profile links.
   Preview works with empty endpoints using localStorage.
   Production: deploy Supabase Edge Functions and paste their URLs here. */
window.IMPACTONE_CONFIG = {
  subscribeEndpoint: "",
  commentsEndpoint: "",
  favoriteEndpoint: "",
  sendDailyEndpoint: "",
  /* Web Push: leave blank during front-end testing. Fill these after the push backend is deployed. */
  pushSubscribeEndpoint: "",
  pushUnsubscribeEndpoint: "",
  vapidPublicKey: "",
  socialProfiles: {
    facebook: "",
    instagram: "",
    x: "",
    linkedin: "",
    youtube: "",
    wechat: "",
    xiaohongshu: ""
  }
};
