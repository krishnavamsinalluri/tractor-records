"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  PlayFill,
  PauseFill,
  ArrowRight,
  ArrowLeft,
  CheckCircleFill,
  Whatsapp,
  HouseDoorFill,
  PeopleFill,
  GearFill,
  LockFill,
  EnvelopeFill,
  PersonFill,
  CashCoin,
  Truck,
  Wallet2,
  ChevronRight,
  Check2Circle,
  Soundwave,
} from "react-bootstrap-icons";

type Scene = {
  id: number;
  stepName: string;
  stepNumber: string;
  teluguVoice: string;
  simpleExplanation: string;
  highlightText: string;
  duration: number; // seconds
};

const SCENES: Scene[] = [
  {
    id: 1,
    stepNumber: "స్టెప్ 1",
    stepName: "యాప్‌లోకి వెళ్లడం",
    teluguVoice:
      "అన్నలారా, నమస్కారం! మన ట్రాక్టర్ లెక్కల యాప్‌లోకి వెళ్లడానికి ముందుగా మీ ఈమెయిల్, పాస్‌వర్డ్ నమోదు చేసి, లోపలికి వెళ్లండి. వెంటనే మీ ఖాతా తెరుచుకుంటుంది.",
    simpleExplanation:
      "మీ ఈమెయిల్, పాస్‌వర్డ్ కొట్టి లాగిన్ అవ్వగానే మీ ఖాతా తెరుచుకుంటుంది.",
    highlightText: "ఈమెయిల్: hemasai87@gmail.com తో లాగిన్ అవుతున్నారు",
    duration: 10,
  },
  {
    id: 2,
    stepNumber: "స్టెప్ 2",
    stepName: "రావాల్సిన బాకీ చూడడం",
    teluguVoice:
      "యాప్ తెరిచిన వెంటనే, రైతుల దగ్గర నుంచి మనకు ఎంత డబ్బు రావాలో ఇక్కడే చూడవచ్చు. ఏ రైతు దగ్గర ఎంత బాకీ ఉందో కూడా ఒక్క చూపులోనే తెలుస్తుంది. ఇక పుస్తకంలో లెక్కలు వెతకాల్సిన అవసరం లేదు.",
    simpleExplanation:
      "రైతుల దగ్గర నుంచి ఎంత డబ్బు రావాలో, ఎవరు ఎంత బాకీ ఉన్నారో ఇక్కడే చూసుకోవచ్చు.",
    highlightText: "మొత్తం రావాల్సిన బాకీ ₹32,000 కనిపిస్తోంది",
    duration: 12,
  },
  {
    id: 3,
    stepNumber: "స్టెప్ 3",
    stepName: "కొత్త ట్రాక్టర్ పని నమోదు చేయడం",
    teluguVoice:
      "కొత్తగా చేసిన ట్రాక్టర్ పని లెక్కలో రాయాలంటే, ‘కొత్త పని’ మీద నొక్కండి. తర్వాత రైతు పేరును ఎంచుకోండి. చేసిన పని ఏదో ఎంచుకోండి — కల్టివేటర్ అయినా, రోటావేటర్ అయినా. ఎన్ని ఎకరాలు పని చేశారో నమోదు చేయండి. ముందుగా పెట్టిన రేటు ప్రకారం, మొత్తం ఎంత డబ్బు రావాలో యాప్ వెంటనే లెక్క కడుతుంది.",
    simpleExplanation:
      "రైతు పేరు, పని రకం, ఎకరాలు నమోదు చేయగానే మొత్తం బిల్లు ఆటోమేటిక్‌గా లెక్క కడుతుంది.",
    highlightText: "కొత్త పని: 2 ఎకరాలు × ₹1,000 = ₹2,000 సేవ్ చేయబడింది",
    duration: 16,
  },
  {
    id: 4,
    stepNumber: "స్టెప్ 4",
    stepName: "రైతుకు పని లెక్క పంపడం",
    teluguVoice:
      "పని లెక్క పూర్తయ్యాక, ఆ రైతు పేరుపై నొక్కండి. తర్వాత ‘వాట్సాప్’ మీద నొక్కితే చాలు. ఏ పని చేశారు, ఎన్ని ఎకరాలు చేశారు, మొత్తం ఎంత డబ్బు అయింది, ఇంకా ఎంత బాకీ ఉందో అన్నీ ఒక చక్కటి లెక్కలా రైతు ఫోన్‌కి పంపించవచ్చు. మీ ఫోన్‌పే నంబర్ కూడా అందులో ఉంటుంది. రైతుకు కూడా లెక్క స్పష్టంగా తెలుస్తుంది.",
    simpleExplanation:
      "రైతు వాట్సాప్‌కి పని వివరాలు, బాకీ మరియు మీ ఫోన్‌పే నంబర్‌తో కూడిన లెక్క రసీదు వెళ్తుంది.",
    highlightText: "అన్నయ్య గారి వాట్సాప్‌కి రసీదు పంపబడింది",
    duration: 17,
  },
  {
    id: 5,
    stepNumber: "స్టెప్ 5",
    stepName: "రైతు ఇచ్చిన డబ్బు లెక్కలో జమ చేయడం",
    teluguVoice:
      "రైతు డబ్బులు ఇచ్చిన వెంటనే, ఆ డబ్బును యాప్‌లో జమ చేయండి. ఇచ్చిన డబ్బు లెక్కలో చేరిపోతుంది. బాకీ మొత్తం కట్టేస్తే, ఆ రైతు పేరు దగ్గర బాకీ సున్నా అని కనిపిస్తుంది. ఇలా ప్రతి రైతు లెక్కను ఎప్పటికప్పుడు సులభంగా చూసుకోవచ్చు. పుస్తకంలో రాసుకున్న లెక్కలు మర్చిపోయే భయం లేదు. మన ట్రాక్టర్ పనుల లెక్కలన్నీ యాప్‌లోనే భద్రంగా ఉంటాయి.",
    simpleExplanation:
      "రైతు ఇచ్చిన డబ్బు జమ చేయగానే బాకీ సున్నా అవుతుంది. లెక్కలన్నీ భద్రంగా ఉంటాయి.",
    highlightText: "₹20,000 జమ చేసి బాకీ ₹0 క్లియర్ అయింది",
    duration: 19,
  },
];

