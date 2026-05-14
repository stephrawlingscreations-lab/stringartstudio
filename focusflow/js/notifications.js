/**
 * Notifications — PWA service worker registration + reminder alerts.
 */
const Notifications = (() => {
  const NOTIFIED_PREFIX  = 'ff_notified_';
  const BANNER_DISMISSED = 'ff_notif_dismissed';

  function iconUrl() {
    return new URL('icon.svg', window.location.href).href;
  }

  function getTodayKey() {
    return NOTIFIED_PREFIX + DateUtil.today();
  }

  function getNotifiedIds() {
    try { return JSON.parse(localStorage.getItem(getTodayKey()) || '[]'); }
    catch { return []; }
  }

  function markNotified(id) {
    const ids = getNotifiedIds();
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem(getTodayKey(), JSON.stringify(ids));

    // Clean up keys older than yesterday
    const cutoff = NOTIFIED_PREFIX + DateUtil.addDays(DateUtil.today(), -1);
    Object.keys(localStorage)
      .filter(k => k.startsWith(NOTIFIED_PREFIX) && k < cutoff)
      .forEach(k => localStorage.removeItem(k));
  }

  async function checkDue() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const today       = DateUtil.today();
    const notifiedIds = getNotifiedIds();
    const due = Storage.getReminders().filter(r =>
      !r.done && r.date && r.date <= today && !notifiedIds.includes(r.id)
    );
    if (!due.length) return;

    let swReg = null;
    if ('serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.ready.catch(() => null);
    }

    for (const r of due) {
      const overdue = r.date < today;
      const title   = overdue ? '⚠ Overdue reminder' : '🔔 Reminder due today';
      const opts    = {
        body:  r.text,
        icon:  iconUrl(),
        badge: iconUrl(),
        tag:   'ff-' + r.id,
        data:  { url: window.location.href }
      };
      try {
        if (swReg) {
          await swReg.showNotification(title, opts);
        } else {
          new Notification(title, opts);
        }
        markNotified(r.id);
      } catch (e) {
        console.warn('Notification failed:', e);
      }
    }
  }

  function showBanner() {
    if (localStorage.getItem(BANNER_DISMISSED)) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const banner = document.createElement('div');
    banner.id = 'notif-banner';
    banner.innerHTML = `
      <span class="notif-banner-text">🔔 Get reminder alerts on this device</span>
      <div class="notif-banner-actions">
        <button class="notif-banner-btn-yes">Enable</button>
        <button class="notif-banner-btn-no">Not now</button>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('.notif-banner-btn-yes').addEventListener('click', async () => {
      banner.remove();
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        Toast.success('Notifications enabled!');
        checkDue();
      }
    });

    banner.querySelector('.notif-banner-btn-no').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem(BANNER_DISMISSED, '1');
    });
  }

  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    // Show opt-in banner after app loads — iOS requires a tap to grant permission
    setTimeout(showBanner, 2000);
  }

  return { init, checkDue };
})();
