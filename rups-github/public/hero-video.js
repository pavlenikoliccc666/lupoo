const heroVideo = document.querySelector('#hero-film');
if (heroVideo) {
  const videoMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let heroInView = true;
  heroVideo.muted = true;
  const playButton = document.querySelector('.about-play');
  if (heroVideo.dataset.mobileSrc && matchMedia('(max-width: 720px)').matches) {
    heroVideo.src = heroVideo.dataset.mobileSrc;
  }
  const playHero = () => heroVideo.play().then(() => {
    if (playButton) playButton.hidden = true;
  }).catch(() => {
    if (playButton) playButton.hidden = false;
  });
  playButton?.addEventListener('click', playHero);
  const syncHeroVideo = () => {
    if (document.hidden || !heroInView || videoMotionPreference.matches || navigator.connection?.saveData) {
      heroVideo.pause();
      return;
    }
    playHero();
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
