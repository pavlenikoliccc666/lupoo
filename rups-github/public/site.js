const navToggle = document.querySelector('.menu-toggle');
const navPanel = document.querySelector('#mobile-nav');
function closeNavigation() {
  navPanel.hidden = true;
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-label', 'Open navigation');
}
navToggle?.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') !== 'true';
  navToggle.setAttribute('aria-expanded', String(expanded));
  navToggle.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  navPanel.hidden = !expanded;
});
navPanel?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNavigation));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navPanel && !navPanel.hidden) { closeNavigation(); navToggle.focus(); }
});
document.addEventListener('click', event => {
  if (navPanel && !navPanel.hidden && !event.target.closest('.header')) closeNavigation();
});
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
function stopMotion() {
  revealObserver?.disconnect();
  document.querySelectorAll('.reveal').forEach(node => node.classList.remove('reveal'));
}
if (!document.documentElement.classList.contains('no-motion') && !motionPreference.matches && 'IntersectionObserver' in window) {
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('.benefits article,.section-heading,.solution-card,.steps article,.knowledge-note,.value-grid article,.about-story>div,.policy-heading,.closing h2').forEach((node, index) => {
    node.classList.add('reveal');
    node.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 70}ms`);
    revealObserver.observe(node);
  });
}
motionPreference.addEventListener('change', event => { if (event.matches) stopMotion(); });
document.querySelectorAll('#year').forEach(node => { node.textContent = new Date().getFullYear(); });
