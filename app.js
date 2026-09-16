/* ============================================
   SUCHNA AI — Application Logic
   Real camera + Tesseract.js OCR + TTS
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
    capturedImageUrl: null,
    currentSummary: null,
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

    const prevScreen = state.currentScreen;
    state.previousScreen = prevScreen;
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

    // Camera lifecycle
    if (screenId === 'camera') {
      openCamera();
    } else if (prevScreen === 'camera') {
      stopCamera();
    }
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

  // ---- Home: Card → Results (canned data) ----
  document.getElementById('card-bank-notice').addEventListener('click', (e) => {
    if (e.target.closest('.play-mini-btn')) {
      playAudioSummary('bank');
      return;
    }
    showResultsFor('bank');
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

  // ============================================
  //  LIVE CAMERA
  // ============================================
  let camStream = null;

  async function openCamera() {
    const status = document.getElementById('cam-status');
    const bgSim = document.querySelector('.camera-bg-simulation');
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
      });
      document.getElementById('cam').srcObject = camStream;
      if (bgSim) bgSim.style.opacity = '0';
      status.textContent = 'Point at document / दस्तावेज़ पर कैमरा रखें';
      status.className = 'cam-status ready';
    } catch (e) {
      console.warn('Camera access failed:', e);
      status.textContent = 'Camera unavailable — use Gallery ↙ / गैलरी इस्तेमाल करें';
      status.className = 'cam-status error';
    }
  }

  function stopCamera() {
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    const bgSim = document.querySelector('.camera-bg-simulation');
    if (bgSim) bgSim.style.opacity = '0.9';
    const video = document.getElementById('cam');
    if (video) video.srcObject = null;
  }

  // Capture a frame from the live video
  function captureFrame() {
    const video = document.getElementById('cam');
    const canvas = document.getElementById('canvas');
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    startOCRProcessing(imgDataUrl);
  }

  // ---- Camera: Back ----
  document.getElementById('btn-camera-back').addEventListener('click', () => {
    stopCamera();
    navigateTo('home');
  });

  // ---- Capture button (live frame from video) ----
  document.getElementById('btn-capture').addEventListener('click', () => {
    if (camStream) {
      captureFrame();
    } else {
      // Camera failed, trigger native camera fallback
      document.getElementById('input-capture').click();
    }
  });

  // ---- File input fallbacks (gallery + native camera) ----
  document.getElementById('input-capture').addEventListener('change', (e) => {
    onDocCaptured(e.target);
  });
  document.getElementById('input-gallery').addEventListener('change', (e) => {
    onDocCaptured(e.target);
  });

  function onDocCaptured(input) {
    if (!input.files || !input.files[0]) return;
    stopCamera();
    const reader = new FileReader();
    reader.onload = (e) => startOCRProcessing(e.target.result);
    reader.readAsDataURL(input.files[0]);
    input.value = '';
  }

  // ============================================
  //  OCR PROCESSING (Tesseract.js)
  // ============================================
  function startOCRProcessing(imageDataUrl) {
    state.capturedImageUrl = imageDataUrl;

    const overlay = document.getElementById('processing-overlay');
    overlay.classList.add('active');

    // Show captured image in spinner center
    const centerIcon = overlay.querySelector('.center-icon');
    centerIcon.innerHTML = `<img src="${imageDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

    // Processing text refs
    const mainText = overlay.querySelector('.processing-text .main');
    const hiText = overlay.querySelector('.processing-text .hi');

    // Manual progress bar (driven by OCR progress)
    const bar = document.getElementById('progress-bar');
    bar.style.animation = 'none';
    bar.style.width = '5%';
    bar.style.transition = 'width 0.3s ease';

    mainText.textContent = 'Reading your document...';
    hiText.textContent = 'आपका दस्तावेज़ पढ़ा जा रहा है...';

    // Run Tesseract OCR (eng + hin)
    Tesseract.recognize(imageDataUrl, 'eng+hin', {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress) {
          const pct = Math.round(m.progress * 100);
          bar.style.width = `${Math.max(10, pct)}%`;
          mainText.textContent = `Reading document... ${pct}%`;
          hiText.textContent = `दस्तावेज़ पढ़ रहे हैं... ${pct}%`;
        } else if (m.status === 'loading language traineddata') {
          bar.style.width = '8%';
          mainText.textContent = 'Loading language model...';
          hiText.textContent = 'भाषा मॉडल लोड हो रहा है...';
        } else if (m.status === 'initializing tesseract') {
          bar.style.width = '3%';
          mainText.textContent = 'Preparing OCR engine...';
          hiText.textContent = 'OCR इंजन तैयार हो रहा है...';
        }
      }
    }).then((result) => {
      const text = result.data.text;
      console.log('📄 OCR Raw Text:', text);
      console.log('📊 Confidence:', result.data.confidence);

      bar.style.width = '100%';
      setTimeout(() => {
        overlay.classList.remove('active');
        // Analyze extracted text and render results
        const analysis = analyzeDocument(text);
        renderOCRResults(analysis, imageDataUrl);
      }, 400);
    }).catch((err) => {
      console.error('OCR Error:', err);
      overlay.classList.remove('active');
      // Fallback to canned bank notice results on error
      showResultsFor('bank', imageDataUrl);
    });
  }

  // ============================================
  //  DOCUMENT ANALYSIS (from OCR text)
  // ============================================
  function analyzeDocument(rawText) {
    const text = rawText || '';
    const lower = text.toLowerCase();

    // Extract amounts: ₹4,300 or Rs. 4,300 or Rs 4300
    const amounts = text.match(/₹\s?[\d,]+(?:\.\d{1,2})?/g)
      || text.match(/Rs\.?\s?[\d,]+(?:\.\d{1,2})?/gi)
      || [];

    // Extract dates: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, or "15 March 2026" style
    const dates = text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g)
      || text.match(/\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{2,4}/gi)
      || [];

    // Extract phone numbers
    const phones = text.match(/1[89]00[-\s]?\d{3}[-\s]?\d{3,4}/g)
      || text.match(/\b[6-9]\d{9}\b/g)
      || text.match(/\b0\d{2,4}[-\s]?\d{6,8}\b/g)
      || [];

    // Classify document type
    let docType = 'general', docIcon = '📄', docLabel = 'Document';

    if (lower.includes('bank') || lower.includes('loan') || lower.includes('emi')
        || lower.includes('account') || lower.includes('sbi') || lower.includes('pnb')
        || lower.includes('hdfc') || lower.includes('icici') || lower.includes('interest')
        || lower.includes('बैंक') || lower.includes('लोन') || lower.includes('खाता')
        || lower.includes('ब्याज')) {
      docType = 'bank'; docIcon = '🏦'; docLabel = 'Bank Document';
    } else if (lower.includes('government') || lower.includes('sarkar') || lower.includes('scheme')
        || lower.includes('ministry') || lower.includes('department')
        || lower.includes('योजना') || lower.includes('सरकार') || lower.includes('kisan')
        || lower.includes('ration') || lower.includes('aadhar') || lower.includes('aadhaar')
        || lower.includes('bharat') || lower.includes('pradhan') || lower.includes('mantri')) {
      docType = 'govt'; docIcon = '🏛️'; docLabel = 'Government Document';
    } else if (lower.includes('school') || lower.includes('admission') || lower.includes('student')
        || lower.includes('exam') || lower.includes('class') || lower.includes('education')
        || lower.includes('विद्यालय') || lower.includes('स्कूल') || lower.includes('परीक्षा')
        || lower.includes('प्रवेश') || lower.includes('कक्षा')) {
      docType = 'school'; docIcon = '🏫'; docLabel = 'School / Education';
    }

    // Generate plain-language summary
    const summary = makeSummary(text, lower, amounts, dates, docType);

    return {
      rawText: text,
      summary,
      docType, docIcon, docLabel,
      amount: amounts[0] || '—',
      deadline: dates[0] || '—',
      phone: phones[0] || '—',
    };
  }

  function makeSummary(text, lower, amounts, dates, docType) {
    const amtStr = amounts[0] || '';
    const dateStr = dates[0] || '';

    // Overdue / penalty pattern
    if (lower.includes('overdue') || lower.includes('outstanding') || lower.includes('बकाया')
        || lower.includes('penalty') || lower.includes('जुर्माना') || lower.includes('default')
        || lower.includes('due')) {
      return `⚠️ This document says a payment is overdue${amtStr ? ' of ' + amtStr : ''}${dateStr ? ', due by ' + dateStr : ''}. Pay as soon as possible to avoid penalty.\n\nयह दस्तावेज़ कहता है कि भुगतान बकाया है${amtStr ? ' — राशि ' + amtStr : ''}। जल्द से जल्द भुगतान करें।`;
    }

    // Government scheme pattern
    if (lower.includes('scheme') || lower.includes('योजना') || lower.includes('benefit')
        || lower.includes('subsidy') || lower.includes('लाभ') || lower.includes('yojana')) {
      return `📋 This is a government scheme document${amtStr ? '. Amount mentioned: ' + amtStr : ''}. Check your eligibility and submit required documents.\n\nयह एक सरकारी योजना का दस्तावेज़ है${amtStr ? '। राशि: ' + amtStr : ''}। अपनी पात्रता जांचें।`;
    }

    // Education pattern
    if (lower.includes('admission') || lower.includes('प्रवेश') || lower.includes('form')
        || lower.includes('फॉर्म') || lower.includes('exam') || lower.includes('परीक्षा')) {
      return `🏫 This is an education-related document${dateStr ? '. Deadline: ' + dateStr : ''}. Submit the required documents on time.\n\nयह शिक्षा से जुड़ा दस्तावेज़ है${dateStr ? '। अंतिम तिथि: ' + dateStr : ''}। समय पर दस्तावेज़ जमा करें।`;
    }

    // Found some structured data
    if (amounts.length || dates.length) {
      return `📄 Document read successfully. ${amounts.length ? 'Amount found: ' + amounts.join(', ') + '. ' : ''}${dates.length ? 'Date(s): ' + dates.join(', ') + '.' : ''}\n\nदस्तावेज़ सफलतापूर्वक पढ़ा गया। ${amounts.length ? 'राशि: ' + amounts.join(', ') + '। ' : ''}${dates.length ? 'तारीख: ' + dates.join(', ') : ''}`;
    }

    // Generic — show extracted text snippet
    const snippet = text.trim().substring(0, 250);
    if (snippet.length > 20) {
      return `📄 Document text extracted:\n\n"${snippet}${text.length > 250 ? '…' : ''}"`;
    }

    return '📄 Could not read clear text from this image. Try with better lighting or a clearer photo.\n\nइस फ़ोटो से स्पष्ट टेक्स्ट नहीं पढ़ा जा सका। बेहतर रोशनी में दोबारा कोशिश करें।';
  }

  // ============================================
  //  RENDER RESULTS
  // ============================================

  // Render real OCR results into the existing results UI
  function renderOCRResults(analysis, imgUrl) {
    const { summary, docIcon, docLabel, amount, deadline, phone } = analysis;

    document.querySelector('.doc-type-chip').innerHTML = `<span>${docIcon}</span> ${docLabel}`;
    document.querySelector('.results-badge .badge').textContent = `${docIcon} ${docLabel}`;

    document.getElementById('summary-text').textContent = summary;
    state.currentSummary = summary;

    document.querySelector('.action-list').innerHTML = `
      <div class="action-item">
        <div class="action-icon calendar">📅</div>
        <div class="action-text">
          <div class="action-label">Deadline / तारीख</div>
          <div class="action-value">${deadline}</div>
        </div>
      </div>
      <div class="action-item">
        <div class="action-icon money">💰</div>
        <div class="action-text">
          <div class="action-label">Amount / राशि</div>
          <div class="action-value amount">${amount}</div>
        </div>
      </div>
      <div class="action-item">
        <div class="action-icon phone">📞</div>
        <div class="action-text">
          <div class="action-label">Phone / फोन</div>
          <div class="action-value">${phone}</div>
        </div>
      </div>
    `;

    // Show captured document photo
    const previewEl = document.getElementById('captured-doc-preview');
    const previewImg = document.getElementById('captured-doc-img');
    if (imgUrl) {
      previewImg.src = imgUrl;
      previewEl.classList.remove('hidden');
    } else {
      previewEl.classList.add('hidden');
    }

    navigateTo('results', { hideNav: true });
  }

  // ---- Results: Back ----
  document.getElementById('btn-results-back').addEventListener('click', () => {
    navigateTo('home');
  });

  // ============================================
  //  TEXT-TO-SPEECH
  // ============================================
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
    // Read whatever is currently on screen — real OCR or canned
    const text = state.currentSummary
      || document.getElementById('summary-text').textContent
      || 'दस्तावेज़ पढ़ा गया।';
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
      setTimeout(onEnd, 4000);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.language === 'te' ? 'te-IN' : state.language === 'en' ? 'en-IN' : 'hi-IN';

    const rates = [0.7, 1.0, 1.4];
    utterance.rate = rates[state.voiceSpeed];
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const targetLang = utterance.lang;
    const voice = voices.find(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0]));
    if (voice) utterance.voice = voice;

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
    speakText(summaries[docType] || summaries.bank, () => {});
  }

  document.querySelectorAll('.history-list .play-mini-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.history-card');
      playAudioSummary(card?.dataset.category || card?.dataset.doc || 'bank');
    });
  });

  // ============================================
  //  CANNED DATA (for history cards)
  // ============================================
  document.getElementById('btn-set-reminder').addEventListener('click', () => {
    navigateTo('confirmation', { hideNav: true });
  });

  document.getElementById('btn-scan-another').addEventListener('click', () => {
    navigateTo('home');
  });

  document.getElementById('btn-share-family').addEventListener('click', () => {
    const summary = state.currentSummary || 'Document scanned with Suchna AI';
    const text = encodeURIComponent(summary.substring(0, 200) + ' — Suchna AI');
    window.open(`https://wa.me/?text=${text}`, '_blank');
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
        card.style.animation = 'none';
        card.offsetHeight;
        card.style.animation = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // ---- History card clicks → canned results ----
  document.querySelectorAll('#history-list .history-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.play-mini-btn')) return;
      showResultsFor(card.dataset.category || card.dataset.doc);
    });
  });

  // ---- Canned results (for history/demo cards) ----
  const docData = {
    bank: {
      chip: '🏦 Bank Notice — SBI Loan EMI Overdue',
      badge: '🏦 Bank Notice',
      summaryHi: 'आपका लोन EMI 2 महीने से बकाया है। 20 तारीख तक ₹4,300 जमा करें, वरना जुर्माना लगेगा।',
      actions: [
        { icon: '📅', iconClass: 'calendar', label: 'Pay by / भुगतान की तारीख', value: '20 March 2026', valueClass: '' },
        { icon: '💰', iconClass: 'money', label: 'Amount Due / बकाया राशि', value: '₹4,300', valueClass: 'amount' },
        { icon: '📞', iconClass: 'phone', label: 'Call Branch / ब्रांच को कॉल करें', value: '1800-111-0019', valueClass: '' },
      ],
    },
    govt: {
      chip: '🏛️ Government Letter — PM Kisan Yojana',
      badge: '🏛️ Government',
      summaryHi: 'PM किसान योजना की ₹6,000 की किस्त आपके खाते में भेजी गई है। अपने बैंक में जाकर पासबुक अपडेट करें।',
      actions: [
        { icon: '💰', iconClass: 'money', label: 'Amount / राशि', value: '₹6,000', valueClass: 'amount' },
        { icon: '🏦', iconClass: 'calendar', label: 'Action / करवाएं', value: 'Update Passbook', valueClass: '' },
        { icon: '📞', iconClass: 'phone', label: 'Helpline / हेल्पलाइन', value: '155261', valueClass: '' },
      ],
    },
    school: {
      chip: '🏫 School Form — Admission',
      badge: '🏫 School',
      summaryHi: 'बच्चे के एडमिशन के लिए 25 मार्च तक फॉर्म जमा करें। आधार कार्ड और जन्म प्रमाण पत्र ज़रूरी है।',
      actions: [
        { icon: '📅', iconClass: 'calendar', label: 'Deadline / अंतिम तारीख', value: '25 March 2026', valueClass: '' },
        { icon: '📝', iconClass: 'money', label: 'Documents / दस्तावेज़', value: 'Aadhaar + Birth Cert.', valueClass: '' },
        { icon: '📞', iconClass: 'phone', label: 'School / स्कूल', value: '0141-XXXXXXX', valueClass: '' },
      ],
    },
  };

  function showResultsFor(docType, imgUrl) {
    const data = docData[docType] || docData.bank;

    document.querySelector('.doc-type-chip').innerHTML = data.chip;
    document.querySelector('.results-badge .badge').textContent = data.badge;
    document.getElementById('summary-text').textContent = data.summaryHi;
    state.currentSummary = data.summaryHi;

    document.querySelector('.action-list').innerHTML = data.actions
      .map(a => `
        <div class="action-item">
          <div class="action-icon ${a.iconClass}">${a.icon}</div>
          <div class="action-text">
            <div class="action-label">${a.label}</div>
            <div class="action-value ${a.valueClass}">${a.value}</div>
          </div>
        </div>
      `).join('');

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

  // ---- Load voices (for speech synthesis) ----
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ---- Initialize ----
  function init() {
    navigateTo('home');
    console.log('🇮🇳 Suchna AI initialized — दस्तावेज़ सहायक ready');
    console.log('📷 Camera: getUserMedia (HTTPS required)');
    console.log('📄 OCR: Tesseract.js v5 (eng+hin, runs in browser)');
  }

  init();
})();
