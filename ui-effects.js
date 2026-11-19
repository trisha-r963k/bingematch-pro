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

    // 4. Hero Motion VFX Canvas (Hotstar/Netflix Anamorphic Flares & Ambient Embers)
    function initHeroCinematicVFX() {
        const canvas = document.getElementById('heroCinematicCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.width = canvas.offsetWidth || 600;
        let height = canvas.height = canvas.offsetHeight || 450;

        function handleResize() {
            if (!canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.offsetWidth || 600;
            height = canvas.height = canvas.parentElement.offsetHeight || 450;
        }
        window.addEventListener('resize', handleResize, { passive: true });
        handleResize();

        // Particles & Anamorphic Streaks
        const particles = [];
        const count = 35;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.45,
                vy: -Math.random() * 0.6 - 0.2, // drifting upwards like embers
                radius: Math.random() * 2 + 0.8,
                alpha: Math.random() * 0.6 + 0.2,
                color: Math.random() > 0.4 ? 'rgba(229, 9, 20, ' : 'rgba(255, 120, 60, '
            });
        }

        let flarePhase = 0;
        let animId = null;

        function render() {
            if (document.hidden || document.body.classList.contains('bg-anim-paused')) {
                animId = requestAnimationFrame(render);
                return;
            }

            ctx.clearRect(0, 0, width, height);
            flarePhase += 0.015;

            // Draw Subtle Anamorphic Cinematic Lens Flare (Horizontal Glow Strip)
            const flareY = height * 0.42 + Math.sin(flarePhase) * 20;
            const flareWidth = width * 0.85;
            const flareGrad = ctx.createLinearGradient(width * 0.5 - flareWidth / 2, flareY, width * 0.5 + flareWidth / 2, flareY);
            flareGrad.addColorStop(0, 'rgba(229, 9, 20, 0)');
            flareGrad.addColorStop(0.5, `rgba(229, 9, 20, ${0.12 + Math.sin(flarePhase * 2) * 0.04})`);
            flareGrad.addColorStop(1, 'rgba(229, 9, 20, 0)');

            ctx.fillStyle = flareGrad;
            ctx.fillRect(width * 0.5 - flareWidth / 2, flareY - 12, flareWidth, 24);

            // Floating Cinematic Embers
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.y < 0) {
                    p.y = height + 10;
                    p.x = Math.random() * width;
                }
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color + p.alpha + ')';
                ctx.shadowColor = 'rgba(229, 9, 20, 0.5)';
                ctx.shadowBlur = 6;
                ctx.fill();
            });
            ctx.shadowBlur = 0;

            animId = requestAnimationFrame(render);
        }

        render();
    }

    // 5. Global Netflix Audio Toggle
    window.toggleHeroAudio = function(event) {
        if (event) event.stopPropagation();
        const video = document.getElementById('heroTrailerVideo');
        const icon = document.getElementById('heroAudioIcon');
        const label = document.getElementById('heroAudioLabel');
        const btn = document.getElementById('heroAudioToggleBtn');

        if (!video) return;

        video.muted = !video.muted;

        if (video.muted) {
            if (icon) icon.className = "fa-solid fa-volume-xmark";
            if (label) label.innerText = "Muted";
            if (btn) btn.classList.remove('active');
        } else {
            if (icon) icon.className = "fa-solid fa-volume-high";
            if (label) label.innerText = "Sound On";
            if (btn) btn.classList.add('active');

            // Play video if browser paused it
            video.play().catch(() => {});

            // Subtle cinematic synthesizer riser if video has no audio track
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(55, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.6);
                    gain.gain.setValueAtTime(0.08, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.8);
                }
            } catch (e) {}
        }
    };

    // 6. Expandable Drawer Toggle for Compact Horizontal Filter Strip
    window.toggleMoreFilters = function() {
        const drawer = document.getElementById('moreFiltersDrawer');
        const btn = document.getElementById('moreFiltersToggleBtn');
        if (!drawer) return;
        const isHidden = drawer.classList.contains('hidden');
        if (isHidden) {
            drawer.classList.remove('hidden');
            if (btn) btn.classList.add('active');
        } else {
            drawer.classList.add('hidden');
            if (btn) btn.classList.remove('active');
        }
    };

    // 6. Initialize once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initNavbarScrollEffect();
            initVisibilityWatcher();
            initCardStaggerAnimation();
            initHeroCinematicVFX();
        });
    } else {
        initNavbarScrollEffect();
        initVisibilityWatcher();
        initCardStaggerAnimation();
        initHeroCinematicVFX();
    }
})();
