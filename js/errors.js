/* ==========================================================================
   EVACROUTE — js/errors.js
   Early error capture: a separate script so a syntax error in any later
   script is still reported instead of failing silently.
   ========================================================================== */
'use strict';

window.__EVACROUTE_ERRORS__ = [];
(function () {
  function record(msg) {
    try {
      window.__EVACROUTE_ERRORS__.push(String(msg));
      var el = document.getElementById('js-error');
      if (!el) {
        el = document.createElement('pre');
        el.id = 'js-error';
        el.hidden = true;
        (document.body || document.documentElement).appendChild(el);
      }
      el.textContent = window.__EVACROUTE_ERRORS__.join('\n');
    } catch (e) { /* never throw from the error reporter itself */ }
  }
  window.addEventListener('error', function (e) {
    record(e && e.message ? e.message : 'script error' + (e && e.filename ? ' @' + e.filename + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    record('unhandled rejection: ' + ((e && e.reason && e.reason.message) || e && e.reason || 'unknown'));
  });
})();
