/* ============================================
   SUCHNA AI — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    currentScreen: 'home',
    previousScreen: null,
    language: 'hi',
    voiceSpeed: 1, // 0=slow, 1=normal, 2=fast
    isPlaying: false,
    speechUtterance: null,
  };

  // ---- DOM Refs ----
  const screens = document.querySelectorAll('.screen');
  const navItems = document.querySelectorAll('.nav-item');
  const bottomNav = document.getElementById('bottom-nav');

  // ---- Screen Navigation ----
  function navigateTo(screenId, options = {}) {
    const { hideNav = false, direction = 'right' } = options;

    // Deactivate current screen
    const currentEl = document.getElementById(`screen-${state.currentScreen}`);
    if (currentEl) {
      currentEl.classList.remove('active');
      if (direction === 'right') {
        currentEl.classList.add('slide-left');
      }
      setTimeout(() => currentEl.classList.remove('slide-left'), 400);
    }

    state.previousScreen = state.currentScreen;
    state.currentScreen = screenId;

    // Activate new screen
    const nextEl = document.getElementById(`screen-${screenId}`);
    if (nextEl) {
      nextEl.classList.add('active');
    }

    // Toggle bottom nav visibility
    bottomNav.style.display = hideNav ? 'none' : 'flex';

    // Update nav active state
    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.target === screenId);
    });

    // Adjust screen container height
    const container = document.querySelector('.screens-container');
    container.style.height = hideNav ? '100%' : 'calc(100% - 72px)';

    // Reset scroll on new screen
    if (nextEl) nextEl.scrollTop = 0;
  }

  // ---- Bottom Nav ----
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      if (target && target !== state.currentScreen) {
        navigateTo(target);
      }
    });
  });

  // ---- Language Selector (Home) ----
  const langBtns = document.querySelectorAll('#lang-selector-home .lang-btn');
  langBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      langBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.language = btn.dataset.lang;
      // Also sync settings radio
      const radio = document.querySelector(
        `input[name="language"][value="${state.language}"]`
      );
      if (radio) radio.checked = true;
    });
  });

  // ---- Settings Language Radio ----
  const langRadios = document.querySelectorAll('input[name="language"]');
  langRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      state.language = radio.value;
      // Sync home selector
      langBtns.forEach((b) => {
        b.classList.toggle('active', b.dataset.lang === state.language);
      });
    });
  });

  // ---- Voice Speed Slider ----
  const speedSlider = document.getElementById('speed-slider');
  const speedLabel = document.getElementById('speed-label');
  const speedTexts = ['Slow / धीमी', 'Normal / सामान्य', 'Fast / तेज़'];

  speedSlider.addEventListener('input', () => {
    state.voiceSpeed = parseInt(speedSlider.value);
    speedLabel.textContent = speedTexts[state.voiceSpeed];
  });

  // ---- Home: Scan Button ----
  document.getElementById('btn-scan-home').addEventListener('click', () => {
    navigateTo('camera', { hideNav: true });
  });

  // ---- Home: See All → History ----
  document.getElementById('btn-see-all').addEventListener('click', () => {
    navigateTo('history');
  });

  // ---- Home: Card → Results ----
  document.getElementById('card-bank-notice').addEventListener('click', (e) => {
    if (e.target.closest('.play-mini-btn')) {
      playAudioSummary('bank');
      return;
    }
    navigateTo('results');
  });

  document.getElementById('card-govt-letter').addEventListener('click', (e) => {
    if (e.target.closest('.play-mini-btn')) {
      playAudioSummary('govt');
      return;
    }
    showResultsFor('govt');
  });

  document.getElementById('card-school-form').addEventListener('click', (e) => {
    if (e.target.closest('.play-mini-btn')) {
      playAudioSummary('school');
      return;
    }
    showResultsFor('school');
  });

  // ---- Camera: Back ----
  document.getElementById('btn-camera-back').addEventListener('click', () => {
    navigateTo('home');
  });

  // ---- Camera: Capture (real camera via file input) ----
  document.getElementById('input-capture').addEventListener('change', (e) => {
    onDocCaptured(e.target);
  });

  // ---- Camera: Gallery import ----
  document.getElementById('input-gallery').addEventListener('change', (e) => {
    onDocCaptured(e.target);
  });

  function onDocCaptured(input) {
    if (!input.files || !input.files[0]) return;
    const imgUrl = URL.createObjectURL(input.files[0]);
    state.capturedImageUrl = imgUrl;
    startProcessing(imgUrl);
    // Reset the input so the same file can be re-selected
    input.value = '';
  }

  // ---- Processing Flow ----
  function startProcessing(imgUrl) {
    const overlay = document.getElementById('processing-overlay');
    overlay.classList.add('active');

    // If we have a captured image, show it in the processing spinner center
    const centerIcon = overlay.querySelector('.center-icon');
    if (imgUrl) {
      centerIcon.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      centerIcon.textContent = '📄';
    }

    // Reset and restart the progress bar animation
    const bar = document.getElementById('progress-bar');
    bar.style.animation = 'none';
    bar.offsetHeight; // trigger reflow
    bar.style.animation = 'progress-fill 3s ease-in-out forwards';

    // After 3.2 seconds, navigate to results with the captured image
    setTimeout(() => {
      overlay.classList.remove('active');
      showResultsWithCapture('bank', imgUrl);
    }, 3200);
  }

  // ---- Results: Back ----
  document.getElementById('btn-results-back').addEventListener('click', () => {
    navigateTo('home');
  });

  // ---- Results: Play Audio ----
  const playBtn = document.getElementById('btn-play-audio');
  const playIconMain = document.getElementById('play-icon-main');
  const audioWaves = document.getElementById('audio-waves');

  playBtn.addEventListener('click', () => {
    if (state.isPlaying) {
      stopAudio();
    } else {
      playResultsAudio();
    }
  });

  function playResultsAudio() {
    const text =
      'आपका लोन EMI 2 महीने से बकाया है। 20 तारीख तक 4,300 रुपये जमा करें, वरना जुर्माना लगेगा।';
    speakText(text, () => {
      stopAudio();
    });

    state.isPlaying = true;
    playIconMain.textContent = '⏸';
    audioWaves.classList.remove('hidden');
    playBtn.style.background =
      'linear-gradient(135deg, var(--saffron-500), var(--saffron-600))';
  }

  function stopAudio() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    state.isPlaying = false;
    playIconMain.textContent = '▶';
    audioWaves.classList.add('hidden');
    playBtn.style.background = '';
  }

  function speakText(text, onEnd) {
    if (!window.speechSynthesis) {
      // Fallback: just animate for 4 seconds
      setTimeout(onEnd, 4000);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';

    // Set speed based on slider
    const rates = [0.7, 1.0, 1.4];
    utterance.rate = rates[state.voiceSpeed];
    utterance.pitch = 1.0;

    // Try to find a Hindi voice
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(
      (v) => v.lang === 'hi-IN' || v.lang.startsWith('hi')
    );
    if (hindiVoice) utterance.voice = hindiVoice;

    utterance.onend = onEnd;
    utterance.onerror = onEnd;

    window.speechSynthesis.speak(utterance);
  }

  // ---- Mini play buttons (history cards) ----
  function playAudioSummary(docType) {
    const summaries = {
      bank: 'आपका लोन EMI 2 महीने से बकाया है। 4,300 रुपये जमा करें।',
      govt: 'PM किसान योजना की 6,000 रुपये की किस्त आपके खाते में आ गई है।',
      school: 'बच्चे के एडमिशन के लिए 25 मार्च तक फॉर्म जमा करें।',
    };
    const text = summaries[docType] || summaries.bank;
    speakText(text, () => {});
  }

  // Attach mini play to history list items too
  document.querySelectorAll('.history-list .play-mini-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.history-card');
      const category = card?.dataset.category || card?.dataset.doc || 'bank';
      playAudioSummary(category);
    });
  });

  // ---- Results: Set Reminder ----
  document.getElementById('btn-set-reminder').addEventListener('click', () => {
    navigateTo('confirmation', { hideNav: true });
  });

  // ---- Confirmation: Scan Another ----
  document.getElementById('btn-scan-another').addEventListener('click', () => {
    navigateTo('home');
  });

  // ---- Confirmation: Share with Family ----
  document.getElementById('btn-share-family').addEventListener('click', () => {
    // Simulate WhatsApp share
    const text = encodeURIComponent(
      'SBI Bank Notice: लोन EMI बकाया है। 20 March तक ₹4,300 जमा करें। — Suchna AI'
    );
    const url = `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  });

  // ---- History: Filter Chips ----
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      filterHistory(chip.dataset.filter);
    });
  });

  function filterHistory(filter) {
    const cards = document.querySelectorAll('#history-list .history-card');
    cards.forEach((card) => {
      if (filter === 'all' || card.dataset.category === filter) {
        card.style.display = '';
        // Re-trigger animation
        card.style.animation = 'none';
        card.offsetHeight;
        card.style.animation = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // ---- History card clicks → Results ----
  document.querySelectorAll('#history-list .history-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.play-mini-btn')) return;
      showResultsFor(card.dataset.category || card.dataset.doc);
    });
  });

  // ---- Show Results for different doc types ----
  const docData = {
    bank: {
      chip: '🏦 Bank Notice — SBI Loan EMI Overdue',
      chipClass: 'bank',
      badge: '🏦 Bank Notice',
      summaryHi:
        'आपका लोन EMI 2 महीने से बकाया है। 20 तारीख तक ₹4,300 जमा करें, वरना जुर्माना लगेगा।',
      actions: [
        {
          icon: '📅',
          iconClass: 'calendar',
          label: 'Pay by / भुगतान की तारीख',
          value: '20 March 2026',
          valueClass: '',
        },
        {
          icon: '💰',
          iconClass: 'money',
          label: 'Amount Due / बकाया राशि',
          value: '₹4,300',
          valueClass: 'amount',
        },
        {
          icon: '📞',
          iconClass: 'phone',
          label: 'Call Branch / ब्रांच को कॉल करें',
          value: '1800-111-0019',
          valueClass: '',
        },
      ],
    },
    govt: {
      chip: '🏛️ Government Letter — PM Kisan Yojana',
      chipClass: 'govt',
      badge: '🏛️ Government',
      summaryHi:
        'PM किसान योजना की ₹6,000 की किस्त आपके खाते में भेजी गई है। अपने बैंक में जाकर पासबुक अपडेट करें।',
      actions: [
        {
          icon: '💰',
          iconClass: 'money',
          label: 'Amount / राशि',
          value: '₹6,000',
          valueClass: 'amount',
        },
        {
          icon: '🏦',
          iconClass: 'calendar',
          label: 'Action / करवाएं',
          value: 'Update Passbook',
          valueClass: '',
        },
        {
          icon: '📞',
          iconClass: 'phone',
          label: 'Helpline / हेल्पलाइन',
          value: '155261',
          valueClass: '',
        },
      ],
    },
    school: {
      chip: '🏫 School Form — Admission',
      chipClass: 'school',
      badge: '🏫 School',
      summaryHi:
        'बच्चे के एडमिशन के लिए 25 मार्च तक फॉर्म जमा करें। आधार कार्ड और जन्म प्रमाण पत्र ज़रूरी है।',
      actions: [
        {
          icon: '📅',
          iconClass: 'calendar',
          label: 'Deadline / अंतिम तारीख',
          value: '25 March 2026',
          valueClass: '',
        },
        {
          icon: '📝',
          iconClass: 'money',
          label: 'Documents / दस्तावेज़',
          value: 'Aadhaar + Birth Cert.',
          valueClass: '',
        },
        {
          icon: '📞',
          iconClass: 'phone',
          label: 'School / स्कूल',
          value: '0141-XXXXXXX',
          valueClass: '',
        },
      ],
    },
  };

  function showResultsFor(docType, imgUrl) {
    const data = docData[docType] || docData.bank;

    // Update results screen content
    const chipEl = document.querySelector('.doc-type-chip');
    chipEl.innerHTML = data.chip;

    const badgeEl = document.querySelector('.results-badge .badge');
    badgeEl.textContent = data.badge;

    const summaryEl = document.getElementById('summary-text');
    summaryEl.textContent = data.summaryHi;

    const actionList = document.querySelector('.action-list');
    actionList.innerHTML = data.actions
      .map(
        (a) => `
      <div class="action-item">
        <div class="action-icon ${a.iconClass}">${a.icon}</div>
        <div class="action-text">
          <div class="action-label">${a.label}</div>
          <div class="action-value ${a.valueClass}">${a.value}</div>
        </div>
      </div>
    `
      )
      .join('');

    // Show/hide captured document preview
    const previewEl = document.getElementById('captured-doc-preview');
    const previewImg = document.getElementById('captured-doc-img');
    if (imgUrl) {
      previewImg.src = imgUrl;
      previewEl.classList.remove('hidden');
    } else {
      previewEl.classList.add('hidden');
      previewImg.src = '';
    }

    navigateTo('results', { hideNav: true });
  }

  // Show results with a captured image from the camera
  function showResultsWithCapture(docType, imgUrl) {
    showResultsFor(docType, imgUrl || state.capturedImageUrl);
  }

  // ---- Load voices (for speech synthesis) ----
  if (window.speechSynthesis) {
    // Voices may load async
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ---- Service worker registration placeholder ----
  // In a real app, this would register a SW for true offline functionality
  // if ('serviceWorker' in navigator) { ... }

  // ---- Initialize ----
  function init() {
    navigateTo('home');
    console.log('🇮🇳 Suchna AI initialized — दस्तावेज़ सहायक ready');
  }

  init();
})();
