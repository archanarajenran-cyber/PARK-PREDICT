/* ==========================================================
   ParkPredict - homepage behaviour (plain JavaScript, no libraries)
   ========================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var header = document.getElementById('site-header');
  var navToggle = document.getElementById('nav-toggle');
  var navMenu = document.getElementById('nav-menu');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var findBtn = document.getElementById('find-parking-btn');
  var pickerPanel = document.getElementById('picker-panel');

  /* ---------- Sample lot data (replace with real data later) ----------
     total     = number of spaces in the lot
     occupied  = spaces taken right now
     predicted = spaces expected to be open in 30 minutes                 */
  var LOTS = {
    'main-gate':      { name: 'Main Gate Lot',      total: 120, occupied: 78,  predicted: 30 },
    'library-garage': { name: 'Library Garage',     total: 200, occupied: 176, predicted: 18 },
    'sports-complex': { name: 'Sports Complex Lot', total: 80,  occupied: 24,  predicted: 60 }
  };

  /* ---------- Helpers ---------- */
  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function scrollToTarget(hash) {
    if (hash === '#home' || hash === '#' || hash === '') {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      return null;
    }
    var target = document.querySelector(hash);
    if (!target) { return null; }
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    return target;
  }

  /* ---------- 1. Smooth scrolling for in-page links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var hash = link.getAttribute('href');
      if (link.id === 'find-parking-btn') { return; } // handled separately below
      if (hash.length < 1) { return; }

      var target = hash === '#home' ? document.getElementById('home') : document.querySelector(hash);
      if (!target && hash !== '#home') { return; }

      event.preventDefault();
      scrollToTarget(hash);

      if (target) {
        if (!target.hasAttribute('tabindex')) { target.setAttribute('tabindex', '-1'); }
        target.focus({ preventScroll: true });
      }
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', hash);
      }
      closeMenu();
    });
  });

  /* ---------- 2. Mobile menu ---------- */
  function setMenu(open) {
    header.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  function closeMenu() {
    if (header.classList.contains('is-open')) { setMenu(false); }
  }

  navToggle.addEventListener('click', function () {
    setMenu(!header.classList.contains('is-open'));
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && header.classList.contains('is-open')) {
      setMenu(false);
      navToggle.focus();
    }
  });

  document.addEventListener('click', function (event) {
    if (header.classList.contains('is-open') && !header.contains(event.target)) {
      setMenu(false);
    }
  });

  window.matchMedia('(min-width: 48.01rem)').addEventListener('change', function (e) {
    if (e.matches) { setMenu(false); }
  });

  /* ---------- 3. Header shadow after scrolling ---------- */
  function updateHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* ---------- 4. Highlight the nav link for the section in view ---------- */
  if ('IntersectionObserver' in window) {
    var sectionIds = ['home', 'find-parking', 'dashboard', 'how-it-works', 'why-parkpredict'];
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var id = entry.target.id;
        navLinks.forEach(function (link) {
          if (link.getAttribute('href') === '#' + id) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sectionIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { observer.observe(el); }
    });
  }

  /* ---------- 5. Lot picker and stat cards ---------- */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.lot-chip'));
  var els = {
    lotName: document.getElementById('snapshot-lot'),
    status: document.getElementById('lot-status'),
    available: document.getElementById('stat-available'),
    availableSub: document.getElementById('stat-available-sub'),
    occupancy: document.getElementById('stat-occupancy'),
    occupancySub: document.getElementById('stat-occupancy-sub'),
    meter: document.getElementById('meter'),
    meterFill: document.getElementById('meter-fill'),
    predicted: document.getElementById('stat-predicted'),
    predictedSub: document.getElementById('stat-predicted-sub'),
    trend: document.getElementById('stat-trend')
  };

  function animateNumber(el, to) {
    var from = parseInt(el.textContent, 10);
    if (isNaN(from)) { from = 0; }
    if (el._frame) { window.cancelAnimationFrame(el._frame); }

    if (reducedMotion.matches || from === to) {
      el.textContent = to;
      return;
    }

    var duration = 700;
    var start = null;

    function step(timestamp) {
      if (start === null) { start = timestamp; }
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) {
        el._frame = window.requestAnimationFrame(step);
      } else {
        el.textContent = to;
      }
    }
    el._frame = window.requestAnimationFrame(step);
  }

  function selectLot(id) {
    var lot = LOTS[id];
    if (!lot) { return; }

    var available = lot.total - lot.occupied;
    var occupancy = Math.round((lot.occupied / lot.total) * 100);

    // Prediction level based on the share of spaces expected to be open
    var share = lot.predicted / lot.total;
    var level = share >= 0.35 ? 'high' : share >= 0.15 ? 'moderate' : 'low';
    var levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

    // Trend compares the forecast with what is open now
    var trendClass = 'is-steady';
    var trendLabel = 'Holding steady';
    if (lot.predicted > available) { trendClass = 'is-freeing'; trendLabel = 'Freeing up'; }
    if (lot.predicted < available) { trendClass = 'is-filling'; trendLabel = 'Filling up'; }

    // Occupancy colour
    var meterLevel = occupancy < 50 ? 'ok' : occupancy < 80 ? 'warn' : 'full';

    chips.forEach(function (chip) {
      var active = chip.getAttribute('data-lot') === id;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    els.lotName.textContent = lot.name;

    animateNumber(els.available, available);
    els.availableSub.textContent = 'of ' + lot.total + ' spaces are open now';

    animateNumber(els.occupancy, occupancy);
    els.occupancySub.textContent = lot.occupied + ' of ' + lot.total + ' spaces are taken';
    els.meterFill.style.setProperty('--fill', occupancy + '%');
    els.meterFill.setAttribute('data-level', meterLevel);
    els.meter.setAttribute('aria-valuenow', String(occupancy));

    els.predicted.textContent = levelLabel;
    els.predicted.className = 'stat-value stat-value-word is-' + level;
    els.predictedSub.textContent = 'About ' + plural(lot.predicted, 'space') + ' open in 30 minutes';
    els.trend.textContent = trendLabel;
    els.trend.className = 'trend ' + trendClass;

    els.status.textContent = 'Showing ' + lot.name + ': ' + available + ' of ' + lot.total +
      ' spaces open, ' + occupancy + ' percent full, predicted availability ' + level + '.';
  }

  

  /* ---------- 6. Find Parking button interaction ---------- */
  function createRipple(button, event) {
    var rect = button.getBoundingClientRect();
    var ripple = document.createElement('span');
    ripple.className = 'ripple';

    // Keyboard clicks have no pointer position, so start from the centre
    var fromKeyboard = event.detail === 0;
    var x = fromKeyboard ? rect.width / 2 : event.clientX - rect.left;
    var y = fromKeyboard ? rect.height / 2 : event.clientY - rect.top;
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    button.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
    window.setTimeout(function () { ripple.remove(); }, 900);
  }

  if (findBtn) {
    var findLabel = findBtn.querySelector('.btn-label');

    findBtn.addEventListener('click', function (event) {
      event.preventDefault();
      if (findBtn.classList.contains('is-loading')) { return; }

      if (!reducedMotion.matches) { createRipple(findBtn, event); }

      findBtn.classList.add('is-loading');
      findBtn.setAttribute('aria-busy', 'true');
      findLabel.textContent = 'Finding lots...';

      window.setTimeout(function () {
        var section = scrollToTarget('#find-parking');
        if (window.history && window.history.pushState) {
          window.history.pushState(null, '', '#find-parking');
        }

        // Draw attention to the lot picker, then move focus to the selected lot
        pickerPanel.classList.add('is-highlighted');
        var activeChip = document.querySelector('.lot-chip.is-active') || chips[0];
        if (activeChip) { activeChip.focus({ preventScroll: true }); }
        if (section && !section.hasAttribute('tabindex')) { section.setAttribute('tabindex', '-1'); }

        findBtn.classList.remove('is-loading');
        findBtn.removeAttribute('aria-busy');
        findLabel.textContent = 'Find Parking';

        window.setTimeout(function () {
          pickerPanel.classList.remove('is-highlighted');
        }, 2200);
      }, reducedMotion.matches ? 100 : 900);
    });
  }

  /* ---------- 7. Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }

  // Make sure the cards match the selected chip on load
  selectLot('main-gate');
})();


// BIG PARKING LOCATION MAP

var bigMap = L.map('big-parking-map').setView([13.0685, 80.1800], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(bigMap);

var bigParkingLocations = [
    {
        name: "Poonamallee High Road Parking",
        lat: 13.0672,
        lng: 80.1750,
        available: 42
    },
    {
        name: "QASR Mandhi Parking",
        lat: 13.0672287,
        lng: 80.177543,
        available: 25
    },
    {
        name: "KFC Parking",
        lat: 13.067581,
        lng: 80.1785401,
        available: 15
    },
    {
        name: "Palmshore Restaurant Parking",
        lat: 13.0719978,
        lng: 80.1868051,
        available: 35
    }
];

bigParkingLocations.forEach(function(place) {

    var marker = L.marker([place.lat, place.lng]).addTo(bigMap);

    marker.bindPopup(
        "<b>" + place.name + "</b><br>" +
        "Available spaces: " + place.available
    );

    marker.on("click", function() {
        document.getElementById("parking-details").innerHTML =
            "<h3>" + place.name + "</h3>" +
            "<p><strong>Available spaces:</strong> " +
            place.available + "</p>";
    });

});
// DARK MODE
var themeToggle = document.getElementById("theme-toggle");

if (themeToggle) {
    themeToggle.addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");

        if (document.body.classList.contains("dark-mode")) {
            themeToggle.textContent = "☀️";
            themeToggle.setAttribute("aria-label", "Switch to light mode");
        } else {
            themeToggle.textContent = "🌙";
            themeToggle.setAttribute("aria-label", "Switch to dark mode");
        }
    });
}
// BACK TO HOME BUTTON
var backHomeBtn = document.getElementById("back-home-btn");

if (backHomeBtn) {
    backHomeBtn.addEventListener("click", function () {
        window.location.href = "/home";
    });
}
// USER PROFILE

var profileBtn = document.getElementById("profile-btn");
var profileModal = document.getElementById("profile-modal");
var closeProfile = document.getElementById("close-profile");
var logoutBtn = document.getElementById("logout-btn");

if (profileBtn) {
    profileBtn.addEventListener("click", function () {
        profileModal.style.display = "flex";
    });
}

if (closeProfile) {
    closeProfile.addEventListener("click", function () {
        profileModal.style.display = "none";
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        window.location.href = "/";
    });
}