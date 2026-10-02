// GHRAB – ochrana proti vložení aplikace do cizího rámu (GARP 2.8, kontrola S-BRW-12).
// GitHub Pages neumí poslat hlavičku frame-ancestors a meta CSP ji ignoruje; proto skript.
// Vložit jako PRVNÍ klasický skript v <head>, hned za CSP.
// Rám ze stejného původu (AI Studio) je povolen; cizí původ i sandbox bez allow-same-origin ne.
(function () {
  'use strict';
  if (window.top === window.self) return;
  var sameOrigin = false;
  try { sameOrigin = window.top.location.origin === window.location.origin; } catch (e) { sameOrigin = false; }
  if (sameOrigin) return;
  document.documentElement.setAttribute('data-ghrab-framed', 'blocked');
  document.documentElement.style.setProperty('display', 'none', 'important');
  if (typeof window.stop === 'function') window.stop();
  throw new Error('GHRAB_FRAMED_BY_FOREIGN_ORIGIN');
})();
