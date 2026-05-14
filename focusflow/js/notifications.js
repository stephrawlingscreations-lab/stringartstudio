/**
 * Notifications — PWA service worker registration + reminder alerts.
 */
const Notifications = (() => {
  const NOTIFIED_PREFIX = 'ff_notified_';

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

    const today      = DateUtil.today();
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

  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied')  return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Ask for permission after a short delay so the app finishes loading first
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(requestPermission, 4000);
    }
  }

  return { init, checkDue };
})();
