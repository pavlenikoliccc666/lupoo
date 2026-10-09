const heroVideo = document.querySelector('#hero-film');
if (heroVideo) {
  const videoMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let heroInView = true;
  heroVideo.muted = true;
  const syncHeroVideo = () => {
    if (document.hidden || !heroInView || videoMotionPreference.matches || navigator.connection?.saveData) {
      heroVideo.pause();
      return;
    }
    heroVideo.play().catch(() => { /* Keep the poster when autoplay is unavailable. */ });
  };
  document.addEventListener('visibilitychange', syncHeroVideo);
  videoMotionPreference.addEventListener('change', syncHeroVideo);
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(entries => {
      heroInView = entries[0].isIntersecting;
      syncHeroVideo();
    }, { threshold: 0.05 });
    heroObserver.observe(heroVideo);
  }
  syncHeroVideo();
}
