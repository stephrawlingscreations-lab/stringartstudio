document.addEventListener('DOMContentLoaded', function () {
  var btn = document.querySelector('.hamburger');
  var nav = document.querySelector('.nav-links') || document.querySelector('.site-nav-links');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
});
