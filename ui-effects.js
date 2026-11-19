/**
 * BingeMatch Pro - Pure Visual & UI Enhancements (ui-effects.js)
 * Strict Rule: Only handles visual flourishes, scroll states, and progressive animations.
 * Never modifies application state, user data, or API logic.
 */

(function () {
    'use strict';

    // 1. Passive Navbar Scroll Listener
    function initNavbarScrollEffect() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        let ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.scrollY > 35;
                    if (scrolled) {
                        navbar.classList.add('nav-scrolled');
                    } else {
                        navbar.classList.remove('nav-scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll(); // initial state
    }

    // 2. Tab Visibility Pause (Conserves CPU & 60fps Battery)
    function initVisibilityWatcher() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                document.body.classList.add('bg-anim-paused');
            } else {
                document.body.classList.remove('bg-anim-paused');
            }
        }, { passive: true });
    }

    // 3. Staggered Card Entry with IntersectionObserver & MutationObserver
    function initCardStaggerAnimation() {
        const grid = document.getElementById('movieGrid');
        if (!grid) return;

        // Check if browser prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            return; // Skip animation if user prefers reduced motion
        }

        let observer = null;
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        card.classList.add('card-animate-in');
                        observer.unobserve(card);
                    }
                });
            }, {
                rootMargin: '0px 0px -20px 0px',
                threshold: 0.08
            });
        }

        function observeCards() {
            const cards = grid.querySelectorAll('.movie-card:not(.card-animate-in)');
            cards.forEach((card, index) => {
                // Progressive enhancement: cards are ALWAYS visible (opacity: 1) by default in CSS.
                // Apply a subtle stagger delay only if animating.
                card.style.animationDelay = ((index % 6) * 40) + 'ms';
                if (observer) {
                    observer.observe(card);
                } else {
                    card.classList.add('card-animate-in');
                }
            });
        }

        // Initial check for existing cards
        observeCards();

        // MutationObserver: dynamically catches cards whenever filters, search, or pagination re-render
        if ('MutationObserver' in window) {
            const mutObserver = new MutationObserver(() => {
                observeCards();
            });
            mutObserver.observe(grid, { childList: true });
        }
    }

    // 4. Initialize once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initNavbarScrollEffect();
            initVisibilityWatcher();
            initCardStaggerAnimation();
        });
    } else {
        initNavbarScrollEffect();
        initVisibilityWatcher();
        initCardStaggerAnimation();
    }
})();
