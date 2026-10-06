document.documentElement.classList.add('js');

const revealItems = [...document.querySelectorAll('.reveal')];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function updateRevealEffects() {
  const viewportHeight = window.innerHeight;

  revealItems.forEach((item) => {
    const rect = item.getBoundingClientRect();
    item.classList.toggle('visible', rect.top < viewportHeight * 0.9);
  });
}

if (prefersReducedMotion) {
  revealItems.forEach((item) => {
    item.classList.add('visible');
  });
  document.body.classList.add('loaded');
} else {
  window.addEventListener('scroll', updateRevealEffects, { passive: true });
  window.addEventListener('resize', updateRevealEffects);

  window.addEventListener('load', () => {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      updateRevealEffects();
      document.body.classList.add('loaded');
    }, 800);
  });
}
