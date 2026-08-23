(function () {
  'use strict';

  const MEASUREMENT_ID = 'G-P0LGWRTE4C';
  const STORAGE_KEY = 'kp_analytics_consent_v1';
  const DISMISS_KEY = 'kp_analytics_banner_dismissed_v1';
  const GRANTED = 'granted';
  const DENIED = 'denied';
  let memoryConsent = null;
  let memoryDismissed = false;
  let tagLoaded = false;
  let lastPageLocation = '';
  let pageViewTimer = 0;
  let banner = null;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function consentState(analyticsStorage) {
    return {
      ad_storage: DENIED,
      ad_user_data: DENIED,
      ad_personalization: DENIED,
      analytics_storage: analyticsStorage,
      personalization_storage: DENIED
    };
  }

  // This queues a local default only. The Google tag is not requested until
  // the visitor explicitly grants analytics consent.
  window.gtag('consent', 'default', consentState(DENIED));
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);

  function readConsent() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === GRANTED || stored === DENIED) return stored;
    } catch (error) {
      // Private browsing or a locked-down browser can disable localStorage.
    }
    return memoryConsent;
  }

  function storeConsent(value) {
    memoryConsent = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // The in-memory choice still applies for this page view.
    }
  }

  // Closing the banner is not a choice: nothing is recorded and analytics stays
  // unloaded. The banner only steps aside for the current browsing session, so
  // the question comes back on the next visit instead of being lost.
  function readDismissed() {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === '1') return true;
    } catch (error) {
      // Private browsing or a locked-down browser can disable sessionStorage.
    }
    return memoryDismissed;
  }

  function storeDismissed() {
    memoryDismissed = true;
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch (error) {
      // The in-memory dismissal still applies for this page view.
    }
  }

  function currentPagePath() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function sendPageView() {
    if (!tagLoaded || readConsent() !== GRANTED) return;
    const pageLocation = window.location.href;
    if (pageLocation === lastPageLocation) return;
    lastPageLocation = pageLocation;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: pageLocation,
      page_path: currentPagePath()
    });
  }

  function schedulePageView() {
    window.clearTimeout(pageViewTimer);
    pageViewTimer = window.setTimeout(sendPageView, 120);
  }

  function loadGoogleAnalytics() {
    if (tagLoaded) return;
    tagLoaded = true;
    window.gtag('consent', 'update', consentState(GRANTED));

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    script.dataset.kpAnalytics = 'true';
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    schedulePageView();
  }

  function setBannerVisibility(forceOpen) {
    if (!banner) return;
    banner.hidden = !forceOpen && (readConsent() !== null || readDismissed());
  }

  function dismissBanner() {
    storeDismissed();
    setBannerVisibility(false);
  }

  function chooseConsent(value) {
    const hadLoadedTag = tagLoaded;
    storeConsent(value);
    window.gtag('consent', 'update', consentState(value));

    if (value === GRANTED) {
      loadGoogleAnalytics();
      setBannerVisibility(false);
    } else {
      setBannerVisibility(false);
      // Basic consent mode sends nothing after refusal. If the tag was already
      // loaded during this page view, reload once so it is removed entirely.
      if (hadLoadedTag) window.setTimeout(function () { window.location.reload(); }, 0);
    }

    window.dispatchEvent(new CustomEvent('kp-analytics-consent-change', {
      detail: { analytics: value }
    }));
  }

  function createBanner() {
    banner = document.createElement('section');
    banner.className = 'kp-analytics-consent';
    banner.id = 'kp-analytics-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'kp-analytics-consent-title');
    banner.setAttribute('aria-describedby', 'kp-analytics-consent-copy');
    banner.hidden = true;
    banner.innerHTML = [
      '<div class="kp-analytics-consent__header">',
      '<h2 class="kp-analytics-consent__title" id="kp-analytics-consent-title">Optional analytics</h2>',
      '<button class="kp-analytics-consent__close" type="button" aria-label="Close privacy choices">&times;</button>',
      '</div>',
      '<p class="kp-analytics-consent__copy" id="kp-analytics-consent-copy">',
      'Google Analytics helps measure visits and improve this portfolio. It stays completely unloaded unless you allow it. ',
      '<a href="privacy.html">Privacy details</a>.',
      '</p>',
      '<div class="kp-analytics-consent__actions">',
      '<button class="kp-analytics-consent__button kp-analytics-consent__button--decline" type="button" data-consent="denied">Decline</button>',
      '<button class="kp-analytics-consent__button kp-analytics-consent__button--allow" type="button" data-consent="granted">Allow analytics</button>',
      '</div>'
    ].join('');

    banner.addEventListener('click', function (event) {
      const choice = event.target.closest('[data-consent]');
      if (choice) chooseConsent(choice.getAttribute('data-consent'));
      if (event.target.closest('.kp-analytics-consent__close')) dismissBanner();
    });
    document.body.appendChild(banner);
  }

  function openChoices() {
    setBannerVisibility(true);
    const firstChoice = banner && banner.querySelector('[data-consent="denied"]');
    if (firstChoice) firstChoice.focus();
  }

  function init() {
    createBanner();
    document.addEventListener('click', function (event) {
      const trigger = event.target.closest && event.target.closest('[data-analytics-choices]');
      if (!trigger) return;
      event.preventDefault();
      openChoices();
    });
    window.addEventListener('hashchange', schedulePageView);

    if (readConsent() === GRANTED) loadGoogleAnalytics();
    setBannerVisibility(false);
  }

  window.KPAnalytics = {
    measurementId: MEASUREMENT_ID,
    getConsent: readConsent,
    setConsent: chooseConsent,
    openChoices: openChoices
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
