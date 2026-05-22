// ================================
//   DAILY NEWS - JAVASCRIPT
// ================================


// ================================
// 1. LIVE DATE IN TOP BAR
// ================================
function setCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        dateElement.textContent = now.toLocaleDateString('en-GB', options);
    }
}

setCurrentDate();


// ================================
// 2. ACTIVE NAV LINK HIGHLIGHTER
// ================================
function setActiveNav() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.section-nav a');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href') || '';
        const linkPage = href.split('/').pop().split('?')[0];
        if (linkPage === currentPage && !href.includes('?')) {
            link.classList.add('active');
        }
    });
}

setActiveNav();


// ================================
// 3. SMOOTH HOVER ON NEWS CARDS
// ================================
function addCardHovers() {
    const cards = document.querySelectorAll('.news-card, .side-story, .opinion-card');

    cards.forEach(card => {
        card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        card.style.cursor = 'pointer';

        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-3px)';
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });

        // NOTE: Click navigation is handled per-card in the inline Firebase script.
        // Do NOT add a blanket window.location.href = 'article.html' here,
        // as it would override the correct article ID routing.
    });
}

addCardHovers();


// ================================
// 4. NEWSLETTER SUBSCRIBE BUTTON
// ================================
function setupNewsletter() {
    const subscribeBtn = document.querySelector('.subscribe-btn');
    const emailInput = document.querySelector('.email-input');

    if (subscribeBtn && emailInput) {
        subscribeBtn.addEventListener('click', () => {
            const email = emailInput.value.trim();

            if (email === '') {
                alert('Please enter your email address.');
                return;
            }

            if (!email.includes('@') || !email.includes('.')) {
                alert('Please enter a valid email address.');
                return;
            }

            subscribeBtn.textContent = '✓ Subscribed!';
            subscribeBtn.style.backgroundColor = '#1a5c38';
            emailInput.value = '';

            setTimeout(() => {
                subscribeBtn.textContent = 'Sign up';
                subscribeBtn.style.backgroundColor = '#052962';
            }, 3000);
        });
    }
}

setupNewsletter();


// ================================
// 6. SUBSCRIBE TOP BUTTON
// ================================
function setupSubscribeTop() {
    const btn = document.querySelector('.subscribe-top-btn');

    if (btn) {
        btn.addEventListener('click', () => {
            const widget = document.querySelector('.newsletter-widget');
            if (widget) {
                widget.scrollIntoView({ behavior: 'smooth' });
                widget.style.outline = '3px solid #c70000';
                setTimeout(() => {
                    widget.style.outline = 'none';
                }, 2000);
            }
        });
    }
}

setupSubscribeTop();


// ================================
// 7. READING PROGRESS BAR
// ================================
function setupProgressBar() {
    const bar = document.createElement('div');
    bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        width: 0%;
        background-color: #c70000;
        z-index: 9999;
        transition: width 0.1s ease;
    `;
    document.body.appendChild(bar);

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        bar.style.width = progress + '%';
    });
}

setupProgressBar();


// ================================
// 8. BACK TO TOP BUTTON
// ================================
function setupBackToTop() {
    const btn = document.createElement('button');
    btn.textContent = '↑ Top';
    btn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background-color: #052962;
        color: #ffffff;
        border: none;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border-radius: 2px;
        display: none;
        z-index: 9998;
        transition: background 0.2s;
    `;

    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = '#c70000';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = '#052962';
    });
}

setupBackToTop();


// ================================
// CATEGORY FILTERING (section-nav)
// Only intercepts links with data-category (hash or # href).
// Links to real .html pages are left alone to navigate normally.
// ================================
function setupCategoryFilter() {
    const sectionLinks = document.querySelectorAll('.section-nav a');

    sectionLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href') || '';

            // Let real page links navigate normally — do NOT preventDefault
            if (href !== '#' && !href.startsWith('#') && href !== '') {
                return;
            }

            // In-page filter links (href="#" or data-category) — intercept
            e.preventDefault();

            sectionLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const category = link.getAttribute('data-category') || link.textContent.trim();

            if (typeof window.filterArticles === 'function') {
                window.filterArticles(category);
            }

            const mainContent = document.querySelector('.main-content');
            if (mainContent) mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}


// ================================
// TOP NAV — real page links only.
// News → index.html  (if already on index, handled by inline script)
// Opinion → index.html?category=Opinion  (real navigation)
// Sport → index.html?category=Sports     (real navigation)
// Jobs → jobs.html                        (real navigation)
//
// NO e.preventDefault() here — the browser handles all of these.
// The inline script in index.html handles the "News" click when
// already on index.html (to avoid a full reload).
// ================================
function setupTopNavFilter() {
    // Nothing to intercept — all top-nav links have real hrefs.
    // Keeping this function as a no-op so existing call below doesn't throw.
}


setupCategoryFilter();
setupTopNavFilter();