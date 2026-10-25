/**
* Template Name: MediNest
* Template URL: https://bootstrapmade.com/medinest-bootstrap-hospital-template/
* Updated: Apr 28 2026 with Bootstrap v5.3.8
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
*/

(function() {
  "use strict";

  /**
   * Apply .scrolled class to the body as the page is scrolled down
   */
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  function mobileNavToogle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', mobileNavToogle);
  }

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.mobile-nav-active') && !navmenu.classList.contains('toggle-dropdown')) {
        mobileNavToogle();
      }
    });

  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function(e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  /**
   * Preloader
   */
  const preloader = document.querySelector('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove();
    });
  }

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    if (typeof AOS !== 'undefined') {
      AOS.init({
        duration: 600,
        easing: 'ease-in-out',
        once: true,
        mirror: false
      });
    }
  }
  window.addEventListener('load', aosInit);

  /**
   * Initiate glightbox
   */
  if (typeof GLightbox !== 'undefined') {
    const glightbox = GLightbox({
      selector: '.glightbox'
    });
  }

  /**
   * Initiate Pure Counter
   */
  if (typeof PureCounter !== 'undefined') {
    new PureCounter();
  }

  /**
   * Init isotope layout and filters
   */
  document.querySelectorAll('.isotope-layout').forEach(function(isotopeItem) {
    let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
    let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
    let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

    let initIsotope;
    imagesLoaded(isotopeItem.querySelector('.isotope-container'), function() {
      initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
        itemSelector: '.isotope-item',
        layoutMode: layout,
        filter: filter,
        sortBy: sort
      });
    });

    isotopeItem.querySelectorAll('.isotope-filters li').forEach(function(filters) {
      filters.addEventListener('click', function() {
        isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
        this.classList.add('filter-active');
        initIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        if (typeof aosInit === 'function') {
          aosInit();
        }
      }, false);
    });

  });

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
      let config = JSON.parse(
        swiperElement.querySelector(".swiper-config").innerHTML.trim()
      );

      if (swiperElement.classList.contains("swiper-tab")) {
        initSwiperWithCustomPagination(swiperElement, config);
      } else {
        new Swiper(swiperElement, config);
      }
    });
  }

  window.addEventListener("load", initSwiper);

  /**
   * Frequently Asked Questions Toggle
   */
  document.querySelectorAll('.faq-item h3, .faq-item .faq-toggle, .faq-item .faq-header').forEach((faqItem) => {
    faqItem.addEventListener('click', () => {
      faqItem.parentNode.classList.toggle('faq-active');
    });
  });

  /**
   * Inject Beginner's JK Diet Chart Printable Modal + Form Handlers
   */
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('jkDietModal')) {
      const modalHtml = `
      <div class="modal fade" id="jkDietModal" tabindex="-1" aria-labelledby="jkDietModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content border-0 shadow-lg" style="border-radius: 20px; overflow: hidden;">
            <div class="modal-header text-white border-0 py-3 px-4" style="background: linear-gradient(135deg, #122319 0%, #15803d 100%);">
              <div>
                <span class="badge mb-1" style="background:#c9a05c; color:#122319; font-weight:700;">FREE PRINTABLE GUIDE · ডা. জাহাঙ্গীর কবির লাইফস্টাইল চার্ট</span>
                <h5 class="modal-title fw-bold text-white mb-0" id="jkDietModalLabel">Dr. Jahangir Kabir (ডা. জাহাঙ্গীর কবির) — Beginner's 5-Pillar &amp; Diet Chart</h5>
              </div>
              <button type="button" class="btn-close btn-close-white no-print" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4" style="background:#fbf9f3; color:#1c3124;">
              <div class="p-3 mb-3 rounded-3" style="background:#eaf3ec; border-left:4px solid #15803d;">
                <strong>মূল লক্ষ্য (Core Objective):</strong> ইনসুলিন রেজিস্ট্যান্স কমানো, অটোফেজি (Autophagy) সক্রিয় করা এবং প্রাকৃতিক রোগ-প্রতিরোধ ক্ষমতা (Natural Immunity) বৃদ্ধি করে ওষুধমুক্ত সুস্থ জীবন অর্জন।
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <div class="p-3 bg-white rounded-3 border h-100">
                    <h6 class="fw-bold text-success mb-2"><i class="bi bi-check-circle-fill me-1"></i> ১. কী খাবেন (Recommended Real Foods)</h6>
                    <ul class="small mb-0 ps-3" style="line-height:1.7;">
                      <li><strong>স্বাস্থ্যকর ফ্যাট:</strong> এক্সট্রা ভার্জিন কোকোনাট অয়েল, অলিভ অয়েল, দেশি ঘি ও মাখন।</li>
                      <li><strong>প্রোটিন:</strong> দেশি ডিম, সামুদ্রিক ও নদীর মাছ, দেশি মুরগি।</li>
                      <li><strong>শাকসবজি ও সুপারফুড:</strong> প্রচুর সবুজ শাকসবজি, সালাদ, চিয়া সিড, কিনোয়া, কাঠবাদাম ও আখরোট।</li>
                      <li><strong>পানীয়:</strong> পর্যাপ্ত পানি, ডাবের পানি, গ্রিন টি, অ্যাপল সাইডার ভিনেগার মিশ্রিত পানি।</li>
                    </ul>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="p-3 bg-white rounded-3 border h-100">
                    <h6 class="fw-bold text-danger mb-2"><i class="bi bi-x-circle-fill me-1"></i> ২. কী বর্জন করবেন (Strictly Avoid)</h6>
                    <ul class="small mb-0 ps-3" style="line-height:1.7;">
                      <li><strong>চিনি ও মিষ্টিজাতীয় খাবার:</strong> সাদা চিনি, কোমল পানীয়, প্যাকেটজাত জুস, মিষ্টি।</li>
                      <li><strong>রিফাইন্ড কার্বোহাইড্রেট:</strong> ময়দা, ফাস্টফুড, বেকারি খাবার, অতিরিক্ত সাদা ভাত।</li>
                      <li><strong>ক্ষতিকর তেল:</strong> সয়াবিন তেল, রাইস ব্র্যান ও যেকোনো রিফাইন্ড ভেজিটেবল অয়েল।</li>
                      <li><strong>প্রসেসড খাবার:</strong> চিপস, ইনস্ট্যান্ট নুডলস ও কেমিক্যালযুক্ত খাবার।</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="p-3 bg-white rounded-3 border mb-3">
                <h6 class="fw-bold mb-2" style="color:#122319;"><i class="bi bi-clock-history me-1 text-success"></i> ৩. দৈনিক রুটিন ও ৫টি স্তম্ভ (Daily Routine &amp; 5 Pillars)</h6>
                <div class="table-responsive">
                  <table class="table table-sm table-bordered mb-0 small">
                    <thead class="table-light">
                      <tr><th>সময় / স্তম্ভ (Time / Pillar)</th><th>করণীয় (Actionable Guideline)</th></tr>
                    </thead>
                    <tbody>
                      <tr><td><strong>ভোর ৫:৩০ – ৭:০০ (Exercise)</strong></td><td>ঘুম থেকে ওঠা, খালি পেটে হাঁটা, ফ্রি-হ্যান্ড ব্যায়াম বা JK Fitness Arena স্ট্রেংথ ট্রেনিং।</td></tr>
                      <tr><td><strong>ফাস্টিং উইন্ডো (16:8 Autophagy)</strong></td><td>রাত ৮টা থেকে দুপুর ১২টা পর্যন্ত ১৬ ঘণ্টা ফাস্টিং (শুধু পানি, গ্রিন টি বা ব্ল্যাক কফি)।</td></tr>
                      <tr><td><strong>দুপুর ১২:০০ – ১:৩০ (Meal 1)</strong></td><td>শসা/সালাদ, পর্যাপ্ত সবুজ সবজি (কোকোনাট/অলিভ অয়েলে রান্না), ডিম বা মাছ এবং চিয়া সিড।</td></tr>
                      <tr><td><strong>সন্ধ্যা ৭:০০ – ৮:০০ (Dinner)</strong></td><td>রাত ৮টার মধ্যে হালকা ও পুষ্টিকর রাতের খাবার সম্পন্ন করা।</td></tr>
                      <tr><td><strong>রাত ৯:০০ – ১০:০০ (Sleep &amp; Peace)</strong></td><td>স্ক্রিন বন্ধ করে মানসিক প্রশান্তি ও গভীর ঘুম নিশ্চিত করা।</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="small text-muted p-2 rounded" style="background:#f2ede2;">
                <strong>সতর্কতা (Medical Disclaimer):</strong> এটি সাধারণ স্বাস্থ্য-সচেতনতামূলক লাইফস্টাইল গাইড। ডায়াবেটিস, কিডনি রোগ বা গর্ভাবস্থায় ফাস্টিং বা ডায়েট পরিবর্তনের পূর্বে অবশ্যই চিকিৎসকের পরামর্শ নিন। হেল্পলাইন: <strong>+880 9678 242404</strong> (সকাল ৮টা – বিকাল ৫টা)।
              </div>
            </div>
            <div class="modal-footer border-0 bg-light no-print d-flex justify-content-between">
              <a href="https://jklifestyleltd.com/appointment/" target="_blank" rel="noopener" class="btn btn-outline-success rounded-pill px-3">
                <i class="bi bi-calendar-check me-1"></i> Book Free/Online Consultation
              </a>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-success rounded-pill px-4 fw-bold" onclick="window.print()">
                  <i class="bi bi-printer me-1"></i> Print / Save as PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Intercept PHP email forms so they work smoothly locally without backend errors
    document.querySelectorAll('.php-email-form').forEach((form) => {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const loading = form.querySelector('.loading');
        const sent = form.querySelector('.sent-message');
        const err = form.querySelector('.error-message');
        if (err) err.style.display = 'none';
        if (loading) loading.style.display = 'block';
        setTimeout(() => {
          if (loading) loading.style.display = 'none';
          if (sent) {
            sent.style.display = 'block';
            sent.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>ধন্যবাদ! আপনার অনুরোধটি গৃহীত হয়েছে। দ্রুত বুকিং নিশ্চিত করতে হেল্পলাইনে (+880 9678 242404) কল করুন অথবা <a href="https://jklifestyleltd.com/appointment/" target="_blank" class="text-white text-decoration-underline fw-bold">JK Lifestyle Official Portal</a> ভিজিট করুন।';
          }
          form.reset();
          if (form.classList.contains('appointment-form')) {
            window.location.href = 'https://jklifestyleltd.com/appointment/';
          }
        }, 500);
      });
    });
  });

})();