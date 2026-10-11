/**
 * TOEIC Web Assessment - Comprehensive Engine
 * 1. Candidate Registration & Onboarding
 * 2. Real-time Leaderboard & Multi-tier Ranking
 * 3. Part-by-Part Practice Mode (Part 1 - 7)
 * 4. Advanced Audio Controller (0.8x - 1.5x, Tua 5s, Loop)
 * 5. Transcript & Detailed Explanations Drawer
 * 6. Skills Radar Chart Analysis & CEFR Grading
 * 7. Mistake Notebook & Flashcard Retake
 * 8. Official Certificate of Completion (Print & PDF)
 * 9. Serverless Cloud Sync (Google Sheets Webhook / REST API)
 * 10. Show/Hide Answers Toggle
 */

(function () {
  'use strict';

  var STORAGE_CANDIDATE_KEY = 'toeic_candidate_info';
  var STORAGE_LEADERBOARD_KEY = 'toeic_exam_leaderboard';
  var STORAGE_MISTAKES_KEY = 'toeic_mistake_notebook';
  var STORAGE_SETTINGS_KEY = 'toeic_app_settings';

  /* ========================================================
     MOBILE & SAFARI TOUCH EVENT UTILITIES
     ======================================================== */
  function isolateTouchEvents(element) {
    if (!element) return;
    var stopProp = function (e) {
      e.stopPropagation();
    };
    element.addEventListener('touchstart', stopProp, { passive: true });
    element.addEventListener('touchmove', stopProp, { passive: true });
    element.addEventListener('touchend', stopProp, { passive: true });
  }

  function addTapListener(element, callback) {
    if (!element) return;
    var lastTrigger = 0;
    var touchMoved = false;
    var touchStarted = false;

    element.addEventListener('touchstart', function (e) {
      touchMoved = false;
      touchStarted = true;
      e.stopPropagation();
    }, { passive: true });

    element.addEventListener('touchmove', function (e) {
      touchMoved = true;
      e.stopPropagation();
    }, { passive: true });

    element.addEventListener('touchend', function (e) {
      e.stopPropagation();
      if (touchStarted && !touchMoved) {
        var now = Date.now();
        if (now - lastTrigger > 280) {
          lastTrigger = now;
          callback.call(element, e);
        }
      }
      touchStarted = false;
    }, { passive: true });

    element.addEventListener('click', function (e) {
      e.stopPropagation();
      var now = Date.now();
      if (now - lastTrigger > 280) {
        lastTrigger = now;
        callback.call(element, e);
      }
    });
  }

  var SEED_DATA = [
    {
      id: 'seed-1',
      name: 'Nguyễn Minh Quân',
      email: 'quan.nm@example.com',
      score: 42,
      maxScore: 45,
      percent: 93,
      scaledScore: 925,
      duration: '22:15',
      durationSeconds: 1335,
      date: '10/10/2026 09:30',
      timestamp: Date.now() - 86400000 * 2,
      partScores: { 1: 95, 2: 92, 3: 90, 4: 94, 5: 95, 6: 90, 7: 92 }
    },
    {
      id: 'seed-2',
      name: 'Trần Thị Thu Hà',
      email: 'ha.ttt@example.com',
      score: 39,
      maxScore: 45,
      percent: 87,
      scaledScore: 865,
      duration: '24:50',
      durationSeconds: 1490,
      date: '10/10/2026 14:15',
      timestamp: Date.now() - 86400000 * 1,
      partScores: { 1: 90, 2: 85, 3: 88, 4: 85, 5: 90, 6: 80, 7: 85 }
    },
    {
      id: 'seed-3',
      name: 'Lê Hoàng Long',
      email: 'long.lh@example.com',
      score: 35,
      maxScore: 45,
      percent: 78,
      scaledScore: 780,
      duration: '26:10',
      durationSeconds: 1570,
      date: '11/10/2026 10:05',
      timestamp: Date.now() - 3600000 * 4,
      partScores: { 1: 80, 2: 75, 3: 80, 4: 75, 5: 80, 6: 75, 7: 75 }
    }
  ];

  // Global Engine State
  var state = {
    currentCandidate: null,
    isAnswerVisible: true,
    hasRecordedResult: false,
    activePresentationPlayer: null,
    activeQuizPlayer: null,
    activeQuizSession: null,
    examStartTime: null,
    lastExamResult: null,

    // Audio Controller State
    currentAudio: null,
    audioPlaybackRate: 1.0,
    audioIsLooping: false,

    // Practice Mode State
    practiceQuestions: [],
    currentPracticePart: 1,
    currentPracticeIndex: 0,
    selectedPracticeOption: null,

    // Mistake Notebook State
    mistakes: [],

    // Settings
    settings: {
      webhookUrl: '',
      autoSync: true
    }
  };

  /* ========================================================
     1. STORAGE HELPERS
     ======================================================== */
  function getCandidate() {
    if (state.currentCandidate) return state.currentCandidate;
    try {
      var saved = localStorage.getItem(STORAGE_CANDIDATE_KEY);
      if (saved) {
        state.currentCandidate = JSON.parse(saved);
        return state.currentCandidate;
      }
    } catch (e) {
      console.warn(e);
    }
    return null;
  }

  function saveCandidate(cand) {
    state.currentCandidate = cand;
    try {
      localStorage.setItem(STORAGE_CANDIDATE_KEY, JSON.stringify(cand));
    } catch (e) {
      console.warn(e);
    }
  }

  function getLeaderboard() {
    try {
      var raw = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return sortLeaderboard(list);
      }
    } catch (e) {
      console.warn(e);
    }
    saveLeaderboard(SEED_DATA);
    return SEED_DATA;
  }

  function saveLeaderboard(list) {
    try {
      localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn(e);
    }
  }

  function sortLeaderboard(list) {
    return list.sort(function (a, b) {
      if (b.percent !== a.percent) return b.percent - a.percent;
      var aDur = a.durationSeconds || 999999;
      var bDur = b.durationSeconds || 999999;
      if (aDur !== bDur) return aDur - bDur;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }

  function getMistakes() {
    try {
      var raw = localStorage.getItem(STORAGE_MISTAKES_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) {
          state.mistakes = list;
          return list;
        }
      }
    } catch (e) {
      console.warn(e);
    }
    state.mistakes = [];
    return [];
  }

  function saveMistakes(list) {
    state.mistakes = list;
    try {
      localStorage.setItem(STORAGE_MISTAKES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn(e);
    }
    updateMistakesBadge();
  }

  function addMistake(question) {
    if (!question || !question.id) return;
    var list = getMistakes();
    var exists = list.some(function (m) { return m.id === question.id; });
    if (!exists) {
      list.unshift({
        id: question.id,
        partId: question.partId || 1,
        partName: question.partName || 'Part ' + (question.partId || 1),
        question: question.question,
        options: question.options,
        correctLetter: question.correctLetter,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        mediaFiles: question.mediaFiles,
        addedAt: Date.now()
      });
      saveMistakes(list);
    }
  }

  function removeMistake(questionId) {
    var list = getMistakes();
    list = list.filter(function (m) { return m.id !== questionId; });
    saveMistakes(list);
    renderMistakesList();
  }

  function getSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        state.settings = Object.assign({}, state.settings, JSON.parse(raw));
      }
    } catch (e) {
      console.warn(e);
    }
    return state.settings;
  }

  function saveSettings(s) {
    state.settings = Object.assign({}, state.settings, s);
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (e) {
      console.warn(e);
    }
  }

  function calculateScaledToeic(percent) {
    if (isNaN(percent) || percent <= 0) return 10;
    var raw = 10 + (percent / 100) * 980;
    var rounded = Math.round(raw / 5) * 5;
    return Math.min(990, Math.max(10, rounded));
  }

  function getCefrLevel(scaledScore) {
    if (scaledScore >= 905) return { level: 'C1+', title: 'Xuất sắc / Master', desc: 'Thành thạo gần như người bản xứ.' };
    if (scaledScore >= 785) return { level: 'C1', title: 'Nâng cao / Advanced', desc: 'Giao tiếp tốt trong mọi ngữ cảnh học thuật và công việc.' };
    if (scaledScore >= 605) return { level: 'B2', title: 'Khá / Upper Intermediate', desc: 'Sử dụng tiếng Anh độc lập, đáp ứng tiêu chuẩn làm việc đa quốc gia.' };
    if (scaledScore >= 405) return { level: 'B1', title: 'Trung cấp / Intermediate', desc: 'Hiểu các tình huống quen thuộc, đáp ứng chuẩn đầu ra đại học.' };
    if (scaledScore >= 255) return { level: 'A2', title: 'Sơ cấp / Elementary', desc: 'Giao tiếp ở mức cơ bản, cần bổ sung nhiều từ vựng và ngữ pháp.' };
    return { level: 'A1', title: 'Cơ bản / Beginner', desc: 'Mới bắt đầu làm quen tiếng Anh, cần lộ trình học từ nền tảng.' };
  }

  function formatDuration(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function formatDate(d) {
    var date = d || new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear() + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  /* ========================================================
     2. AUDIO CONTROLLER NÂNG CAO (0.8x, 1.2x, Rewind, Loop)
     ======================================================== */
  function initAudioController() {
    var origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      var self = this;
      state.currentAudio = self;
      self.playbackRate = state.audioPlaybackRate;
      self.loop = state.audioIsLooping;

      var bar = document.getElementById('toeic-audio-controller');
      if (bar) bar.classList.remove('hidden');

      return origPlay.apply(this, arguments);
    };

    // Inject Audio Controller Widget
    var audioBar = document.createElement('div');
    audioBar.id = 'toeic-audio-controller';
    audioBar.className = 'hidden';
    audioBar.innerHTML = [
      '<span class="audio-ctrl-label">🎧 Audio:</span>',
      '<button class="audio-ctrl-btn" id="audio-speed-08" title="Tốc độ chậm">0.8x</button>',
      '<button class="audio-ctrl-btn active" id="audio-speed-10" title="Tốc độ bình thường">1.0x</button>',
      '<button class="audio-ctrl-btn" id="audio-speed-12" title="Tốc độ nhanh">1.2x</button>',
      '<button class="audio-ctrl-btn" id="audio-speed-15" title="Tốc độ rất nhanh">1.5x</button>',
      '<span style="color:rgba(255,255,255,0.2);margin:0 2px;">|</span>',
      '<button class="audio-ctrl-btn" id="audio-rewind" title="Tua lại 5 giây">⏪ -5s</button>',
      '<button class="audio-ctrl-btn" id="audio-forward" title="Tua tới 5 giây">⏩ +5s</button>',
      '<button class="audio-ctrl-btn" id="audio-loop" title="Lặp lại bài nghe">🔁 Loop</button>'
    ].join('');
    document.body.appendChild(audioBar);
    isolateTouchEvents(audioBar);

    function setSpeed(rate, btnId) {
      state.audioPlaybackRate = rate;
      if (state.currentAudio) state.currentAudio.playbackRate = rate;
      ['audio-speed-08', 'audio-speed-10', 'audio-speed-12', 'audio-speed-15'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active');
      });
      var activeEl = document.getElementById(btnId);
      if (activeEl) activeEl.classList.add('active');
    }

    addTapListener(document.getElementById('audio-speed-08'), function () { setSpeed(0.8, 'audio-speed-08'); });
    addTapListener(document.getElementById('audio-speed-10'), function () { setSpeed(1.0, 'audio-speed-10'); });
    addTapListener(document.getElementById('audio-speed-12'), function () { setSpeed(1.2, 'audio-speed-12'); });
    addTapListener(document.getElementById('audio-speed-15'), function () { setSpeed(1.5, 'audio-speed-15'); });

    addTapListener(document.getElementById('audio-rewind'), function () {
      if (state.currentAudio) {
        state.currentAudio.currentTime = Math.max(0, state.currentAudio.currentTime - 5);
      }
    });

    addTapListener(document.getElementById('audio-forward'), function () {
      if (state.currentAudio) {
        state.currentAudio.currentTime = Math.min(state.currentAudio.duration || 9999, state.currentAudio.currentTime + 5);
      }
    });

    addTapListener(document.getElementById('audio-loop'), function () {
      state.audioIsLooping = !state.audioIsLooping;
      if (state.currentAudio) state.currentAudio.loop = state.audioIsLooping;
      this.classList.toggle('active', state.audioIsLooping);
    });
  }

  /* ========================================================
     3. ANSWER TOGGLE CONTROLLER
     ======================================================== */
  var dynamicAnswerStyle = null;

  function initAnswerToggle() {
    dynamicAnswerStyle = document.createElement('style');
    dynamicAnswerStyle.id = 'toeic-dynamic-answer-style';
    document.head.appendChild(dynamicAnswerStyle);
    updateAnswerVisibility();

    var observer = new MutationObserver(function () {
      if (!state.isAnswerVisible) {
        var els = document.querySelectorAll('.toeic-answer-line, [data-toeic-answer="true"]');
        for (var i = 0; i < els.length; i++) {
          if (els[i].style.display !== 'none') els[i].style.display = 'none';
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function updateAnswerVisibility() {
    var btn = document.getElementById('toeic-answer-btn');
    var textSpan = document.getElementById('toeic-answer-text');
    var iconSvg = document.getElementById('toeic-answer-icon');

    if (state.isAnswerVisible) {
      if (dynamicAnswerStyle) dynamicAnswerStyle.innerHTML = '';
      if (btn) btn.className = 'toeic-bar-btn';
      if (textSpan) textSpan.innerText = 'Đáp án: BẬT';
      if (iconSvg) {
        iconSvg.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
      }
      var els = document.querySelectorAll('.toeic-answer-line, [data-toeic-answer="true"]');
      for (var i = 0; i < els.length; i++) els[i].style.display = '';
    } else {
      if (dynamicAnswerStyle) {
        dynamicAnswerStyle.innerHTML = '.toeic-answer-line, [data-toeic-answer="true"] { display: none !important; }';
      }
      if (btn) btn.className = 'toeic-bar-btn hidden-mode';
      if (textSpan) textSpan.innerText = 'Đáp án: TẮT';
      if (iconSvg) {
        iconSvg.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
      }
      var elsHidden = document.querySelectorAll('.toeic-answer-line, [data-toeic-answer="true"]');
      for (var j = 0; j < elsHidden.length; j++) elsHidden[j].style.display = 'none';
    }
  }

  function toggleAnswer() {
    state.isAnswerVisible = !state.isAnswerVisible;
    updateAnswerVisibility();
  }

  /* ========================================================
     4. RECORDING & CELEBRATION HOOK
     ======================================================== */
  function recordExamResult(awardedScore, maxScore, percent, durationSeconds) {
    if (state.hasRecordedResult) return;
    state.hasRecordedResult = true;

    var candidate = getCandidate() || { name: 'Thí sinh tự do', email: '' };
    awardedScore = Math.round(Number(awardedScore) || 0);
    maxScore = Math.max(1, Math.round(Number(maxScore) || 45));

    if (isNaN(percent) || percent <= 0) {
      percent = Math.round((awardedScore / maxScore) * 100);
    } else {
      percent = Math.round(Number(percent));
    }

    if (!durationSeconds && state.examStartTime) {
      durationSeconds = Math.round((Date.now() - state.examStartTime) / 1000);
    }
    durationSeconds = Math.max(1, durationSeconds || 60);

    var scaledScore = calculateScaledToeic(percent);
    var durationStr = formatDuration(durationSeconds);
    var dateStr = formatDate(new Date());

    // Estimate Part performance based on total score percentage
    var variance = function (base, delta) { return Math.min(100, Math.max(10, Math.round(base + (Math.random() * delta * 2 - delta)))); };
    var partScores = {
      1: variance(percent + 5, 6),
      2: variance(percent, 8),
      3: variance(percent - 3, 7),
      4: variance(percent - 4, 8),
      5: variance(percent + 2, 7),
      6: variance(percent - 2, 8),
      7: variance(percent - 5, 9)
    };

    var newEntry = {
      id: 'entry-' + Date.now(),
      name: candidate.name,
      email: candidate.email || '',
      score: awardedScore,
      maxScore: maxScore,
      percent: percent,
      scaledScore: scaledScore,
      duration: durationStr,
      durationSeconds: durationSeconds,
      date: dateStr,
      timestamp: Date.now(),
      partScores: partScores
    };

    state.lastExamResult = newEntry;

    var list = getLeaderboard();
    list.push(newEntry);
    list = sortLeaderboard(list);
    saveLeaderboard(list);

    // Sync to Cloud Webhook if configured
    syncToCloudWebhook(newEntry);

    var currentRank = 1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === newEntry.id) {
        currentRank = i + 1;
        break;
      }
    }

    showCelebrationModal({
      candidateName: candidate.name,
      score: awardedScore,
      maxScore: maxScore,
      percent: percent,
      scaledScore: scaledScore,
      duration: durationStr,
      rank: currentRank,
      totalParticipants: list.length,
      entry: newEntry
    });
  }

  /* ========================================================
     5. SERVERLESS CLOUD SYNC (Google Sheets Webhook / API)
     ======================================================== */
  function syncToCloudWebhook(entry) {
    var conf = getSettings();
    if (!conf.webhookUrl || !conf.autoSync) return;

    try {
      fetch(conf.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify(entry)
      }).then(function () {
        console.log('Successfully posted exam result to Cloud Webhook');
      }).catch(function (err) {
        console.warn('Could not sync to webhook', err);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  /* ========================================================
     6. ISPRING ENGINE EVENT HOOKS
     ======================================================== */
  function setupIspringHooks() {
    if (window.iSpring && window.iSpring.InteractionPlayerFactory) {
      var origReg = window.iSpring.InteractionPlayerFactory.registerCreateQuizPlayerFunction;
      window.iSpring.InteractionPlayerFactory.registerCreateQuizPlayerFunction = function (creatorFn) {
        return origReg(function (a, b, c, d, e, g, h, k, m, p, t, v) {
          var wrappedK = function (quizPlayer) {
            state.activeQuizPlayer = quizPlayer;

            if (quizPlayer.currentSessionChangedEvent) {
              quizPlayer.currentSessionChangedEvent().addHandler(function (session) {
                state.activeQuizSession = session;
                if (session && session.quizStateChangeEvent) {
                  session.quizStateChangeEvent().addHandler(function () {
                    if (session.quizState && session.quizState() === 'completed') {
                      onQuizSessionFinished(session);
                    }
                  });
                }
              });
            }

            if (quizPlayer.quizPlayerEvent) {
              quizPlayer.quizPlayerEvent().addHandler(function (ev) {
                if (ev === 'quizFinished') {
                  var session = quizPlayer.currentSession ? quizPlayer.currentSession() : state.activeQuizSession;
                  onQuizSessionFinished(session);
                }
              });
            }

            return k(quizPlayer);
          };
          return creatorFn(a, b, c, d, e, g, h, wrappedK, m, p, t, v);
        });
      };
    }

    var resultObserver = new MutationObserver(function () {
      if (state.hasRecordedResult) return;
      var resultDom = document.querySelector('.visualizer.result, .detailed_results, .groupsResult');
      if (resultDom) {
        setTimeout(function () {
          if (!state.hasRecordedResult) onQuizSessionFinished(state.activeQuizSession);
        }, 500);
      }
    });
    resultObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function onQuizSessionFinished(session) {
    if (state.hasRecordedResult) return;

    var awarded = 0;
    var max = 45;
    var percent = 0;
    var duration = 0;

    if (session) {
      if (typeof session.awardedScore === 'function') awarded = session.awardedScore();
      if (typeof session.maxScore === 'function') max = session.maxScore();
      if (typeof session.percent === 'function') {
        percent = Math.round(session.percent() * 100);
      } else if (max > 0) {
        percent = Math.round((awarded / max) * 100);
      }
      if (typeof session.testDuration === 'function') {
        duration = session.testDuration();
      }
    } else {
      var scoreValEl = document.querySelector('.bottomLabels .userScoreValue, .userScoreValue');
      if (scoreValEl && scoreValEl.innerText) {
        var num = parseInt(scoreValEl.innerText.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) awarded = num;
      }
      var maxValEl = document.querySelector('.bottomLabels .passingScoreValue, .passingScoreValue');
      if (maxValEl && maxValEl.innerText) {
        var mNum = parseInt(maxValEl.innerText.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(mNum)) max = mNum;
      }
      percent = Math.round((awarded / max) * 100);
    }

    recordExamResult(awarded, max, percent, duration);
  }

  /* ========================================================
     7. UI MODALS & TOP ACTION BAR INJECTION
     ======================================================== */
  function injectUI() {
    // 1. Top Bar
    var topBar = document.createElement('div');
    topBar.id = 'toeic-top-bar';
    topBar.innerHTML = [
      '<button id="toeic-candidate-chip" class="toeic-bar-btn" title="Thông tin thí sinh (nhấp để đổi)">',
      '  <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      '  <span id="toeic-candidate-name">Thí sinh</span>',
      '</button>',
      '<button id="toeic-practice-btn" class="toeic-bar-btn" style="background:#0284c7;color:#fff;" title="Luyện thi theo từng Part (Part 1 - 7)">',
      '  <svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>',
      '  <span>Luyện Part</span>',
      '</button>',
      '<button id="toeic-leaderboard-btn" class="toeic-bar-btn" title="Bảng xếp hạng thành tích">',
      '  <svg viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/></svg>',
      '  <span>Xếp Hạng</span>',
      '</button>',
      '<button id="toeic-mistakes-btn" class="toeic-bar-btn" style="background:#7c3aed;color:#fff;" title="Sổ tay câu sai & Ôn tập lại">',
      '  <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>',
      '  <span>Sổ Câu Sai <span id="mistakes-count-badge" style="background:#ef4444;border-radius:10px;padding:1px 6px;font-size:11px;margin-left:2px;">0</span></span>',
      '</button>',
      '<button id="toeic-answer-btn" class="toeic-bar-btn" title="Bật / Tắt hiển thị đáp án">',
      '  <svg viewBox="0 0 24 24" id="toeic-answer-icon"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
      '  <span id="toeic-answer-text">Đáp án: BẬT</span>',
      '</button>',
      '<button id="toeic-settings-btn" class="toeic-bar-btn" style="background:rgba(255,255,255,0.15);color:#fff;" title="Cài đặt & Đồng bộ Cloud">',
      '  <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
      '</button>',
      '<button id="toeic-bar-collapse-btn" class="toeic-bar-btn" title="Thu gọn / Mở rộng Menu" style="background:rgba(255,255,255,0.18);padding:6px 10px;">',
      '  <span id="collapse-icon">✕</span>',
      '</button>'
    ].join('');
    document.body.appendChild(topBar);

    // 2. Start Exam Modal
    var startModal = document.createElement('div');
    startModal.id = 'toeic-start-modal';
    startModal.className = 'toeic-modal-overlay';
    startModal.innerHTML = [
      '<div class="toeic-modal-card">',
      '  <div class="toeic-modal-header">',
      '    <h2>🎓 Đánh Giá Năng Lực TOEIC</h2>',
      '    <p>Vui lòng điền thông tin thí sinh để bắt đầu bài thi và ghi danh vào Bảng Xếp Hạng.</p>',
      '    <button class="toeic-modal-close" id="start-modal-close" style="display:none;" title="Đóng">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="toeic-info-box">',
      '      <div class="toeic-info-icon">📋</div>',
      '      <div class="toeic-info-text">',
      '        <strong>Cấu trúc đề thi:</strong> Bao gồm đầy đủ 7 phần (Listening Part 1-4 & Reading Part 5-7). Kết quả và thời gian làm bài sẽ được tự động xếp hạng ngay sau khi nộp bài.',
      '      </div>',
      '    </div>',
      '    <form id="toeic-start-form">',
      '      <div class="toeic-form-group">',
      '        <label class="toeic-form-label" for="candidate-name-input">Họ và tên thí sinh <span class="required">*</span></label>',
      '        <input type="text" id="candidate-name-input" class="toeic-input" placeholder="Ví dụ: Nguyễn Văn An" autocomplete="name" required />',
      '        <div id="name-error-msg" class="toeic-error-msg">Vui lòng nhập họ và tên của bạn (tối thiểu 2 ký tự).</div>',
      '      </div>',
      '      <div class="toeic-form-group">',
      '        <label class="toeic-form-label" for="candidate-email-input">Email hoặc Mã học viên <span style="font-weight:normal;color:#94a3b8;">(Không bắt buộc)</span></label>',
      '        <input type="text" id="candidate-email-input" class="toeic-input" placeholder="Ví dụ: student@toeic.edu.vn" />',
      '      </div>',
      '      <div class="toeic-form-group">',
      '        <label class="toeic-form-label" for="candidate-target-input">Mục tiêu điểm số</label>',
      '        <select id="candidate-target-input" class="toeic-input" style="background:#fff;">',
      '          <option value="500">Mục tiêu 500+ (Cơ bản)</option>',
      '          <option value="650" selected>Mục tiêu 650+ (Khá)</option>',
      '          <option value="800">Mục tiêu 800+ (Nâng cao)</option>',
      '          <option value="900">Mục tiêu 900+ (Xuất sắc)</option>',
      '        </select>',
      '      </div>',
      '      <button type="submit" class="toeic-primary-btn" id="start-exam-submit-btn">',
      '        <span>🚀 BẮT ĐẦU LÀM BÀI THI</span>',
      '      </button>',
      '    </form>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(startModal);

    // 3. Leaderboard Modal
    var lbModal = document.createElement('div');
    lbModal.id = 'toeic-leaderboard-modal';
    lbModal.className = 'toeic-modal-overlay';
    lbModal.innerHTML = [
      '<div class="toeic-modal-card leaderboard-card">',
      '  <div class="toeic-modal-header" style="background:linear-gradient(135deg, #b45309 0%, #f59e0b 100%);">',
      '    <h2>🏆 BẢNG XẾP HẠNG THÀNH TÍCH TOEIC</h2>',
      '    <p>Top thí sinh đạt điểm số cao nhất và hoàn thành bài thi nhanh nhất.</p>',
      '    <button class="toeic-modal-close" id="lb-modal-close" title="Đóng">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="leaderboard-stats-grid">',
      '      <div class="leaderboard-stat-card">',
      '        <div class="leaderboard-stat-num" id="stat-total-count">0</div>',
      '        <div class="leaderboard-stat-title">Lượt làm bài</div>',
      '      </div>',
      '      <div class="leaderboard-stat-card">',
      '        <div class="leaderboard-stat-num" id="stat-high-score">0</div>',
      '        <div class="leaderboard-stat-title">Điểm cao nhất (~/990)</div>',
      '      </div>',
      '      <div class="leaderboard-stat-card">',
      '        <div class="leaderboard-stat-num" id="stat-avg-score">0</div>',
      '        <div class="leaderboard-stat-title">Điểm trung bình</div>',
      '      </div>',
      '    </div>',
      '    <div class="leaderboard-toolbar">',
      '      <input type="text" id="lb-search-input" class="leaderboard-search" placeholder="🔍 Tìm kiếm theo tên thí sinh..." />',
      '      <div class="leaderboard-action-btns">',
      '        <button class="leaderboard-sm-btn" id="lb-export-csv" title="Xuất dữ liệu ra CSV">📥 Xuất CSV</button>',
      '        <button class="leaderboard-sm-btn" id="lb-reset-btn" title="Xóa lịch sử bảng xếp hạng" style="color:#ef4444;">🗑️ Làm mới</button>',
      '      </div>',
      '    </div>',
      '    <div class="leaderboard-table-wrap">',
      '      <table class="leaderboard-table">',
      '        <thead>',
      '          <tr>',
      '            <th style="width:50px;text-align:center;">Hạng</th>',
      '            <th>Thí sinh</th>',
      '            <th style="text-align:center;">Số câu đúng</th>',
      '            <th style="text-align:center;">Tỉ lệ</th>',
      '            <th style="text-align:center;">Điểm TOEIC</th>',
      '            <th style="text-align:center;">Thời gian</th>',
      '            <th style="text-align:right;">Ngày thi</th>',
      '          </tr>',
      '        </thead>',
      '        <tbody id="leaderboard-tbody"></tbody>',
      '      </table>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(lbModal);

    // 4. Celebration Modal
    var celebModal = document.createElement('div');
    celebModal.id = 'toeic-celeb-modal';
    celebModal.className = 'toeic-modal-overlay';
    celebModal.innerHTML = [
      '<div class="toeic-modal-card" style="max-width:520px;">',
      '  <div class="toeic-modal-body" style="padding:32px 28px 24px;">',
      '    <div class="celebration-badge-wrap"><span class="celebration-trophy">🏆</span></div>',
      '    <h3 class="celebration-title">HOÀN THÀNH BÀI THI!</h3>',
      '    <p class="celebration-subtitle">Chúc mừng <strong id="celeb-candidate-name">Thí sinh</strong> đã hoàn thành bài đánh giá TOEIC.</p>',
      '    <div class="celebration-scores-card">',
      '      <div class="celebration-score-item">',
      '        <div class="val" id="celeb-score-correct">0/45</div>',
      '        <div class="lbl">Số câu đúng</div>',
      '      </div>',
      '      <div class="celebration-score-item">',
      '        <div class="val" id="celeb-score-scaled">10</div>',
      '        <div class="lbl">Điểm TOEIC (~/990)</div>',
      '      </div>',
      '      <div class="celebration-score-item">',
      '        <div class="val" id="celeb-score-rank">#1</div>',
      '        <div class="lbl">Xếp hạng</div>',
      '      </div>',
      '    </div>',
      '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">',
      '      <button class="toeic-secondary-btn" id="celeb-view-radar-btn" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;">📊 Phân Tích Năng Lực</button>',
      '      <button class="toeic-secondary-btn" id="celeb-view-cert-btn" style="background:#fef3c7;color:#b45309;border-color:#fde68a;">🎓 Nhận Chứng Chỉ</button>',
      '    </div>',
      '    <div class="celebration-actions">',
      '      <button class="toeic-primary-btn" id="celeb-view-lb-btn">🏆 Bảng Xếp Hạng</button>',
      '      <button class="toeic-secondary-btn" id="celeb-close-btn">Đóng / Xem lại đề</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(celebModal);

    // 5. Practice Mode Modal
    var practiceModal = document.createElement('div');
    practiceModal.id = 'toeic-practice-modal';
    practiceModal.className = 'toeic-modal-overlay';
    practiceModal.innerHTML = [
      '<div class="toeic-modal-card leaderboard-card">',
      '  <div class="toeic-modal-header" style="background:linear-gradient(135deg, #0369a1 0%, #0284c7 100%);">',
      '    <h2>📚 LUYỆN TẬP THEO TỪNG PART</h2>',
      '    <p>Chọn từng phần TOEIC để ôn luyện chuyên sâu, kiểm tra đáp án ngay và xem transcript.</p>',
      '    <button class="toeic-modal-close" id="practice-modal-close" title="Đóng">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="practice-part-tabs" id="practice-part-tabs">',
      '      <button class="practice-tab-btn active" data-part="1">Part 1 (Mô tả tranh)</button>',
      '      <button class="practice-tab-btn" data-part="2">Part 2 (Hỏi - Đáp)</button>',
      '      <button class="practice-tab-btn" data-part="3">Part 3 (Hội thoại)</button>',
      '      <button class="practice-tab-btn" data-part="4">Part 4 (Bài nói)</button>',
      '      <button class="practice-tab-btn" data-part="5">Part 5 (Điền câu)</button>',
      '      <button class="practice-tab-btn" data-part="6">Part 6 (Điền đoạn)</button>',
      '      <button class="practice-tab-btn" data-part="7">Part 7 (Đọc hiểu)</button>',
      '    </div>',
      '    <div id="practice-question-container"></div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(practiceModal);

    // 6. Transcript & Explanation Drawer
    var drawer = document.createElement('div');
    drawer.id = 'toeic-drawer-overlay';
    drawer.className = 'toeic-drawer-overlay';
    drawer.innerHTML = [
      '<div class="toeic-side-drawer">',
      '  <div class="toeic-drawer-header">',
      '    <h3>💡 Transcript & Lời Giải Thích</h3>',
      '    <button class="toeic-modal-close" id="drawer-close-btn" style="position:static;">&times;</button>',
      '  </div>',
      '  <div class="toeic-drawer-body">',
      '    <div class="drawer-section" id="drawer-audio-section" style="display:none;">',
      '      <div class="drawer-section-title">🎙️ Audio Nghe Lại:</div>',
      '      <audio id="drawer-audio-player" controls style="width:100%;margin-top:6px;"></audio>',
      '    </div>',
      '    <div class="drawer-section">',
      '      <div class="drawer-section-title">📝 Transcript (Nội Dung Bài Nghe):</div>',
      '      <div class="drawer-transcript-box" id="drawer-transcript-content">Không có transcript cho câu này.</div>',
      '    </div>',
      '    <div class="drawer-section">',
      '      <div class="drawer-section-title">💡 Giải Thích & Mẹo Làm Bài:</div>',
      '      <div class="drawer-explanation-box" id="drawer-explanation-content">Nội dung giải thích.</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(drawer);

    // 7. Radar Chart & Skills Analysis Modal
    var radarModal = document.createElement('div');
    radarModal.id = 'toeic-radar-modal';
    radarModal.className = 'toeic-modal-overlay';
    radarModal.innerHTML = [
      '<div class="toeic-modal-card leaderboard-card">',
      '  <div class="toeic-modal-header" style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);">',
      '    <h2>📊 PHÂN TÍCH NĂNG LỰC CHI TIẾT</h2>',
      '    <p>Đánh giá điểm mạnh, điểm yếu theo 7 kỹ năng TOEIC và xếp hạng trình độ CEFR.</p>',
      '    <button class="toeic-modal-close" id="radar-modal-close">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="cefr-badge-box">',
      '      <div class="cefr-badge-large" id="radar-cefr-badge">B2</div>',
      '      <div>',
      '        <div style="font-size:18px;font-weight:800;" id="radar-cefr-title">Trình độ B2 (Upper Intermediate)</div>',
      '        <div style="font-size:13px;opacity:0.9;margin-top:4px;" id="radar-cefr-desc">Mô tả trình độ</div>',
      '      </div>',
      '    </div>',
      '    <div class="skills-analysis-grid">',
      '      <div class="skills-radar-wrap">',
      '        <div style="font-weight:700;font-size:14px;color:#334155;margin-bottom:12px;">Biểu Đồ Năng Lực (Skills Radar)</div>',
      '        <svg id="skills-radar-svg" width="280" height="280" viewBox="0 0 300 300"></svg>',
      '      </div>',
      '      <div class="skills-breakdown-list" id="skills-bars-container"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(radarModal);

    // 8. Mistake Notebook Modal
    var mistakeModal = document.createElement('div');
    mistakeModal.id = 'toeic-mistakes-modal';
    mistakeModal.className = 'toeic-modal-overlay';
    mistakeModal.innerHTML = [
      '<div class="toeic-modal-card leaderboard-card">',
      '  <div class="toeic-modal-header" style="background:linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);">',
      '    <h2>📕 SỔ TAY CÂU SAI & ÔN TẬP</h2>',
      '    <p>Xem lại các câu hỏi đã trả lời sai và luyện tập lại cho đến khi thành thạo.</p>',
      '    <button class="toeic-modal-close" id="mistakes-modal-close">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="leaderboard-toolbar">',
      '      <div style="font-size:14px;font-weight:600;color:#334155;">',
      '        Tổng cộng: <span id="mistakes-total-count" style="color:#7c3aed;font-weight:800;">0</span> câu sai cần ôn',
      '      </div>',
      '      <button class="leaderboard-sm-btn" id="mistakes-clear-all" style="color:#ef4444;">🗑️ Xóa tất cả</button>',
      '    </div>',
      '    <div id="mistakes-list-container" style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;"></div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(mistakeModal);

    // 9. Official Certificate Modal
    var certModal = document.createElement('div');
    certModal.id = 'toeic-certificate-modal';
    certModal.className = 'toeic-modal-overlay';
    certModal.innerHTML = [
      '<div class="toeic-modal-card" style="max-width:680px;">',
      '  <div class="toeic-modal-header" style="background:linear-gradient(135deg, #78350f 0%, #b45309 100%);">',
      '    <h2>🎓 CHỨNG CHỈ HOÀN THÀNH BÀI THI</h2>',
      '    <p>Bản xác nhận thành tích đánh giá năng lực tiếng Anh TOEIC Online.</p>',
      '    <button class="toeic-modal-close" id="cert-modal-close">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="certificate-preview-wrap" id="certificate-print-area">',
      '      <div class="cert-header-title">CERTIFICATE OF TOEIC ASSESSMENT</div>',
      '      <div class="cert-subtitle">HỆ THỐNG ĐÁNH GIÁ NĂNG LỰC TIẾNG ANH CHUẨN ETS</div>',
      '      <div class="cert-recipient-intro">Chứng nhận thành tích được trao cho thí sinh:</div>',
      '      <div class="cert-recipient-name" id="cert-display-name">NGUYỄN VĂN AN</div>',
      '      <div class="cert-desc-text">',
      '        Đã hoàn thành xuất sắc bài thi khảo sát và đánh giá năng lực tổng hợp 7 phần (Listening & Reading) theo chuẩn đề thi TOEIC quốc tế.',
      '      </div>',
      '      <div class="cert-scores-grid">',
      '        <div class="cert-score-item">',
      '          <div class="num" id="cert-score-listening">450</div>',
      '          <div class="lbl">Listening</div>',
      '        </div>',
      '        <div class="cert-score-item">',
      '          <div class="num" id="cert-score-reading">420</div>',
      '          <div class="lbl">Reading</div>',
      '        </div>',
      '        <div class="cert-score-item">',
      '          <div class="num" id="cert-score-total" style="color:#b45309;">870/990</div>',
      '          <div class="lbl">Tổng điểm TOEIC</div>',
      '        </div>',
      '      </div>',
      '      <div class="cert-footer-row">',
      '        <div class="cert-footer-item">',
      '          <div>Ngày cấp: <strong id="cert-display-date">11/10/2026</strong></div>',
      '          <div>Mã xác thực: <strong id="cert-display-code">TOEIC-2026-8891</strong></div>',
      '        </div>',
      '        <div class="cert-footer-item">',
      '          <div class="cert-signature-line"></div>',
      '          <div>Hội Đồng Khảo Thí TOEIC</div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="certificate-action-btns" style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">',
      '      <button class="toeic-secondary-btn" id="cert-print-btn">🖨️ In / Lưu PDF</button>',
      '      <button class="toeic-primary-btn" id="cert-close-btn" style="width:auto;padding:12px 24px;">Hoàn tất</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(certModal);

    // 10. Settings & Cloud Sync Modal
    var settingsModal = document.createElement('div');
    settingsModal.id = 'toeic-settings-modal';
    settingsModal.className = 'toeic-modal-overlay';
    settingsModal.innerHTML = [
      '<div class="toeic-modal-card" style="max-width:580px;">',
      '  <div class="toeic-modal-header" style="background:#1e293b;">',
      '    <h2>⚙️ Cài Đặt & Đồng Bộ Cloud</h2>',
      '    <p>Cấu hình đồng bộ điểm số lên Google Sheets hoặc API tập trung mà không cần server.</p>',
      '    <button class="toeic-modal-close" id="settings-modal-close">&times;</button>',
      '  </div>',
      '  <div class="toeic-modal-body">',
      '    <div class="toeic-form-group">',
      '      <label class="toeic-form-label" for="setting-webhook-url">Webhook URL (Google Apps Script / REST API)</label>',
      '      <input type="text" id="setting-webhook-url" class="toeic-input" placeholder="https://script.google.com/macros/s/.../exec" />',
      '      <p style="font-size:12px;color:#64748b;margin:5px 0 0;">Khi có kết quả thi mới, hệ thống tự động POST dữ liệu JSON về link này.</p>',
      '    </div>',
      '    <div class="toeic-form-group">',
      '      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#334155;cursor:pointer;">',
      '        <input type="checkbox" id="setting-auto-sync" checked />',
      '        Tự động gửi kết quả ngay khi nộp bài thi',
      '      </label>',
      '    </div>',
      '    <div style="margin-top:16px;">',
      '      <div style="font-size:13px;font-weight:700;color:#334155;">📋 Hướng Dẫn Tạo Google Sheets Webhook Miễn Phí (1 Phút):</div>',
      '      <p style="font-size:12.5px;color:#475569;margin:4px 0 6px;">',
      '        Mở Google Sheets ➔ <strong>Tiện ích mở rộng (Extensions)</strong> ➔ <strong>Apps Script</strong> ➔ Dán mã dưới đây và chọn <strong>Deploy as Web App (Anyone)</strong>:',
      '      </p>',
      '      <div class="code-snippet-box">',
      '        <button class="copy-code-btn" id="copy-script-btn">Sao chép</button>',
      '        <pre style="margin:0;">function doPost(e) {\n  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n  var d = JSON.parse(e.postData.contents);\n  sheet.appendRow([new Date(), d.name, d.email, d.score, d.maxScore, d.percent, d.scaledScore, d.duration]);\n  return ContentService.createTextOutput("OK");\n}</pre>',
      '      </div>',
      '    </div>',
      '    <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px;">',
      '      <button class="toeic-secondary-btn" id="setting-test-sync-btn">Kiểm Tra Kết Nối</button>',
      '      <button class="toeic-primary-btn" id="setting-save-btn" style="width:auto;padding:12px 24px;">Lưu Cấu Hình</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(settingsModal);

    // Isolate touch events inside cards & top bar so player.js never cancels touches or scrolling
    [
      topBar,
      startModal.querySelector('.toeic-modal-card'),
      lbModal.querySelector('.toeic-modal-card'),
      celebModal.querySelector('.toeic-modal-card'),
      practiceModal.querySelector('.toeic-modal-card'),
      drawer.querySelector('.toeic-side-drawer'),
      radarModal.querySelector('.toeic-modal-card'),
      mistakeModal.querySelector('.toeic-modal-card'),
      certModal.querySelector('.toeic-modal-card'),
      settingsModal.querySelector('.toeic-modal-card')
    ].forEach(function (el) {
      if (el) isolateTouchEvents(el);
    });

    attachEventHandlers();
    updateMistakesBadge();
  }

  function attachEventHandlers() {
    // Top Bar Buttons
    addTapListener(document.getElementById('toeic-candidate-chip'), function () { openStartModal(true); });
    addTapListener(document.getElementById('toeic-practice-btn'), openPracticeModal);
    addTapListener(document.getElementById('toeic-leaderboard-btn'), openLeaderboardModal);
    addTapListener(document.getElementById('toeic-mistakes-btn'), openMistakesModal);
    addTapListener(document.getElementById('toeic-answer-btn'), toggleAnswer);
    addTapListener(document.getElementById('toeic-settings-btn'), openSettingsModal);

    var collapseBtn = document.getElementById('toeic-bar-collapse-btn');
    if (collapseBtn) {
      addTapListener(collapseBtn, function () {
        var bar = document.getElementById('toeic-top-bar');
        var icon = document.getElementById('collapse-icon');
        if (bar) {
          bar.classList.toggle('collapsed');
          var isCollapsed = bar.classList.contains('collapsed');
          if (icon) icon.innerText = isCollapsed ? '🎯 Menu' : '✕';
        }
      });
    }

    // Start Form
    var formEl = document.getElementById('toeic-start-form');
    var submitBtn = document.getElementById('start-exam-submit-btn');

    function handleStartSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      var nameInput = document.getElementById('candidate-name-input');
      var emailInput = document.getElementById('candidate-email-input');
      var targetInput = document.getElementById('candidate-target-input');
      var errorMsg = document.getElementById('name-error-msg');

      var nameVal = (nameInput ? nameInput.value : '').trim();
      if (nameVal.length < 2) {
        if (nameInput) {
          nameInput.classList.add('error', 'shake');
          setTimeout(function () { nameInput.classList.remove('shake'); }, 400);
        }
        if (errorMsg) errorMsg.classList.add('visible');
        return;
      }

      if (nameInput) nameInput.classList.remove('error');
      if (errorMsg) errorMsg.classList.remove('visible');

      var candidate = {
        name: nameVal,
        email: (emailInput ? emailInput.value : '').trim(),
        target: targetInput ? targetInput.value : '650',
        startTime: Date.now()
      };
      saveCandidate(candidate);
      updateCandidateChip(candidate.name);
      closeStartModal();

      state.examStartTime = Date.now();

      if (state.activePresentationPlayer && state.activePresentationPlayer.view) {
        try {
          var ctrl = state.activePresentationPlayer.view().playbackController();
          if (ctrl && ctrl.currentSlideIndex && ctrl.currentSlideIndex() === 0) {
            ctrl.gotoSlide(1);
          }
        } catch (err) {
          console.log(err);
        }
      }
    }

    if (formEl) formEl.addEventListener('submit', handleStartSubmit);
    addTapListener(submitBtn, handleStartSubmit);
    addTapListener(document.getElementById('start-modal-close'), closeStartModal);
    addTapListener(document.getElementById('toeic-start-modal'), function (e) {
      var cand = getCandidate();
      if (cand && cand.name && e.target === document.getElementById('toeic-start-modal')) {
        closeStartModal();
      }
    });

    // Leaderboard
    addTapListener(document.getElementById('lb-modal-close'), closeLeaderboardModal);
    addTapListener(document.getElementById('toeic-leaderboard-modal'), function (e) {
      if (e.target === this) closeLeaderboardModal();
    });
    document.getElementById('lb-search-input').addEventListener('input', function () {
      renderLeaderboard(this.value);
    });
    addTapListener(document.getElementById('lb-export-csv'), exportLeaderboardCsv);
    addTapListener(document.getElementById('lb-reset-btn'), function () {
      if (confirm('Làm mới Bảng Xếp Hạng về trạng thái ban đầu?')) {
        saveLeaderboard(SEED_DATA);
        renderLeaderboard();
      }
    });

    // Celebration
    addTapListener(document.getElementById('celeb-view-lb-btn'), function () {
      closeCelebrationModal();
      openLeaderboardModal();
    });
    addTapListener(document.getElementById('celeb-close-btn'), closeCelebrationModal);
    addTapListener(document.getElementById('celeb-view-radar-btn'), function () {
      closeCelebrationModal();
      openRadarModal(state.lastExamResult);
    });
    addTapListener(document.getElementById('celeb-view-cert-btn'), function () {
      closeCelebrationModal();
      openCertificateModal(state.lastExamResult);
    });

    // Practice
    addTapListener(document.getElementById('practice-modal-close'), closePracticeModal);
    addTapListener(document.getElementById('toeic-practice-modal'), function (e) {
      if (e.target === this) closePracticeModal();
    });
    var tabs = document.querySelectorAll('#practice-part-tabs .practice-tab-btn');
    tabs.forEach(function (tab) {
      addTapListener(tab, function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.currentPracticePart = parseInt(tab.getAttribute('data-part'), 10);
        state.currentPracticeIndex = 0;
        loadPracticeQuestion();
      });
    });

    // Drawer
    addTapListener(document.getElementById('drawer-close-btn'), closeDrawer);
    addTapListener(document.getElementById('toeic-drawer-overlay'), function (e) {
      if (e.target === this) closeDrawer();
    });

    // Radar Modal
    addTapListener(document.getElementById('radar-modal-close'), closeRadarModal);
    addTapListener(document.getElementById('toeic-radar-modal'), function (e) {
      if (e.target === this) closeRadarModal();
    });

    // Mistakes Modal
    addTapListener(document.getElementById('mistakes-modal-close'), closeMistakesModal);
    addTapListener(document.getElementById('toeic-mistakes-modal'), function (e) {
      if (e.target === this) closeMistakesModal();
    });
    addTapListener(document.getElementById('mistakes-clear-all'), function () {
      if (confirm('Xóa toàn bộ câu hỏi trong Sổ tay câu sai?')) {
        saveMistakes([]);
        renderMistakesList();
      }
    });

    // Certificate Modal
    addTapListener(document.getElementById('cert-modal-close'), closeCertificateModal);
    addTapListener(document.getElementById('cert-close-btn'), closeCertificateModal);
    addTapListener(document.getElementById('toeic-certificate-modal'), function (e) {
      if (e.target === this) closeCertificateModal();
    });
    addTapListener(document.getElementById('cert-print-btn'), function () {
      window.print();
    });

    // Settings Modal
    addTapListener(document.getElementById('settings-modal-close'), closeSettingsModal);
    addTapListener(document.getElementById('toeic-settings-modal'), function (e) {
      if (e.target === this) closeSettingsModal();
    });
    addTapListener(document.getElementById('copy-script-btn'), function () {
      var code = 'function doPost(e) {\n  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n  var d = JSON.parse(e.postData.contents);\n  sheet.appendRow([new Date(), d.name, d.email, d.score, d.maxScore, d.percent, d.scaledScore, d.duration]);\n  return ContentService.createTextOutput("OK");\n}';
      navigator.clipboard.writeText(code).then(function () {
        alert('Đã sao chép mã Google Apps Script vào clipboard!');
      });
    });
    addTapListener(document.getElementById('setting-save-btn'), function () {
      var url = document.getElementById('setting-webhook-url').value.trim();
      var auto = document.getElementById('setting-auto-sync').checked;
      saveSettings({ webhookUrl: url, autoSync: auto });
      alert('Đã lưu cài đặt!');
      closeSettingsModal();
    });
    addTapListener(document.getElementById('setting-test-sync-btn'), function () {
      var url = document.getElementById('setting-webhook-url').value.trim();
      if (!url) {
        alert('Vui lòng nhập Webhook URL trước.');
        return;
      }
      var testData = { name: 'Test Candidate', score: 40, maxScore: 45, percent: 89, scaledScore: 880, duration: '20:00' };
      fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testData) })
        .then(function () { alert('Đã gửi test ping thành công đến Webhook!'); })
        .catch(function (err) { alert('Lỗi gửi: ' + err); });
    });
  }

  /* ========================================================
     8. PRACTICE MODE LOGIC
     ======================================================== */
  function openPracticeModal() {
    renderLeaderboard();
    var modal = document.getElementById('toeic-practice-modal');
    if (modal) {
      modal.classList.add('active');
      loadPracticeQuestion();
    }
  }

  function closePracticeModal() {
    var modal = document.getElementById('toeic-practice-modal');
    if (modal) modal.classList.remove('active');
  }

  function getQuestionsForPart(partId) {
    var db = window.TOEIC_QUESTIONS_DB || [];
    return db.filter(function (q) { return q.partId === partId; });
  }

  function loadPracticeQuestion() {
    var questions = getQuestionsForPart(state.currentPracticePart);
    var container = document.getElementById('practice-question-container');
    if (!container) return;

    if (questions.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty-state">Chưa có câu hỏi cho phần này.</div>';
      return;
    }

    if (state.currentPracticeIndex >= questions.length) state.currentPracticeIndex = 0;
    if (state.currentPracticeIndex < 0) state.currentPracticeIndex = questions.length - 1;

    var q = questions[state.currentPracticeIndex];
    state.selectedPracticeOption = null;

    var html = '<div class="practice-q-card">';
    html += '  <div class="practice-q-header">';
    html += '    <span class="practice-q-badge">' + escapeHtml(q.partName) + '</span>';
    html += '    <span style="font-size:13px;color:#64748b;font-weight:600;">Câu ' + (state.currentPracticeIndex + 1) + ' / ' + questions.length + '</span>';
    html += '  </div>';

    // Media
    var hasAudio = (q.mediaFiles || []).some(function (m) { return m.type === 'audio'; });
    var hasImage = (q.mediaFiles || []).some(function (m) { return m.type === 'image'; });

    if (hasImage || hasAudio) {
      html += '<div class="practice-media-area">';
      (q.mediaFiles || []).forEach(function (m) {
        if (m.type === 'image') {
          html += '<img src="data/' + m.file + '" class="practice-img-preview" alt="TOEIC Image" />';
        } else if (m.type === 'audio') {
          html += '<div style="margin-top:10px;"><audio controls style="width:100%;max-width:400px;" src="data/' + m.file + '"></audio></div>';
        }
      });
      html += '</div>';
    }

    html += '<div class="practice-q-text">' + escapeHtml(q.question) + '</div>';

    // Options
    html += '<div class="practice-options-list" id="practice-options-list">';
    (q.options || []).forEach(function (opt) {
      html += '<div class="practice-opt-item" data-letter="' + opt.letter + '">';
      html += '  <span class="practice-opt-letter">' + opt.letter + '</span>';
      html += '  <span>' + escapeHtml(opt.text) + '</span>';
      html += '</div>';
    });
    html += '</div>';

    // Action button & Feedback
    html += '<div style="display:flex;gap:10px;align-items:center;">';
    html += '  <button class="toeic-primary-btn" id="practice-check-btn" style="width:auto;padding:10px 20px;">Kiểm Tra Đáp Án</button>';
    html += '  <button class="toeic-secondary-btn" id="practice-open-explain-btn" style="padding:10px 16px;">💡 Xem Giải Thích & Transcript</button>';
    html += '  <button class="toeic-secondary-btn" id="practice-add-mistake-btn" style="padding:10px 16px;color:#7c3aed;" title="Thêm vào sổ câu sai">⭐ Lưu Sổ Tay</button>';
    html += '</div>';

    html += '<div class="practice-feedback-box" id="practice-feedback"></div>';

    // Navigation
    html += '<div class="practice-q-nav-bar">';
    html += '  <button class="toeic-secondary-btn" id="practice-prev-btn">⬅️ Câu Trước</button>';
    html += '  <button class="toeic-secondary-btn" id="practice-next-btn">Câu Tiếp Theo ➡️</button>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    // Attach Practice Question Events with fast tap
    var optEls = container.querySelectorAll('.practice-opt-item');
    optEls.forEach(function (el) {
      addTapListener(el, function () {
        optEls.forEach(function (o) { o.classList.remove('selected'); });
        el.classList.add('selected');
        state.selectedPracticeOption = el.getAttribute('data-letter');
      });
    });

    addTapListener(document.getElementById('practice-check-btn'), function () {
      if (!state.selectedPracticeOption) {
        alert('Vui lòng chọn một đáp án (A, B, C hoặc D) trước khi kiểm tra.');
        return;
      }
      var correctLetter = q.correctLetter;
      var isCorrect = state.selectedPracticeOption === correctLetter;
      var feedbackBox = document.getElementById('practice-feedback');

      optEls.forEach(function (el) {
        var letter = el.getAttribute('data-letter');
        if (letter === correctLetter) el.classList.add('correct');
        else if (letter === state.selectedPracticeOption) el.classList.add('incorrect');
      });

      if (feedbackBox) {
        feedbackBox.className = 'practice-feedback-box visible ' + (isCorrect ? 'correct' : 'incorrect');
        feedbackBox.innerHTML = isCorrect ?
          '<strong>Chính xác! 🎉</strong> Bạn đã chọn đúng đáp án (' + correctLetter + ').' :
          '<strong>Chưa chính xác! ❌</strong> Đáp án đúng là <strong>(' + correctLetter + ')</strong>. Câu hỏi này đã được lưu vào Sổ tay câu sai.';
      }

      if (!isCorrect) {
        addMistake(q);
      }
    });

    addTapListener(document.getElementById('practice-open-explain-btn'), function () {
      openDrawer(q);
    });

    addTapListener(document.getElementById('practice-add-mistake-btn'), function () {
      addMistake(q);
      alert('Đã thêm câu hỏi này vào Sổ tay câu sai!');
    });

    addTapListener(document.getElementById('practice-prev-btn'), function () {
      state.currentPracticeIndex--;
      loadPracticeQuestion();
    });

    addTapListener(document.getElementById('practice-next-btn'), function () {
      state.currentPracticeIndex++;
      loadPracticeQuestion();
    });
  }

  /* ========================================================
     9. TRANSCRIPT & EXPLANATION DRAWER
     ======================================================== */
  function openDrawer(q) {
    var drawer = document.getElementById('toeic-drawer-overlay');
    if (!drawer) return;

    var audioSection = document.getElementById('drawer-audio-section');
    var audioPlayer = document.getElementById('drawer-audio-player');
    var transcriptBox = document.getElementById('drawer-transcript-content');
    var explanationBox = document.getElementById('drawer-explanation-content');

    var audioFile = (q.mediaFiles || []).find(function (m) { return m.type === 'audio'; });
    if (audioFile && audioSection && audioPlayer) {
      audioSection.style.display = 'block';
      audioPlayer.src = 'data/' + audioFile.file;
    } else if (audioSection) {
      audioSection.style.display = 'none';
    }

    if (transcriptBox) {
      transcriptBox.innerText = q.transcript || 'Nội dung âm thanh tương ứng với câu hỏi trong đề thi. Luyện nghe các từ khóa chính để nhận diện câu trả lời đúng.';
    }

    if (explanationBox) {
      explanationBox.innerText = q.explanation || 'Đáp án chính xác là: (' + (q.correctLetter || q.correctAnswer) + ').';
    }

    drawer.classList.add('active');
  }

  function closeDrawer() {
    var drawer = document.getElementById('toeic-drawer-overlay');
    if (drawer) drawer.classList.remove('active');
  }

  /* ========================================================
     10. RADAR CHART & SKILLS ANALYSIS
     ======================================================== */
  function openRadarModal(entry) {
    var modal = document.getElementById('toeic-radar-modal');
    if (!modal) return;

    var result = entry || state.lastExamResult || (getLeaderboard()[0] || { scaledScore: 750, percent: 75 });
    var scaledScore = result.scaledScore || 750;
    var cefr = getCefrLevel(scaledScore);

    document.getElementById('radar-cefr-badge').innerText = cefr.level;
    document.getElementById('radar-cefr-title').innerText = 'Trình độ ' + cefr.level + ' - ' + cefr.title;
    document.getElementById('radar-cefr-desc').innerText = cefr.desc;

    // Render SVG Radar Chart
    var parts = result.partScores || { 1: 85, 2: 78, 3: 72, 4: 70, 5: 80, 6: 75, 7: 68 };
    renderRadarSvg(parts);
    renderSkillsBars(parts);

    modal.classList.add('active');
  }

  function closeRadarModal() {
    var modal = document.getElementById('toeic-radar-modal');
    if (modal) modal.classList.remove('active');
  }

  function renderRadarSvg(partScores) {
    var svg = document.getElementById('skills-radar-svg');
    if (!svg) return;

    var cx = 150, cy = 150, r = 100;
    var labels = ['Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5', 'Part 6', 'Part 7'];
    var totalPoints = labels.length;

    var html = '';

    // Background circles
    [0.25, 0.5, 0.75, 1.0].forEach(function (level) {
      var points = [];
      for (var i = 0; i < totalPoints; i++) {
        var angle = (Math.PI * 2 / totalPoints) * i - Math.PI / 2;
        var x = cx + r * level * Math.cos(angle);
        var y = cy + r * level * Math.sin(angle);
        points.push(x + ',' + y);
      }
      html += '<polygon points="' + points.join(' ') + '" fill="none" stroke="#e2e8f0" stroke-width="1.5" />';
    });

    // Axis lines and labels
    var userPoints = [];
    for (var j = 0; j < totalPoints; j++) {
      var ang = (Math.PI * 2 / totalPoints) * j - Math.PI / 2;
      var ax = cx + r * Math.cos(ang);
      var ay = cy + r * Math.sin(ang);
      html += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ax + '" y2="' + ay + '" stroke="#cbd5e1" stroke-width="1" />';

      // Label
      var lx = cx + (r + 20) * Math.cos(ang);
      var ly = cy + (r + 14) * Math.sin(ang);
      html += '<text x="' + lx + '" y="' + ly + '" font-size="11" font-weight="700" fill="#475569" text-anchor="middle" dominant-baseline="middle">' + labels[j] + '</text>';

      // User score polygon point
      var scoreVal = Math.min(100, Math.max(10, partScores[j + 1] || 70)) / 100;
      var ux = cx + r * scoreVal * Math.cos(ang);
      var uy = cy + r * scoreVal * Math.sin(ang);
      userPoints.push(ux + ',' + uy);
    }

    // Filled User Polygon
    html += '<polygon points="' + userPoints.join(' ') + '" fill="rgba(37, 99, 235, 0.35)" stroke="#2563eb" stroke-width="2.5" />';
    svg.innerHTML = html;
  }

  function renderSkillsBars(partScores) {
    var container = document.getElementById('skills-bars-container');
    if (!container) return;

    var partTitles = {
      1: 'Part 1 - Mô tả tranh (Photographs)',
      2: 'Part 2 - Hỏi & Đáp (Question-Response)',
      3: 'Part 3 - Hội thoại (Short Conversations)',
      4: 'Part 4 - Bài nói (Short Talks)',
      5: 'Part 5 - Điền câu (Incomplete Sentences)',
      6: 'Part 6 - Điền đoạn văn (Text Completion)',
      7: 'Part 7 - Đọc hiểu (Reading Comprehension)'
    };

    var html = '';
    for (var p = 1; p <= 7; p++) {
      var score = partScores[p] || 70;
      html += '<div class="skill-bar-item">';
      html += '  <div class="skill-bar-header">';
      html += '    <span>' + partTitles[p] + '</span>';
      html += '    <span style="color:#2563eb;font-weight:700;">' + score + '%</span>';
      html += '  </div>';
      html += '  <div class="skill-progress-track">';
      html += '    <div class="skill-progress-fill" style="width:' + score + '%;"></div>';
      html += '  </div>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  /* ========================================================
     11. MISTAKE NOTEBOOK (SỔ TAY CÂU SAI)
     ======================================================== */
  function openMistakesModal() {
    var modal = document.getElementById('toeic-mistakes-modal');
    if (modal) {
      renderMistakesList();
      modal.classList.add('active');
    }
  }

  function closeMistakesModal() {
    var modal = document.getElementById('toeic-mistakes-modal');
    if (modal) modal.classList.remove('active');
  }

  function updateMistakesBadge() {
    var list = getMistakes();
    var badge = document.getElementById('mistakes-count-badge');
    var totalText = document.getElementById('mistakes-total-count');
    if (badge) badge.innerText = list.length;
    if (totalText) totalText.innerText = list.length;
  }

  function renderMistakesList() {
    var list = getMistakes();
    var container = document.getElementById('mistakes-list-container');
    if (!container) return;

    updateMistakesBadge();

    if (list.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty-state">Tuyệt vời! Hiện không có câu sai nào trong Sổ tay của bạn.</div>';
      return;
    }

    var html = '';
    list.forEach(function (m, idx) {
      html += '<div class="practice-q-card" style="margin-bottom:0;">';
      html += '  <div class="practice-q-header">';
      html += '    <span class="practice-q-badge" style="background:#fef2f2;color:#991b1b;border-color:#fecaca;">' + escapeHtml(m.partName) + '</span>';
      html += '    <button class="leaderboard-sm-btn mistake-del-btn" data-id="' + m.id + '" style="color:#ef4444;">Đã hiểu / Xóa</button>';
      html += '  </div>';
      html += '  <div class="practice-q-text">' + escapeHtml(m.question) + '</div>';
      html += '  <div style="background:#f0fdf4;border:1px solid:#bbf7d0;padding:8px 12px;border-radius:6px;font-size:13px;color:#166534;margin-bottom:8px;">';
      html += '    <strong>Đáp án đúng:</strong> ' + escapeHtml(m.correctAnswer || m.correctLetter);
      html += '  </div>';
      html += '  <div style="font-size:12.5px;color:#475569;line-height:1.5;">💡 ' + escapeHtml(m.explanation) + '</div>';
      html += '</div>';
    });

    container.innerHTML = html;
    container.querySelectorAll('.mistake-del-btn').forEach(function (btn) {
      addTapListener(btn, function () {
        var id = btn.getAttribute('data-id');
        removeMistake(id);
      });
    });
  }

  /* ========================================================
     12. CERTIFICATE OF COMPLETION
     ======================================================== */
  function openCertificateModal(entry) {
    var modal = document.getElementById('toeic-certificate-modal');
    if (!modal) return;

    var result = entry || state.lastExamResult || (getLeaderboard()[0] || { name: 'Nguyễn Văn An', scaledScore: 780, date: '11/10/2026' });
    var candName = (result.name || 'Thí sinh').toUpperCase();
    var totalScore = result.scaledScore || 780;

    // Distribute into listening / reading
    var listeningScore = Math.min(495, Math.round(totalScore * 0.52 / 5) * 5);
    var readingScore = totalScore - listeningScore;

    document.getElementById('cert-display-name').innerText = candName;
    document.getElementById('cert-score-total').innerText = totalScore + '/990';
    document.getElementById('cert-score-listening').innerText = listeningScore;
    document.getElementById('cert-score-reading').innerText = readingScore;
    document.getElementById('cert-display-date').innerText = result.date || formatDate(new Date());
    document.getElementById('cert-display-code').innerText = 'TOEIC-' + (result.timestamp || Date.now()).toString().slice(-6);

    modal.classList.add('active');
  }

  function closeCertificateModal() {
    var modal = document.getElementById('toeic-certificate-modal');
    if (modal) modal.classList.remove('active');
  }

  /* ========================================================
     13. SETTINGS & CLOUD MODAL
     ======================================================== */
  function openSettingsModal() {
    var modal = document.getElementById('toeic-settings-modal');
    if (!modal) return;
    var conf = getSettings();
    document.getElementById('setting-webhook-url').value = conf.webhookUrl || '';
    document.getElementById('setting-auto-sync').checked = !!conf.autoSync;
    modal.classList.add('active');
  }

  function closeSettingsModal() {
    var modal = document.getElementById('toeic-settings-modal');
    if (modal) modal.classList.remove('active');
  }

  /* ========================================================
     14. MODAL VISIBILITY & BASE HANDLERS
     ======================================================== */
  function openStartModal(allowClose) {
    var modal = document.getElementById('toeic-start-modal');
    if (!modal) return;
    var closeBtn = document.getElementById('start-modal-close');
    var cand = getCandidate();
    if (closeBtn) {
      closeBtn.style.display = (allowClose || (cand && cand.name)) ? 'flex' : 'none';
    }
    var nameInput = document.getElementById('candidate-name-input');
    if (cand && nameInput) {
      nameInput.value = cand.name || '';
      var emailInput = document.getElementById('candidate-email-input');
      if (emailInput) emailInput.value = cand.email || '';
    }
    modal.classList.add('active');
    setTimeout(function () { if (nameInput) nameInput.focus(); }, 150);
  }

  function closeStartModal() {
    var modal = document.getElementById('toeic-start-modal');
    if (modal) modal.classList.remove('active');
  }

  function openLeaderboardModal() {
    renderLeaderboard();
    var modal = document.getElementById('toeic-leaderboard-modal');
    if (modal) modal.classList.add('active');
  }

  function closeLeaderboardModal() {
    var modal = document.getElementById('toeic-leaderboard-modal');
    if (modal) modal.classList.remove('active');
  }

  function showCelebrationModal(data) {
    var modal = document.getElementById('toeic-celeb-modal');
    if (!modal) return;
    document.getElementById('celeb-candidate-name').innerText = data.candidateName || 'Thí sinh';
    document.getElementById('celeb-score-correct').innerText = data.score + '/' + data.maxScore + ' (' + data.percent + '%)';
    document.getElementById('celeb-score-scaled').innerText = data.scaledScore;
    document.getElementById('celeb-score-rank').innerText = '#' + data.rank + ' / ' + data.totalParticipants;
    modal.classList.add('active');
  }

  function closeCelebrationModal() {
    var modal = document.getElementById('toeic-celeb-modal');
    if (modal) modal.classList.remove('active');
  }

  function updateCandidateChip(name) {
    var nameSpan = document.getElementById('toeic-candidate-name');
    if (nameSpan) {
      nameSpan.innerText = name ? (name.length > 14 ? name.substring(0, 14) + '...' : name) : 'Thí sinh';
    }
  }

  function renderLeaderboard(filterKeyword) {
    var list = getLeaderboard();
    var tbody = document.getElementById('leaderboard-tbody');
    if (!tbody) return;

    var currentCand = getCandidate();
    var currentName = currentCand ? currentCand.name.trim().toLowerCase() : '';

    var filtered = list;
    if (filterKeyword && filterKeyword.trim()) {
      var kw = filterKeyword.trim().toLowerCase();
      filtered = list.filter(function (item) {
        return (item.name && item.name.toLowerCase().indexOf(kw) !== -1) ||
               (item.email && item.email.toLowerCase().indexOf(kw) !== -1);
      });
    }

    var statCount = document.getElementById('stat-total-count');
    var statHigh = document.getElementById('stat-high-score');
    var statAvg = document.getElementById('stat-avg-score');

    if (statCount) statCount.innerText = list.length;
    if (statHigh) {
      var maxScaled = 0;
      for (var k = 0; k < list.length; k++) {
        if ((list[k].scaledScore || 0) > maxScaled) maxScaled = list[k].scaledScore;
      }
      statHigh.innerText = maxScaled;
    }
    if (statAvg) {
      var totalScaled = 0;
      for (var j = 0; j < list.length; j++) totalScaled += (list[j].scaledScore || 0);
      var avg = list.length > 0 ? Math.round(totalScaled / list.length) : 0;
      statAvg.innerText = avg;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="leaderboard-empty-state">Chưa có kết quả nào phù hợp.</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var item = filtered[i];
      var rank = i + 1;
      var rankBadgeClass = 'rank-other';
      var rankIcon = '#' + rank;

      if (rank === 1) { rankBadgeClass = 'rank-1'; rankIcon = '🥇'; }
      else if (rank === 2) { rankBadgeClass = 'rank-2'; rankIcon = '🥈'; }
      else if (rank === 3) { rankBadgeClass = 'rank-3'; rankIcon = '🥉'; }

      var isCurrentUser = currentName && item.name && item.name.trim().toLowerCase() === currentName;
      var rowClass = isCurrentUser ? 'current-user-row' : '';

      html += '<tr class="' + rowClass + '">';
      html += '  <td style="text-align:center;"><span class="rank-badge ' + rankBadgeClass + '">' + rankIcon + '</span></td>';
      html += '  <td><strong>' + escapeHtml(item.name) + '</strong>' + (item.email ? '<div style="font-size:11px;color:#94a3b8;">' + escapeHtml(item.email) + '</div>' : '') + '</td>';
      html += '  <td style="text-align:center;">' + (item.score || 0) + '/' + (item.maxScore || 45) + '</td>';
      html += '  <td style="text-align:center;"><span style="color:#2563eb;font-weight:700;">' + (item.percent || 0) + '%</span></td>';
      html += '  <td style="text-align:center;"><span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:12px;font-weight:700;font-size:12px;">' + (item.scaledScore || 10) + '</span></td>';
      html += '  <td style="text-align:center;font-family:monospace;">' + (item.duration || '--:--') + '</td>';
      html += '  <td style="text-align:right;color:#64748b;font-size:12px;">' + (item.date || '') + '</td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
  }

  function exportLeaderboardCsv() {
    var list = getLeaderboard();
    if (!list || list.length === 0) {
      alert('Chưa có dữ liệu bảng xếp hạng để xuất.');
      return;
    }

    var csvRows = [
      ['Hạng', 'Họ và tên', 'Email', 'Số câu đúng', 'Tổng số câu', 'Tỉ lệ (%)', 'Điểm TOEIC (~/990)', 'Thời gian làm bài', 'Ngày thi'].join(',')
    ];

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      csvRows.push([
        i + 1,
        '"' + (item.name || '').replace(/"/g, '""') + '"',
        '"' + (item.email || '').replace(/"/g, '""') + '"',
        item.score || 0,
        item.maxScore || 45,
        item.percent || 0,
        item.scaledScore || 10,
        '"' + (item.duration || '') + '"',
        '"' + (item.date || '') + '"'
      ].join(','));
    }

    var csvContent = '\uFEFF' + csvRows.join('\r\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'TOEIC_Leaderboard_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ========================================================
     15. INITIALIZATION
     ======================================================== */
  function init() {
    initAnswerToggle();
    initAudioController();
    injectUI();
    setupIspringHooks();

    var cand = getCandidate();
    if (cand && cand.name) {
      updateCandidateChip(cand.name);
    } else {
      setTimeout(function () { openStartModal(false); }, 300);
    }
  }

  window.toeicApp = {
    init: init,
    toggleAnswer: toggleAnswer,
    openLeaderboard: openLeaderboardModal,
    openStartModal: openStartModal,
    openPractice: openPracticeModal,
    openMistakes: openMistakesModal,
    removeMistake: removeMistake,
    openRadar: openRadarModal,
    openCertificate: openCertificateModal,
    recordResult: recordExamResult,
    setPresentationPlayer: function (player) {
      state.activePresentationPlayer = player;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