export default function SimpleDemoPage() {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [simulatedTypingProgress, setSimulatedTypingProgress] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const nextSceneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const scene = SCENES[currentSceneIndex];
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const handleNext = () => {
    if (nextSceneTimeoutRef.current) clearTimeout(nextSceneTimeoutRef.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setProgress(0);
    setCurrentSceneIndex((prev) => (prev + 1) % SCENES.length);
  };

  const handlePrev = () => {
    if (nextSceneTimeoutRef.current) clearTimeout(nextSceneTimeoutRef.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setProgress(0);
    setCurrentSceneIndex((prev) => (prev - 1 + SCENES.length) % SCENES.length);
  };

  // Natural Telugu voice speaking with guaranteed completion & automatic start
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (nextSceneTimeoutRef.current) {
        clearTimeout(nextSceneTimeoutRef.current);
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "te-IN";
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const teluguVoice =
        voices.find((v) => v.lang === "te-IN" || v.lang === "te_IN" || v.lang.startsWith("te")) ||
        voices.find((v) => v.name.toLowerCase().includes("telugu")) ||
        voices.find((v) => v.lang === "en-IN" && (v.name.includes("India") || v.name.includes("Natural"))) ||
        voices.find((v) => v.lang.startsWith("hi")) ||
        voices[0];

      if (teluguVoice) utterance.voice = teluguVoice;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setAudioUnlocked(true);
      };

      // When the audio completely finishes speaking without any cutoff:
      utterance.onend = () => {
        setIsSpeaking(false);
        if (isPlayingRef.current) {
          // Pause for 2 seconds so the completed action can be seen clearly
          nextSceneTimeoutRef.current = setTimeout(() => {
            handleNext();
          }, 2000);
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        if (isPlayingRef.current) {
          nextSceneTimeoutRef.current = setTimeout(() => {
            handleNext();
          }, 3000);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  // Preload voices & automatic browser audio autoplay unlock
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Load voices
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
      if (isPlayingRef.current && !window.speechSynthesis.speaking) {
        speakText(sceneRef.current.teluguVoice);
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

    // Universal audio unblocker for mobile and desktop browsers
    const autoUnlockAndPlay = () => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        // Try audio context silent unlock
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume();
          }
        }
        setAudioUnlocked(true);
        if (isPlayingRef.current && !window.speechSynthesis.speaking) {
          speakText(sceneRef.current.teluguVoice);
        }
      } catch (e) { }
    };

    // Listen to every possible user event on the window to unlock speech immediately
    const eventTypes = ["pointerdown", "touchstart", "touchend", "click", "keydown", "scroll", "mousemove"];
    eventTypes.forEach((evt) => {
      window.addEventListener(evt, autoUnlockAndPlay, { passive: true, once: true });
    });

    // Immediate attempt on load
    const timer1 = setTimeout(() => {
      if (isPlayingRef.current) {
        speakText(sceneRef.current.teluguVoice);
      }
    }, 150);

    const timer2 = setTimeout(() => {
      if (isPlayingRef.current && !window.speechSynthesis.speaking) {
        speakText(sceneRef.current.teluguVoice);
      }
    }, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (nextSceneTimeoutRef.current) clearTimeout(nextSceneTimeoutRef.current);
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      eventTypes.forEach((evt) => {
        window.removeEventListener(evt, autoUnlockAndPlay);
      });
    };
  }, []);

  // Trigger speech on scene change automatically
  useEffect(() => {
    setSimulatedTypingProgress(0);
    setProgress(0);
    if (isPlaying) {
      const timeout = setTimeout(() => {
        speakText(scene.teluguVoice);
      }, 200);
      return () => clearTimeout(timeout);
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
    }
  }, [currentSceneIndex, isPlaying]);

  // SpeechSynthesis auto-resume watchdog for mobile/background browsers
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 800);
    return () => clearInterval(watchdog);
  }, []);

  // Progress Bar & Visual Typing Animation
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextSceneTimeoutRef.current) clearTimeout(nextSceneTimeoutRef.current);
      return;
    }

    const intervalTime = 50;
    // Base duration for visual animations
    const animationDuration = (scene.duration + 2) * 1000;
    const totalSteps = animationDuration / intervalTime;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        // If voice is speaking, cap progress smoothly at 92% until voice ends
        if (isSpeaking && prev >= 92) {
          return 92;
        }
        if (prev >= 100) {
          return 100;
        }
        return Math.min(100, prev + 100 / totalSteps);
      });

      // Typing animation completes in first 40% of the scene
      setSimulatedTypingProgress((t) => Math.min(100, t + 100 / (totalSteps * 0.4)));
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentSceneIndex, isSpeaking, scene.duration]);

  return (
    <div className="farmer-demo-root">
      {/* Top Simple Green Header */}
      <header className="farmer-top-header">
        <div className="header-inner">
          <div className="header-brand">
            <Image src="/images/logo.png" alt="Logo" width={40} height={40} />
            <div>
              <h1>ట్రాక్టర్ లెక్కలు — వీడియో డెమో</h1>
              <p>యాప్ ఎలా వాడాలో సులువైన వీడియో</p>
            </div>
          </div>

          <div className="header-actions">
            <Link href="/" className="open-app-btn">
              🚜 యాప్ ఓపెన్ చేయండి →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="farmer-main-content">
        <div className="demo-showcase-layout">
          {/* Left: Big Phone Screen Display */}
          <div className="phone-display-wrapper">
            <div className="phone-mockup-frame">
              {/* Dynamic Island Notch */}
              <div className="phone-top-notch">
                <span className="camera-circle" />
              </div>

              {/* Action Banner On Phone */}
              <div className="phone-action-pill">
                <span className="green-pulse-dot" />
                <span>{scene.highlightText}</span>
              </div>

              {/* Real App Screen Body */}
              <div className="phone-screen-content">
                {/* ---------------- SCENE 1: LOGIN SCREEN ---------------- */}
                {scene.id === 1 && (
                  <div className="app-screen-layer animate-fade">
                    <div className="login-bg-photo">
                      <Image
                        src="/images/dashboard-banner.png"
                        alt="Tractor Banner"
                        fill
                        priority
                        style={{ objectFit: "cover", objectPosition: "center 28%" }}
                      />
                      <div className="login-dark-dim" />
                    </div>

                    <div className="login-front-card-wrap">
                      <div className="login-app-title-box">
                        <div className="logo-round-shadow">
                          <Image src="/images/logo.png" alt="Logo" width={56} height={56} priority />
                        </div>
                        <h2>ట్రాక్టర్ లెక్కలు</h2>
                        <p>మీ ట్రాక్టర్ పనుల లెక్కలు ఇక మొబైల్ లోనే</p>
                      </div>

                      <div className="login-white-card">
                        <div className="card-tag-row">
                          <span className="telugu-lang-tag">తెలుగు</span>
                        </div>

                        <div className="login-mode-tabs">
                          <div className="tab-pill active">లాగిన్ చేయండి</div>
                          <div className="tab-pill">ఖాతా తెరవండి</div>
                        </div>

                        <h3 className="card-welcome-title">తిరిగి స్వాగతం!</h3>
                        <p className="card-welcome-sub">లాగిన్ చేయడానికి వివరాలు నమోదు చేయండి</p>

                        <div className="form-input-group">
                          <label>ఈమెయిల్ (Email)</label>
                          <div className="input-box-row">
                            <EnvelopeFill color="#15803d" size={16} />
                            <span className="text-typed">
                              {simulatedTypingProgress > 5
                                ? "hemasai87@gmail.com".slice(
                                  0,
                                  Math.floor((simulatedTypingProgress / 100) * 20)
                                )
                                : ""}
                              <span className="blinking-bar">|</span>
                            </span>
                          </div>
                        </div>

                        <div className="form-input-group">
                          <label>పాస్‌వర్డ్ (Password)</label>
                          <div className="input-box-row">
                            <LockFill color="#15803d" size={16} />
                            <span className="text-typed">
                              {simulatedTypingProgress > 35
                                ? "••••••••".slice(
                                  0,
                                  Math.floor(((simulatedTypingProgress - 35) / 50) * 8)
                                )
                                : ""}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`login-green-submit-btn ${simulatedTypingProgress > 70 ? "pressed" : ""
                            }`}
                        >
                          <span>
                            {simulatedTypingProgress > 85
                              ? "లాగిన్ అవుతోంది..."
                              : "లాగిన్ చేయండి →"}
                          </span>
                        </button>

                        {simulatedTypingProgress > 70 && simulatedTypingProgress < 85 && (
                          <div className="touch-click-circle login-tap" />
                        )}

                        {simulatedTypingProgress >= 85 && (
                          <div className="login-success-banner animate-pop">
                            <Check2Circle size={18} color="#15803d" />
                            <span>లాగిన్ విజయవంతమైంది!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- SCENE 2: DASHBOARD SCREEN ---------------- */}
                {scene.id === 2 && (
                  <div className="app-screen-layer animate-fade bg-gray">
                    <div className="top-green-appbar">
                      <div className="appbar-brand">
                        <Image src="/images/logo.png" alt="Logo" width={32} height={32} />
                        <div>
                          <strong>ట్రాక్టర్ లెక్కలు</strong>
                          <small>నమస్కారం, కృష్ణ వంశీ 👋</small>
                        </div>
                      </div>
                      <span className="appbar-badge">తెలుగు</span>
                    </div>

                    <div className="app-scroll-body">
                      <div className="total-due-card">
                        <div className="due-coin-bubble">
                          <CashCoin size={26} />
                        </div>
                        <div>
                          <span className="due-heading">మొత్తం రావాల్సిన బాకీ</span>
                          <strong className="due-price">₹32,000</strong>
                        </div>
                      </div>

                      <div className="two-stats-grid">
                        <div className="stat-box blue">
                          <Truck size={18} />
                          <div>
                            <small>మొత్తం పని</small>
                            <strong>₹52,000</strong>
                          </div>
                        </div>
                        <div className="stat-box green">
                          <Wallet2 size={18} />
                          <div>
                            <small>వచ్చిన డబ్బు</small>
                            <strong>₹20,000</strong>
                          </div>
                        </div>
                      </div>

                      <div className="big-green-action-btn">
                        <span>+ కొత్త పని నమోదు చేయండి</span>
                        {simulatedTypingProgress > 60 && (
                          <div className="touch-click-circle add-btn-tap" />
                        )}
                      </div>

                      <div className="list-title-row">
                        <h4>బాకీ ఉన్న రైతులు</h4>
                        <span className="see-all">అందరూ &gt;</span>
                      </div>

                      <div className="farmer-due-item">
                        <div className="farmer-avatar-letter">A</div>
                        <div className="farmer-info">
                          <strong>అన్నయ్య</strong>
                          <small>3 పనులు • 9876543210</small>
                        </div>
                        <div className="farmer-due-amt">
                          <span>₹30,000</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>

                      <div className="farmer-due-item">
                        <div className="farmer-avatar-letter green">R</div>
                        <div className="farmer-info">
                          <strong>రమేష్</strong>
                          <small>1 పని • 9573660370</small>
                        </div>
                        <div className="farmer-due-amt">
                          <span>₹2,000</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>

                    <div className="bottom-dock-nav">
                      <div className="dock-tab active">
                        <HouseDoorFill size={18} />
                        <span>హోమ్</span>
                      </div>
                      <div className="dock-tab">
                        <PeopleFill size={18} />
                        <span>రైతులు</span>
                      </div>
                      <div className="dock-tab">
                        <GearFill size={18} />
                        <span>సెట్టింగ్స్</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- SCENE 3: ADD WORK ---------------- */}
                {scene.id === 3 && (
                  <div className="app-screen-layer animate-fade bg-gray">
                    <div className="top-white-nav">
                      <span className="back-icon">←</span>
                      <strong>కొత్త పని నమోదు చేయండి</strong>
                    </div>

                    <div className="app-scroll-body">
                      <div className="form-inner-card">
                        <label className="input-title">1. రైతు పేరు</label>
                        <div className="selected-farmer-field">
                          <PersonFill color="#15803d" size={18} />
                          <span>రమేష్ (9573660370)</span>
                        </div>

                        <label className="input-title mt-12">2. పని రకం (పరికరాలు)</label>
                        <div className="equipment-tiles-row">
                          <div className="equip-tile selected">
                            <span className="equip-icon">🌱</span>
                            <strong>కల్టివేటర్</strong>
                            <small>₹1,000 / ఎకరం</small>
                            <span className="selected-tick">
                              <CheckCircleFill size={15} color="#15803d" />
                            </span>
                          </div>

                          <div className="equip-tile">
                            <span className="equip-icon">⚙️</span>
                            <strong>రోటావేటర్</strong>
                            <small>₹1,500 / ఎకరం</small>
                          </div>
                        </div>

                        <label className="input-title mt-12">3. ఎకరాలు & ఎకరానికి రేటు</label>
                        <div className="two-fields-row">
                          <div className="field-block">
                            <small>ఎకరాలు</small>
                            <div className="val-box">2.0 ఎకరాలు</div>
                          </div>
                          <div className="field-block">
                            <small>ఎకరానికి రేటు</small>
                            <div className="val-box">₹1,000</div>
                          </div>
                        </div>

                        <div className="auto-total-banner">
                          <span>మొత్తం పని విలువ:</span>
                          <strong>₹2,000</strong>
                        </div>

                        <button type="button" className="save-work-green-btn">
                          <span>పని సేవ్ చేయండి</span>
                          {simulatedTypingProgress > 65 && (
                            <div className="touch-click-circle save-work-tap" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- SCENE 4: WHATSAPP RECEIPT ---------------- */}
                {scene.id === 4 && (
                  <div className="app-screen-layer animate-fade bg-gray">
                    <div className="top-white-nav">
                      <span className="back-icon">←</span>
                      <strong>రైతు ఖాతా & రసీదు</strong>
                    </div>

                    <div className="app-scroll-body">
                      <div className="customer-header-box">
                        <div className="cust-big-badge">A</div>
                        <div>
                          <h3>అన్నయ్య</h3>
                          <p>📱 9876543210</p>
                        </div>
                      </div>

                      <div className="total-due-card">
                        <div className="due-coin-bubble">
                          <CashCoin size={24} />
                        </div>
                        <div>
                          <span className="due-heading">రావాల్సిన బాకీ</span>
                          <strong className="due-price">₹20,000</strong>
                        </div>
                      </div>

                      <div className="whatsapp-green-send-btn">
                        <Whatsapp size={20} />
                        <span>WhatsApp లో రసీదు పంపండి</span>
                        {simulatedTypingProgress > 50 && (
                          <div className="touch-click-circle whatsapp-btn-tap" />
                        )}
                      </div>

                      {simulatedTypingProgress > 55 && (
                        <div className="whatsapp-bubble-preview animate-pop">
                          <div className="bubble-top">
                            <Whatsapp size={16} color="#25d366" />
                            <span>రైతుకు వెళ్లే రసీదు మెసేజ్:</span>
                          </div>
                          <div className="bubble-text">
                            <p>🚜 <b>ట్రాక్టర్ లెక్కల రసీదు</b></p>
                            <p>రైతు: <b>అన్నయ్య</b></p>
                            <p>పని: <b>కల్టివేటర్ (2 ఎకరాలు = ₹2,000)</b></p>
                            <p className="red-due">చెల్లించాల్సిన బాకీ: <b>₹20,000</b></p>
                            <p className="gpay-green">PhonePe / GPay: <b>9573660370</b></p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ---------------- SCENE 5: PAYMENT ZERO ---------------- */}
                {scene.id === 5 && (
                  <div className="app-screen-layer animate-fade bg-gray">
                    <div className="top-white-nav">
                      <span className="back-icon">←</span>
                      <strong>డబ్బు జమ చేయండి</strong>
                    </div>

                    <div className="app-scroll-body">
                      <div className="customer-header-box">
                        <div className="cust-big-badge">A</div>
                        <div>
                          <h3>అన్నయ్య</h3>
                          <p>ప్రస్తుత బాకీ: <b style={{ color: "#dc2626" }}>₹20,000</b></p>
                        </div>
                      </div>

                      <div className="form-inner-card">
                        <label className="input-title">రైతు ఇచ్చిన డబ్బు (Amount)</label>
                        <div className="amount-highlight-box">
                          <span className="currency-mark">₹</span>
                          <strong className="entered-amount">20,000</strong>
                        </div>

                        <label className="input-title mt-12">చెల్లింపు విధానం</label>
                        <div className="payment-type-pill">నగదు (Cash) / PhonePe</div>

                        <div className="zero-cleared-banner">
                          <span>మిగిలిన బాకీ:</span>
                          <strong>₹0 (బాకీ తీరిపోయింది! ✅)</strong>
                        </div>

                        <button type="button" className="save-work-green-btn">
                          <span>డబ్బు జమ చేయండి</span>
                          {simulatedTypingProgress > 65 && (
                            <div className="touch-click-circle payment-submit-tap" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Farmer Friendly Explanation & Playback */}
          <div className="farmer-control-card">
            <div className="card-badge-row">
              <span className="step-tag-pill">{scene.stepNumber} (5 లో {scene.id}వ స్టెప్)</span>
              {isSpeaking && (
                <span className="speaking-tag animate-pulse">
                  <Soundwave size={16} /> వాయిస్ నడుస్తోంది...
                </span>
              )}
            </div>

            {/* Visual Step Progress Bar */}
            <div className="step-line-progress-bar">
              <div className="step-line-fill" style={{ width: `${progress}%` }} />
            </div>

            <h2 className="step-big-title">{scene.stepName}</h2>

            {/* Simple Telugu Voice Narration */}
            <div className="telugu-voice-explanation-box">
              <div className="box-top-title">
                <span>🎙️ వాయిస్ సమాచారం (Voice Explanation):</span>
                <button
                  type="button"
                  className="replay-voice-btn"
                  onClick={() => speakText(scene.teluguVoice)}
                >
                  🔊 మళ్లీ వినండి
                </button>
              </div>
              <p className="voice-text-telugu">{scene.teluguVoice}</p>
            </div>

            {/* Easy Summary Card */}
            <div className="simple-summary-card">
              <h4>💡 సులువైన వివరణ:</h4>
              <p>{scene.simpleExplanation}</p>
            </div>

            {/* Play, Pause, Next, Prev Controls */}
            <div className="video-player-buttons-row">
              <button
                type="button"
                className="btn-prev-step"
                onClick={handlePrev}
                title="మునుపటి స్టెప్"
              >
                <ArrowLeft size={20} />
                <span>మునుపటి స్టెప్</span>
              </button>

              <button
                type="button"
                className="btn-main-play-pause"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <PauseFill size={26} /> : <PlayFill size={26} />}
                <span>{isPlaying ? "వీడియో ఆపండి (Pause)" : "వీడియో ప్లే చేయండి (Play)"}</span>
              </button>

              <button
                type="button"
                className="btn-next-step"
                onClick={handleNext}
                title="తర్వాతి స్టెప్"
              >
                <span>తర్వాతి స్టెప్</span>
                <ArrowRight size={20} />
              </button>
            </div>

            {/* 1-Click WhatsApp Share */}
            <div className="share-whatsapp-cta-box">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  "🚜 *ట్రాక్టర్ లెక్కలు (Tractor Records)* - మీ ట్రాక్టర్ పనుల లెక్కలు, ఎకరాల లెక్క, బాకీలు, వాట్సాప్ రసీదుల కోసం సరికొత్త యాప్!\n\nపూర్తి వీడియో మరియు డెమో చూడటానికి ఇక్కడ క్లిక్ చేయండి:\nhttps://tractor-records-xi.vercel.app/demo\n\nయాప్ లాగిన్ వివరాలు:\nఈమెయిల్: hemasai87@gmail.com\nపాస్‌వర్డ్: Sai@123"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-share-btn-large"
              >
                <Whatsapp size={22} />
                <span>📲 WhatsApp లో ఈ డెమో షేర్ చేయండి</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .farmer-demo-root {
          min-height: 100vh;
          background: #f1f5f9;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* Top Simple Header */
        .farmer-top-header {
          background: #15803d;
          color: #ffffff;
          padding: 12px 20px;
          box-shadow: 0 4px 12px rgba(21, 128, 61, 0.2);
        }

        .header-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-brand h1 {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
        }

        .header-brand p {
          font-size: 12px;
          margin: 2px 0 0;
          opacity: 0.9;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .open-app-btn {
          background: linear-gradient(135deg, #fef08a 0%, #facc15 50%, #eab308 100%);
          color: #14532d;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          padding: 10px 22px;
          border-radius: 12px;
          border: 1.5px solid #ffffff;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25), 0 0 15px rgba(250, 204, 21, 0.4);
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          letter-spacing: 0.2px;
        }

        .open-app-btn:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3), 0 0 22px rgba(250, 204, 21, 0.6);
          background: linear-gradient(135deg, #ffffff 0%, #fde047 60%, #eab308 100%);
        }

        /* Main Content */
        .farmer-main-content {
          flex: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px 16px;
          width: 100%;
        }

        /* Showcase Grid */
        .demo-showcase-layout {
          display: grid;
          grid-template-columns: 390px 1fr;
          gap: 32px;
          align-items: flex-start;
        }

        @media (max-width: 900px) {
          .demo-showcase-layout {
            grid-template-columns: 1fr;
          }
        }

        /* Phone Mockup */
        .phone-display-wrapper {
          display: flex;
          justify-content: center;
        }

        .phone-mockup-frame {
          width: 380px;
          height: 720px;
          background: #ffffff;
          border: 12px solid #1e293b;
          border-radius: 44px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .phone-top-notch {
          width: 120px;
          height: 22px;
          background: #1e293b;
          border-radius: 0 0 14px 14px;
          margin: 0 auto;
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .camera-circle {
          width: 8px;
          height: 8px;
          background: #0f172a;
          border-radius: 50%;
        }

        .phone-action-pill {
          position: absolute;
          top: 30px;
          left: 14px;
          right: 14px;
          background: rgba(15, 23, 42, 0.9);
          color: #f8fafc;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          z-index: 40;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
        }

        .green-pulse-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 8px #22c55e;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        .phone-screen-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          background: #f8fafc;
          padding-top: 32px;
          overflow: hidden;
        }

        .app-screen-layer {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .app-screen-layer.bg-gray {
          background: #f8fafc;
        }

        .animate-fade {
          animation: fadeIn 0.35s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ---------------- SCENE 1 LOGIN STYLES ---------------- */
        .login-bg-photo {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .login-dark-dim {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.75) 100%);
        }

        .login-front-card-wrap {
          position: relative;
          z-index: 5;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 16px;
          gap: 10px;
        }

        .login-app-title-box {
          text-align: center;
          color: #ffffff;
        }

        .logo-round-shadow {
          width: 58px;
          height: 58px;
          margin: 0 auto 4px;
          background: #ffffff;
          border-radius: 50%;
          padding: 2px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
        }

        .login-app-title-box h2 {
          font-size: 20px;
          font-weight: 900;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
        }

        .login-app-title-box p {
          font-size: 11px;
          margin: 2px 0 0;
          opacity: 0.9;
        }

        .login-white-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        .card-tag-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 4px;
        }

        .telugu-lang-tag {
          background: #f0fdf4;
          color: #15803d;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid #bbf7d0;
        }

        .login-mode-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .tab-pill {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          padding: 5px;
          border-radius: 6px;
          color: #64748b;
        }

        .tab-pill.active {
          background: #ffffff;
          color: #15803d;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
        }

        .card-welcome-title {
          font-size: 16px;
          font-weight: 800;
          color: #075b32;
          margin: 0;
        }

        .card-welcome-sub {
          font-size: 11px;
          color: #64748b;
          margin: 2px 0 8px;
        }

        .form-input-group {
          margin-bottom: 6px;
        }

        .form-input-group label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          display: block;
          margin-bottom: 2px;
        }

        .input-box-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .text-typed {
          flex: 1;
        }

        .blinking-bar {
          color: #15803d;
          animation: blink 0.8s infinite;
        }

        .login-green-submit-btn {
          width: 100%;
          background: #15803d;
          color: #ffffff;
          border: none;
          padding: 10px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 14px;
          margin-top: 8px;
          box-shadow: 0 4px 10px rgba(21, 128, 61, 0.3);
        }

        .login-green-submit-btn.pressed {
          background: #166534;
          transform: scale(0.97);
        }

        .login-success-banner {
          margin-top: 8px;
          background: #dcfce7;
          border: 1px solid #86efac;
          color: #166534;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 8px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ---------------- SCENE 2 DASHBOARD ---------------- */
        .top-green-appbar {
          background: #15803d;
          color: #ffffff;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .appbar-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .appbar-brand strong {
          font-size: 13px;
          display: block;
        }

        .appbar-brand small {
          font-size: 11px;
          opacity: 0.9;
        }

        .appbar-badge {
          background: rgba(255, 255, 255, 0.2);
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 700;
        }

        .app-scroll-body {
          flex: 1;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
        }

        .total-due-card {
          background: #fee2e2;
          border: 1px solid #fecaca;
          border-radius: 14px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .due-coin-bubble {
          width: 42px;
          height: 42px;
          background: #fef3c7;
          color: #d97706;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .due-heading {
          font-size: 12px;
          font-weight: 700;
          color: #991b1b;
          display: block;
        }

        .due-price {
          font-size: 22px;
          font-weight: 900;
          color: #7f1d1d;
        }

        .two-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .stat-box {
          border-radius: 10px;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-box.blue {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
        }

        .stat-box.green {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }

        .stat-box small {
          font-size: 10px;
          display: block;
          color: #64748b;
        }

        .stat-box strong {
          font-size: 14px;
          font-weight: 800;
        }

        .big-green-action-btn {
          background: #15803d;
          color: #ffffff;
          padding: 12px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          text-align: center;
          position: relative;
          box-shadow: 0 4px 10px rgba(21, 128, 61, 0.25);
        }

        .list-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .list-title-row h4 {
          margin: 0;
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        .see-all {
          font-size: 11px;
          color: #15803d;
          font-weight: 700;
        }

        .farmer-due-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .farmer-avatar-letter {
          width: 36px;
          height: 36px;
          background: #dbeafe;
          color: #1d4ed8;
          font-weight: 800;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .farmer-avatar-letter.green {
          background: #dcfce7;
          color: #15803d;
        }

        .farmer-info {
          flex: 1;
        }

        .farmer-info strong {
          font-size: 13px;
          display: block;
        }

        .farmer-info small {
          font-size: 10px;
          color: #64748b;
        }

        .farmer-due-amt {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #b91c1c;
          font-weight: 800;
          font-size: 14px;
        }

        .bottom-dock-nav {
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 6px 0;
        }

        .dock-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
        }

        .dock-tab.active {
          color: #15803d;
        }

        /* ---------------- SCENE 3 WORK FORM ---------------- */
        .top-white-nav {
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          color: #1e293b;
        }

        .back-icon {
          font-size: 16px;
        }

        .form-inner-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
        }

        .input-title {
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          display: block;
          margin-bottom: 4px;
        }

        .input-title.mt-12 {
          margin-top: 10px;
        }

        .selected-farmer-field {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f0fdf4;
          border: 1.5px solid #86efac;
          border-radius: 8px;
          padding: 8px 10px;
          font-weight: 700;
          font-size: 12px;
          color: #166534;
        }

        .equipment-tiles-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .equip-tile {
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
        }

        .equip-tile.selected {
          border-color: #15803d;
          background: #f0fdf4;
        }

        .equip-icon {
          font-size: 20px;
        }

        .equip-tile strong {
          font-size: 12px;
        }

        .equip-tile small {
          font-size: 10px;
          color: #64748b;
        }

        .selected-tick {
          position: absolute;
          top: 4px;
          right: 4px;
        }

        .two-fields-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .field-block small {
          font-size: 10px;
          color: #64748b;
          display: block;
          margin-bottom: 2px;
        }

        .val-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px;
          font-weight: 800;
          font-size: 12px;
        }

        .auto-total-banner {
          margin-top: 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          color: #1e3a8a;
        }

        .auto-total-banner strong {
          font-size: 18px;
          color: #1d4ed8;
          font-weight: 900;
        }

        .save-work-green-btn {
          width: 100%;
          background: #15803d;
          color: #ffffff;
          border: none;
          padding: 10px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          margin-top: 10px;
          position: relative;
        }

        /* ---------------- SCENE 4 WHATSAPP ---------------- */
        .customer-header-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          border-radius: 10px;
        }

        .cust-big-badge {
          width: 40px;
          height: 40px;
          background: #dbeafe;
          color: #1d4ed8;
          font-weight: 900;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .customer-header-box h3 {
          margin: 0;
          font-size: 14px;
        }

        .customer-header-box p {
          margin: 2px 0 0;
          font-size: 11px;
          color: #64748b;
        }

        .whatsapp-green-send-btn {
          background: #25d366;
          color: #ffffff;
          padding: 12px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
        }

        .whatsapp-bubble-preview {
          background: #ffffff;
          border: 2px solid #25d366;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.15);
        }

        .bubble-top {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #166534;
          margin-bottom: 6px;
        }

        .bubble-text p {
          margin: 3px 0;
          font-size: 11px;
        }

        .red-due {
          color: #dc2626;
          font-weight: 800;
          font-size: 12px;
        }

        .gpay-green {
          color: #15803d;
          font-weight: 700;
        }

        /* ---------------- SCENE 5 PAYMENT ---------------- */
        .amount-highlight-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 2px solid #15803d;
          border-radius: 8px;
          padding: 8px 10px;
        }

        .currency-mark {
          font-size: 16px;
          font-weight: 800;
          color: #15803d;
        }

        .entered-amount {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
        }

        .payment-type-pill {
          background: #f0fdf4;
          border: 1px solid #86efac;
          color: #15803d;
          padding: 6px 10px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 12px;
        }

        .zero-cleared-banner {
          margin-top: 10px;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          color: #14532d;
        }

        .zero-cleared-banner strong {
          font-size: 14px;
          color: #15803d;
          font-weight: 900;
        }

        /* Touch pointer ripples */
        .touch-click-circle {
          position: absolute;
          width: 32px;
          height: 32px;
          background: rgba(34, 197, 94, 0.4);
          border: 2px solid #22c55e;
          border-radius: 50%;
          pointer-events: none;
          animation: rippleTap 1s infinite;
        }

        .login-tap {
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
        }

        .add-btn-tap {
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
        }

        .save-work-tap {
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
        }

        .whatsapp-btn-tap {
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
        }

        .payment-submit-tap {
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
        }

        @keyframes rippleTap {
          0% { transform: translateX(-50%) scale(0.8); opacity: 1; }
          100% { transform: translateX(-50%) scale(1.6); opacity: 0; }
        }

        /* ---------------- RIGHT CONTROL PANEL ---------------- */
        .farmer-control-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        }

        .card-badge-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .step-tag-pill {
          background: #dcfce7;
          color: #15803d;
          font-size: 12px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 20px;
        }

        .step-line-progress-bar {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .step-line-fill {
          height: 100%;
          background: #22c55e;
          border-radius: 10px;
          transition: width 0.05s linear;
        }

        .speaking-tag {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .step-big-title {
          font-size: 24px;
          font-weight: 900;
          color: #1e293b;
          margin: 0;
        }

        .telugu-voice-explanation-box {
          background: #f0fdf4;
          border: 1.5px solid #86efac;
          border-radius: 14px;
          padding: 16px;
        }

        .box-top-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 800;
          color: #166534;
          margin-bottom: 8px;
        }

        .replay-voice-btn {
          background: #15803d;
          color: #ffffff;
          border: none;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .voice-text-telugu {
          margin: 0;
          font-size: 16px;
          line-height: 1.6;
          color: #0f172a;
          font-weight: 600;
        }

        .simple-summary-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
        }

        .simple-summary-card h4 {
          margin: 0 0 4px;
          font-size: 13px;
          color: #334155;
          font-weight: 800;
        }

        .simple-summary-card p {
          margin: 0;
          font-size: 14px;
          color: #475569;
          line-height: 1.5;
        }

        /* Player buttons */
        .video-player-buttons-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
        }

        .btn-prev-step,
        .btn-next-step {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .btn-main-play-pause {
          flex: 1;
          background: #15803d;
          color: #ffffff;
          border: none;
          padding: 12px 16px;
          border-radius: 30px;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(21, 128, 61, 0.3);
        }

        .share-whatsapp-cta-box {
          margin-top: 4px;
        }

        .whatsapp-share-btn-large {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #25d366;
          color: #ffffff;
          padding: 14px 20px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 15px;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
        }

        .animate-pop {
          animation: popUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes popUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
