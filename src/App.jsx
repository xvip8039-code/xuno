import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import {
  ArmoryShopSection,
  CardBackArtwork,
  UNO_SKIN_CATALOG,
} from './ProductCard';

/**
 * ============================================================================
 * 🃏 X UNO — CYBERPUNK NEON MULTIPLAYER ARENA (App.jsx)
 * ============================================================================
 * Xavfsizlik & Zero-Trust Arxitekturasi:
 * - SHA-256 + Cryptographic Salt (Web Crypto API) parol xeshlash
 * - Anti-Tamper Checksum (localStorage manipulyatsiyasini aniqlash)
 * - XSS Sanitization & Rate Limiting (Brute-force himoyasi)
 * - Mutlaq Yagona Bosh Admin: XVIP_404 (hech qanday ochiq parol kodda yo'q)
 * - Real-time Multiplayer: BroadcastChannel + Firebase RTDB REST sinxronizatsiya
 */

const ADMIN_USERNAME = 'XVIP_404';
const ADMIN_SALT = 'XUNO_SALT_2026_XVIP';
// SHA-256('XUNO_SALT_2026_XVIP:' + password)
const ADMIN_PASS_HASH = '3f2179d256d06cb298effc75cd7aa5799e20a1f47e4ec5197fefd60eb9cca5e5';
const INTEGRITY_PEPPER = 'XUNO_ZERO_TRUST_SIG_2026_V9';

const STORAGE_KEYS = {
  USERS: 'xuno_users_v2',
  SESSION: 'xuno_session_v2',
  ROOMS: 'xuno_rooms_v2',
  PROMOS: 'xuno_promos_v2',
  GLOBAL_MSG: 'xuno_global_banner_v2',
  CLOUD_URL: 'xuno_cloud_rtdb_url_v2',
  THEME: 'xuno_theme_v2',
};

const UNO_COLORS = [
  { id: 'red', label: 'Crimson Red', hex: '#ff1e56' },
  { id: 'blue', label: 'Cyber Blue', hex: '#00d2ff' },
  { id: 'green', label: 'Toxic Green', hex: '#10b981' },
  { id: 'yellow', label: 'Solar Gold', hex: '#fbbf24' },
];

const QUICK_EMOTES = ['🔥', '⚡', '👑', '😈', '💀', '🃏', '🚀', '💎'];

// ============================================================================
// CRYPTO & SECURITY HELPERS (Web Crypto API)
// ============================================================================
const sanitizeText = (val, maxLen = 120) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[<>/"'`&]/g, (c) => {
      const m = { '<': '&lt;', '>': '&gt;', '/': '&#x2F;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;', '&': '&amp;' };
      return m[c] || c;
    })
    .trim()
    .slice(0, maxLen);
};

const sha256Hex = async (text) => {
  const data = new TextEncoder().encode(text);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const generateSalt = (len = 16) => {
  const arr = new Uint8Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const computeUserSignature = async (userObj) => {
  const canonical = JSON.stringify({
    username: userObj.username,
    coins: userObj.coins,
    wins: userObj.wins,
    games: userObj.games,
    rating: userObj.rating,
    ownedSkins: [...(userObj.ownedSkins || [])].sort(),
    isAdmin: Boolean(userObj.isAdmin && userObj.username === ADMIN_USERNAME),
    banned: Boolean(userObj.banned),
  });
  return sha256Hex(`${INTEGRITY_PEPPER}:${canonical}`);
};

const verifyUserIntegrity = async (userObj) => {
  if (!userObj || !userObj.signature) return false;
  // Mutlaq qoida: XVIP_404 dan boshqa hech kim admin bo'lishi mumkin emas
  if (userObj.isAdmin && userObj.username !== ADMIN_USERNAME) return false;
  const expected = await computeUserSignature(userObj);
  return expected === userObj.signature;
};

// ============================================================================
// WEB AUDIO API SOUND SYNTHESIZER
// ============================================================================
const playNeonSfx = (type, muted = false) => {
  if (muted) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.__xUnoAudioCtx) window.__xUnoAudioCtx = new AudioCtx();
    const ctx = window.__xUnoAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const beep = (freqStart, freqEnd, dur, wave = 'sine', vol = 0.06, delay = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(freqStart, now + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + delay + dur);
      g.gain.setValueAtTime(vol, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + delay);
      o.stop(now + delay + dur + 0.01);
    };

    switch (type) {
      case 'card':
        beep(440, 720, 0.08, 'triangle', 0.07);
        break;
      case 'draw':
        beep(320, 180, 0.09, 'sine', 0.06);
        break;
      case 'shuffle':
        [0, 0.05, 0.1, 0.15].forEach((d) => beep(520, 260, 0.04, 'triangle', 0.04, d));
        break;
      case 'wild4':
        beep(180, 55, 0.35, 'sawtooth', 0.11);
        beep(920, 240, 0.28, 'square', 0.07, 0.05);
        break;
      case 'uno':
        beep(587.33, 880, 0.14, 'triangle', 0.09, 0);
        beep(880, 1174.66, 0.2, 'triangle', 0.09, 0.11);
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, f * 1.03, 0.25, 'triangle', 0.09, i * 0.08));
        break;
      case 'error':
        beep(170, 110, 0.14, 'square', 0.06);
        break;
      default:
        beep(640, 860, 0.04, 'sine', 0.03);
    }
  } catch {
    // Audio blocked
  }
};

// ============================================================================
// BRAND EMBLEM & REALISTIC TACTICAL HUMAN AVATAR SVG
// ============================================================================
const XUnoBrandEmblem = ({ size = 40, className = '' }) => (
  <svg viewBox="0 0 80 96" width={size} height={size * 1.2} className={className} aria-label="X UNO Joker Emblem">
    <defs>
      <linearGradient id="xunoSplit" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#00d2ff" />
        <stop offset="49%" stopColor="#00d2ff" />
        <stop offset="51%" stopColor="#ff1e56" />
        <stop offset="100%" stopColor="#ff1e56" />
      </linearGradient>
    </defs>
    {/* Kiber-qirrali karta */}
    <polygon
      points="12,4 68,4 76,14 76,82 68,92 12,92 4,82 4,14"
      fill="#070a14"
      stroke="url(#xunoSplit)"
      strokeWidth="3.5"
    />
    <path d="M40 6 V90" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 3" />
    {/* Qonli & Neon Joker niqobi */}
    <path
      d="M18 32 L28 18 L40 28 L52 18 L62 32 L56 58 L40 68 L24 58 Z"
      fill="#0f172a"
      stroke="url(#xunoSplit)"
      strokeWidth="2.4"
    />
    {/* Ayyor ko'zlar */}
    <polygon points="27,40 36,44 28,48" fill="#00d2ff" />
    <polygon points="53,40 44,44 52,48" fill="#ff1e56" />
    {/* Ayyor tabassum */}
    <path d="M26 53 Q40 64 54 53 Q40 58 26 53 Z" fill="url(#xunoSplit)" />
    <text x="40" y="83" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900" fontFamily="monospace">
      X+4
    </text>
  </svg>
);

/**
 * Realistik Odam Proporsiyasidagi Taktik Personaj Avatari (Multfilm emas)
 */
const RealisticTacticalAvatar = ({ seed = 'AGENT', isAdmin = false, size = 48 }) => {
  const palette = useMemo(() => {
    if (isAdmin) {
      return { suit: '#1e1b4b', visor: '#fbbf24', rim: '#fbbf24', accent: '#ff1e56', skin: '#d6a584' };
    }
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = seed.charCodeAt(i) + ((h << 5) - h);
    const accents = ['#00d2ff', '#ff1e56', '#10b981', '#fbbf24'];
    const accent = accents[Math.abs(h) % accents.length];
    return { suit: '#0f172a', visor: accent, rim: accent, accent, skin: '#c99778' };
  }, [seed, isAdmin]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        borderRadius: '12px',
        border: `2px solid ${palette.rim}`,
        background: 'radial-gradient(circle at 50% 25%, #1e293b 0%, #020617 100%)',
        boxShadow: `0 0 14px ${palette.rim}55`,
        flexShrink: 0,
      }}
    >
      {/* Taktik yelka va zirh (realistik proporsiya) */}
      <path d="M12 100 L22 72 L40 65 L60 65 L78 72 L88 100 Z" fill={palette.suit} stroke="#334155" strokeWidth="1.5" />
      <path d="M36 67 L50 82 L64 67" fill="none" stroke={palette.accent} strokeWidth="2" />
      {/* Bo'yin va soya */}
      <rect x="43" y="54" width="14" height="14" rx="4" fill="#9c6e53" />
      {/* Realistik bosh va jag' tuzilishi */}
      <path d="M35 28 C35 16, 65 16, 65 28 L64 46 C62 56, 55 60, 50 60 C45 60, 38 56, 36 46 Z" fill={palette.skin} />
      {/* Taktik shlem / soch va kiber-ko'zoynak */}
      <path d="M33 29 C33 13, 67 13, 67 29 L64 25 L36 25 Z" fill="#090d16" />
      <rect x="35" y="31" width="30" height="8" rx="2.5" fill="#020617" stroke={palette.visor} strokeWidth="1.4" />
      <line x1="39" y1="35" x2="47" y2="35" stroke={palette.visor} strokeWidth="2" />
      <line x1="53" y1="35" x2="61" y2="35" stroke={palette.visor} strokeWidth="2" />
      {/* Taktik niqob / yoqa */}
      <path d="M37 47 L50 53 L63 47 L61 58 L50 61 L39 58 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />
      {isAdmin && (
        <polygon points="39,14 44,6 50,12 56,6 61,14" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
      )}
    </svg>
  );
};

// ============================================================================
// UNO DECK GENERATOR & ENGINE HELPERS
// ============================================================================
const createUnoDeck = () => {
  const deck = [];
  let seq = 1;
  UNO_COLORS.forEach((c) => {
    deck.push({ id: `c_${seq++}`, color: c.id, value: '0', type: 'number' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', 'REVERSE', 'SKIP'].forEach((v) => {
      const t = v === '+2' || v === 'REVERSE' || v === 'SKIP' ? 'action' : 'number';
      deck.push({ id: `c_${seq++}`, color: c.id, value: v, type: t });
      deck.push({ id: `c_${seq++}`, color: c.id, value: v, type: t });
    });
  });
  for (let i = 0; i < 4; i += 1) {
    deck.push({ id: `c_${seq++}`, color: 'wild', value: 'WILD', type: 'wild' });
    deck.push({ id: `c_${seq++}`, color: 'wild', value: '+4', type: 'wild' });
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const isCardPlayable = (card, topCard, activeColor) => {
  if (!card || !topCard) return false;
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
};

const formatCardSymbol = (val) => {
  if (val === 'REVERSE') return '⇄';
  if (val === 'SKIP') return '⊘';
  if (val === 'WILD') return '✦';
  return val;
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================
function App() {
  // 1. Theme & Splash State
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEYS.THEME) || 'dark');
  const [muted, setMuted] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  // 2. Navigation & Modals
  const [activeTab, setActiveTab] = useState('LOBBY'); // LOBBY | ARENA | SHOP | LEADERBOARD | ADMIN
  const [inspectProfileUser, setInspectProfileUser] = useState(null);
  const [globalBanner, setGlobalBanner] = useState(
    () => localStorage.getItem(STORAGE_KEYS.GLOBAL_MSG) || ''
  );

  // 3. Persistent Users, Promos, Rooms & Cloud Sync URL
  const [usersMap, setUsersMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '{}');
    } catch {
      return {};
    }
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [roomsMap, setRoomsMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS) || '{}');
    } catch {
      return {};
    }
  });
  const [activeRoomCode, setActiveRoomCode] = useState('');
  const [promosMap, setPromosMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROMOS) || '{}');
    } catch {
      return {};
    }
  });
  const [cloudUrl, setCloudUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.CLOUD_URL) || '');

  // 4. Auth Form & Rate Limiting State
  const [authMode, setAuthMode] = useState('LOGIN');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // 5. Game UI States
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [pendingWildCard, setPendingWildCard] = useState(null);
  const [lightningFx, setLightningFx] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState('');
  const [xrayEnabled, setXrayEnabled] = useState(false);

  // Admin Panel Inputs
  const [adminTargetUser, setAdminTargetUser] = useState('');
  const [adminCoinAmount, setAdminCoinAmount] = useState('500');
  const [adminNewPromoCode, setAdminNewPromoCode] = useState('');
  const [adminNewPromoCoins, setAdminNewPromoCoins] = useState('300');
  const [adminGlobalMsgInput, setAdminGlobalMsgInput] = useState('');
  const [adminTurnSecondsInput, setAdminTurnSecondsInput] = useState('25');

  const broadcastRef = useRef(null);

  // Splash Screen Loading Bar
  useEffect(() => {
    const timer = setInterval(() => {
      setSplashProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setShowSplash(false), 320);
          return 100;
        }
        return prev + 8;
      });
    }, 65);
    return () => clearInterval(timer);
  }, []);

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // 1-second tick for Rate Limit & Turn Timer
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Restore & Anti-Tamper Verify Session on Startup
  useEffect(() => {
    const restore = async () => {
      const savedSessionUser = sessionStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!savedSessionUser || !usersMap[savedSessionUser]) return;
      const candidate = usersMap[savedSessionUser];
      const valid = await verifyUserIntegrity(candidate);
      if (valid && !candidate.banned) {
        setCurrentUser(candidate);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        sessionStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save signed user helper
  const persistUser = useCallback(async (rawUser) => {
    const safeAdmin = rawUser.username === ADMIN_USERNAME && Boolean(rawUser.isAdmin);
    const cleanUser = {
      ...rawUser,
      isAdmin: safeAdmin,
      coins: safeAdmin ? 999999999 : Math.max(0, Number(rawUser.coins) || 0),
      ownedSkins: Array.from(new Set(['skin_steel_default', 'fx_steel_default', ...(rawUser.ownedSkins || [])])),
    };
    cleanUser.signature = await computeUserSignature(cleanUser);

    setUsersMap((prev) => {
      const next = { ...prev, [cleanUser.username]: cleanUser };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
      return next;
    });
    setCurrentUser((prev) => (prev && prev.username === cleanUser.username ? cleanUser : prev));
    return cleanUser;
  }, []);

  // Real-time BroadcastChannel + Optional Cloud RTDB Sync
  const pushRoomSync = useCallback(
    async (roomCode, roomData) => {
      setRoomsMap((prev) => {
        const next = { ...prev, [roomCode]: roomData };
        localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(next));
        return next;
      });
      broadcastRef.current?.postMessage({ type: 'ROOM_UPDATE', roomCode, roomData });

      if (cloudUrl && cloudUrl.startsWith('https://')) {
        try {
          const base = cloudUrl.replace(/\/$/, '');
          await fetch(`${base}/xuno_rooms/${roomCode}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData),
          });
        } catch {
          // Offline or CORS fallback
        }
      }
    },
    [cloudUrl]
  );

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel('xuno_realtime_v1');
    broadcastRef.current = ch;
    ch.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === 'ROOM_UPDATE' && msg.roomCode && msg.roomData) {
        setRoomsMap((prev) => {
          const next = { ...prev, [msg.roomCode]: msg.roomData };
          localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(next));
          return next;
        });
      } else if (msg.type === 'GLOBAL_BANNER') {
        setGlobalBanner(msg.text || '');
        localStorage.setItem(STORAGE_KEYS.GLOBAL_MSG, msg.text || '');
      }
    };
    return () => ch.close();
  }, []);

  // Cloud RTDB Polling (if friends on separate phones/PCs use same Firebase RTDB URL)
  useEffect(() => {
    if (!cloudUrl || !cloudUrl.startsWith('https://') || !activeRoomCode) return undefined;
    const base = cloudUrl.replace(/\/$/, '');
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${base}/xuno_rooms/${activeRoomCode}.json`);
        if (!res.ok) return;
        const remote = await res.json();
        if (remote && remote.updatedAt) {
          setRoomsMap((prev) => {
            const local = prev[activeRoomCode];
            if (!local || remote.updatedAt > (local.updatedAt || 0)) {
              return { ...prev, [activeRoomCode]: remote };
            }
            return prev;
          });
        }
      } catch {
        // Ignore transient network poll error
      }
    }, 1800);
    return () => clearInterval(poll);
  }, [cloudUrl, activeRoomCode]);

  // ============================================================================
  // AUTHENTICATION (SHA-256 + SALT + RATE LIMIT + ZERO-TRUST)
  // ============================================================================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (nowTick < lockoutUntil) {
      const sec = Math.ceil((lockoutUntil - nowTick) / 1000);
      setAuthError(`🔒 Juda ko‘p xato urinish! ${sec} soniyadan keyin urinib ko‘ring.`);
      playNeonSfx('error', muted);
      return;
    }

    const cleanUser = sanitizeText(authUsername, 24).replace(/\s+/g, '');
    if (cleanUser.length < 3 || authPassword.length < 4) {
      setAuthError('Login kamida 3 ta, parol kamida 4 ta belgidan iborat bo‘lishi kerak.');
      playNeonSfx('error', muted);
      return;
    }

    // BOSH ADMIN KIRISHI (XVIP_404) — faqat SHA-256 xesh bilan solishtiriladi
    if (cleanUser === ADMIN_USERNAME) {
      if (authMode === 'REGISTER') {
        setAuthError('⛔ Ushbu nom tizim tomonidan himoyalangan.');
        playNeonSfx('error', muted);
        return;
      }
      const attemptHash = await sha256Hex(`${ADMIN_SALT}:${authPassword}`);
      if (attemptHash !== ADMIN_PASS_HASH) {
        const nextAtt = loginAttempts + 1;
        setLoginAttempts(nextAtt);
        if (nextAtt >= 4) {
          setLockoutUntil(Date.now() + 30000);
          setLoginAttempts(0);
        }
        setAuthError('❌ Maxfiy parol noto‘g‘ri!');
        playNeonSfx('error', muted);
        return;
      }

      const existingAdmin = usersMap[ADMIN_USERNAME];
      const adminObj = existingAdmin || {
        username: ADMIN_USERNAME,
        isAdmin: true,
        coins: 999999999,
        wins: 42,
        games: 45,
        rating: 9999,
        ownedSkins: UNO_SKIN_CATALOG.map((s) => s.id),
        equippedCardBack: 'skin_joker_engraved',
        equippedVictoryFx: 'fx_dragon_inferno',
        joinedAt: new Date().toLocaleDateString('uz-UZ'),
        banned: false,
      };
      const signed = await persistUser({ ...adminObj, isAdmin: true });
      localStorage.setItem(STORAGE_KEYS.SESSION, signed.username);
      setCurrentUser(signed);
      setLoginAttempts(0);
      playNeonSfx('uno', muted);
      return;
    }

    // ODDIY O'YINCHILAR
    if (authMode === 'REGISTER') {
      if (usersMap[cleanUser]) {
        setAuthError('Bu login band! Boshqa nom tanlang.');
        playNeonSfx('error', muted);
        return;
      }
      const salt = generateSalt();
      const passwordHash = await sha256Hex(`${salt}:${authPassword}`);
      const newUser = {
        username: cleanUser,
        salt,
        passwordHash,
        isAdmin: false,
        coins: 500,
        wins: 0,
        games: 0,
        rating: 1000,
        ownedSkins: ['skin_steel_default', 'fx_steel_default'],
        equippedCardBack: 'skin_steel_default',
        equippedVictoryFx: 'fx_steel_default',
        joinedAt: new Date().toLocaleDateString('uz-UZ'),
        banned: false,
      };
      const signed = await persistUser(newUser);
      localStorage.setItem(STORAGE_KEYS.SESSION, signed.username);
      setCurrentUser(signed);
      playNeonSfx('uno', muted);
    } else {
      const found = usersMap[cleanUser];
      if (!found) {
        setAuthError('Foydalanuvchi topilmadi.');
        playNeonSfx('error', muted);
        return;
      }
      if (found.banned) {
        setAuthError('⛔ Sizning hisobingiz Bosh Admin tomonidan bloklangan.');
        playNeonSfx('error', muted);
        return;
      }
      const integrityOk = await verifyUserIntegrity(found);
      if (!integrityOk) {
        setAuthError('⚠️ Xavfsizlik xatosi: Ma’lumot imzosi buzilgan!');
        playNeonSfx('error', muted);
        return;
      }
      const attemptHash = await sha256Hex(`${found.salt}:${authPassword}`);
      if (attemptHash !== found.passwordHash) {
        const nextAtt = loginAttempts + 1;
        setLoginAttempts(nextAtt);
        if (nextAtt >= 5) {
          setLockoutUntil(Date.now() + 30000);
          setLoginAttempts(0);
        }
        setAuthError('❌ Parol noto‘g‘ri!');
        playNeonSfx('error', muted);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.SESSION, found.username);
      setCurrentUser(found);
      setLoginAttempts(0);
      playNeonSfx('card', muted);
    }
  };

  // To'liq Sessiya Izolyatsiyasi (Logout)
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    setCurrentUser(null);
    setActiveRoomCode('');
    setActiveTab('LOBBY');
    setXrayEnabled(false);
    setAuthPassword('');
    setInspectProfileUser(null);
    playNeonSfx('draw', muted);
  };

  // ============================================================================
  // MULTIPLAYER ROOMS (FAQAT XVIP_404 XONA YARATA OLADI)
  // ============================================================================
  const activeRoom = activeRoomCode ? roomsMap[activeRoomCode] : null;

  const handleCreateRoom = async () => {
    if (!currentUser || currentUser.username !== ADMIN_USERNAME || !currentUser.isAdmin) {
      playNeonSfx('error', muted);
      return;
    }
    const code = `XUNO-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRoom = {
      code,
      host: currentUser.username,
      status: 'WAITING', // WAITING | PLAYING | FINISHED
      players: [
        {
          username: currentUser.username,
          isAdmin: true,
          equippedCardBack: currentUser.equippedCardBack,
          unoShouted: false,
        },
      ],
      hands: {},
      deck: [],
      discardPile: [],
      activeColor: 'blue',
      direction: 1,
      turnIndex: 0,
      turnSeconds: Number(adminTurnSecondsInput) || 25,
      winner: null,
      chat: [
        {
          id: Date.now(),
          sender: 'TIZIM',
          text: `Xona ${code} Bosh Admin XVIP_404 tomonidan ochildi!`,
        },
      ],
      updatedAt: Date.now(),
    };
    await pushRoomSync(code, newRoom);
    setActiveRoomCode(code);
    setActiveTab('ARENA');
    playNeonSfx('shuffle', muted);
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const code = sanitizeText(joinCodeInput, 20).toUpperCase();
    let targetRoom = roomsMap[code];

    // Agar bulutli URL ulangan bo'lsa, u yerdan ham tekshirib ko'rish
    if (!targetRoom && cloudUrl && cloudUrl.startsWith('https://')) {
      try {
        const res = await fetch(`${cloudUrl.replace(/\/$/, '')}/xuno_rooms/${code}.json`);
        if (res.ok) targetRoom = await res.json();
      } catch {
        // Ignore
      }
    }

    if (!targetRoom) {
      setAuthError('Xona kodi topilmadi! Admindan to‘g‘ri kodni oling.');
      playNeonSfx('error', muted);
      return;
    }
    const alreadyIn = targetRoom.players.some((p) => p.username === currentUser.username);
    const updatedPlayers = alreadyIn
      ? targetRoom.players
      : [
          ...targetRoom.players,
          {
            username: currentUser.username,
            isAdmin: currentUser.username === ADMIN_USERNAME,
            equippedCardBack: currentUser.equippedCardBack,
            unoShouted: false,
          },
        ];

    const nextRoom = {
      ...targetRoom,
      players: updatedPlayers,
      chat: [
        ...targetRoom.chat,
        ...(alreadyIn
          ? []
          : [{ id: Date.now(), sender: 'TIZIM', text: `${currentUser.username} arenaga qo‘shildi!` }]),
      ],
      updatedAt: Date.now(),
    };
    await pushRoomSync(code, nextRoom);
    setActiveRoomCode(code);
    setActiveTab('ARENA');
    playNeonSfx('card', muted);
  };

  const handleStartMatch = async () => {
    if (!activeRoom || !currentUser || currentUser.username !== ADMIN_USERNAME) return;
    if (activeRoom.players.length < 2) return;

    const deck = createUnoDeck();
    const hands = {};
    activeRoom.players.forEach((p) => {
      hands[p.username] = deck.splice(0, 7);
    });

    let firstCard = deck.pop();
    while (firstCard.color === 'wild') {
      deck.unshift(firstCard);
      firstCard = deck.pop();
    }

    const nextRoom = {
      ...activeRoom,
      status: 'PLAYING',
      deck,
      hands,
      discardPile: [firstCard],
      activeColor: firstCard.color,
      direction: 1,
      turnIndex: 0,
      winner: null,
      players: activeRoom.players.map((p) => ({ ...p, unoShouted: false })),
      chat: [...activeRoom.chat, { id: Date.now(), sender: 'ARENA', text: '🔥 O‘yin boshlandi! Omad!' }],
      updatedAt: Date.now(),
    };
    await pushRoomSync(activeRoom.code, nextRoom);
    playNeonSfx('shuffle', muted);
  };

  // ============================================================================
  // UNO GAMEPLAY ENGINE (PLAY, DRAW, REVERSE, SKIP, WILD +4, UNO! SHOUT)
  // ============================================================================
  const topCard = activeRoom?.discardPile?.[activeRoom.discardPile.length - 1] || null;
  const currentTurnPlayer = activeRoom?.players?.[activeRoom.turnIndex] || null;
  const isMyTurn = Boolean(
    activeRoom?.status === 'PLAYING' && currentTurnPlayer?.username === currentUser?.username
  );
  const myHand = (activeRoom?.hands?.[currentUser?.username] || []);

  const executeCardPlay = async (card, chosenWildColor = null) => {
    if (!activeRoom || !currentUser || !isMyTurn) return;
    const nextHand = myHand.filter((c) => c.id !== card.id);
    const nextDiscard = [...activeRoom.discardPile, card];
    let nextDeck = [...activeRoom.deck];
    const nextHands = { ...activeRoom.hands, [currentUser.username]: nextHand };
    let nextDirection = activeRoom.direction;
    let step = 1;
    const total = activeRoom.players.length;
    const nextColor = card.color === 'wild' ? chosenWildColor || 'red' : card.color;

    if (card.value === 'REVERSE') {
      if (total === 2) step = 2;
      else nextDirection = -activeRoom.direction;
    } else if (card.value === 'SKIP') {
      step = 2;
    } else if (card.value === '+2' || card.value === '+4') {
      const victimIdx = (activeRoom.turnIndex + nextDirection + total) % total;
      const victimName = activeRoom.players[victimIdx].username;
      const penalty = card.value === '+4' ? 4 : 2;
      const drawn = [];
      for (let i = 0; i < penalty; i += 1) {
        if (nextDeck.length === 0) nextDeck = createUnoDeck();
        drawn.push(nextDeck.pop());
      }
      nextHands[victimName] = [...(nextHands[victimName] || []), ...drawn];
      step = 2;
      if (card.value === '+4') {
        setLightningFx(true);
        setTimeout(() => setLightningFx(false), 680);
        playNeonSfx('wild4', muted);
      }
    }

    // G'olibni tekshirish
    if (nextHand.length === 0) {
      playNeonSfx('win', muted);
      const finishedRoom = {
        ...activeRoom,
        status: 'FINISHED',
        hands: nextHands,
        discardPile: nextDiscard,
        activeColor: nextColor,
        winner: currentUser.username,
        updatedAt: Date.now(),
      };
      await pushRoomSync(activeRoom.code, finishedRoom);

      // Statistikani yangilash
      await persistUser({
        ...currentUser,
        wins: (currentUser.wins || 0) + 1,
        games: (currentUser.games || 0) + 1,
        rating: (currentUser.rating || 1000) + 45,
        coins: currentUser.isAdmin ? currentUser.coins : (currentUser.coins || 0) + 250,
      });
      return;
    }

    const nextTurnIndex = (activeRoom.turnIndex + step * nextDirection + total * 4) % total;
    const updatedPlayers = activeRoom.players.map((p) =>
      p.username === currentUser.username
        ? { ...p, unoShouted: nextHand.length === 1 ? p.unoShouted : false }
        : p
    );

    playNeonSfx('card', muted);
    await pushRoomSync(activeRoom.code, {
      ...activeRoom,
      players: updatedPlayers,
      hands: nextHands,
      deck: nextDeck,
      discardPile: nextDiscard,
      activeColor: nextColor,
      direction: nextDirection,
      turnIndex: nextTurnIndex,
      updatedAt: Date.now(),
    });
  };

  const handleCardClick = (card) => {
    if (!isMyTurn || !isCardPlayable(card, topCard, activeRoom.activeColor)) {
      playNeonSfx('error', muted);
      return;
    }
    if (card.color === 'wild') {
      setPendingWildCard(card);
    } else {
      executeCardPlay(card);
    }
  };

  const handleDrawCard = async () => {
    if (!isMyTurn || !activeRoom) return;
    let nextDeck = [...activeRoom.deck];
    if (nextDeck.length === 0) nextDeck = createUnoDeck();
    const drawn = nextDeck.pop();
    const nextHand = [...myHand, drawn];
    const total = activeRoom.players.length;
    const nextTurnIndex = (activeRoom.turnIndex + activeRoom.direction + total) % total;

    playNeonSfx('draw', muted);
    await pushRoomSync(activeRoom.code, {
      ...activeRoom,
      deck: nextDeck,
      hands: { ...activeRoom.hands, [currentUser.username]: nextHand },
      turnIndex: nextTurnIndex,
      updatedAt: Date.now(),
    });
  };

  const handleShoutUno = async () => {
    if (!activeRoom || !currentUser) return;
    playNeonSfx('uno', muted);
    await pushRoomSync(activeRoom.code, {
      ...activeRoom,
      players: activeRoom.players.map((p) =>
        p.username === currentUser.username ? { ...p, unoShouted: true } : p
      ),
      chat: [...activeRoom.chat, { id: Date.now(), sender: currentUser.username, text: '🔥 UNO!' }],
      updatedAt: Date.now(),
    });
  };

  const handleCatchUnoPenalty = async (targetUsername) => {
    if (!activeRoom) return;
    let nextDeck = [...activeRoom.deck];
    const penaltyCards = [nextDeck.pop() || createUnoDeck()[0], nextDeck.pop() || createUnoDeck()[1]];
    playNeonSfx('wild4', muted);
    await pushRoomSync(activeRoom.code, {
      ...activeRoom,
      deck: nextDeck,
      hands: {
        ...activeRoom.hands,
        [targetUsername]: [...(activeRoom.hands[targetUsername] || []), ...penaltyCards],
      },
      chat: [
        ...activeRoom.chat,
        { id: Date.now(), sender: 'HAKAM', text: `🚨 ${targetUsername} UNO bosmadi! Jarima: +2 karta!` },
      ],
      updatedAt: Date.now(),
    });
  };

  // Chat & Emotes
  const handleSendChat = async (customText = null) => {
    if (!activeRoom || !currentUser) return;
    const clean = sanitizeText(customText ?? chatInput, 120);
    if (!clean) return;
    if (!customText) setChatInput('');
    await pushRoomSync(activeRoom.code, {
      ...activeRoom,
      chat: [...activeRoom.chat.slice(-45), { id: Date.now(), sender: currentUser.username, text: clean }],
      updatedAt: Date.now(),
    });
  };

  // ============================================================================
  // SHOP, CASE OPENING & PROMO CODES
  // ============================================================================
  const handleBuySkin = async (item) => {
    if (!currentUser || item.isDefaultFree) return;
    if (currentUser.ownedSkins.includes(item.id)) return;
    if (!currentUser.isAdmin && currentUser.coins < item.price) return;

    const nextCoins = currentUser.isAdmin ? currentUser.coins : currentUser.coins - item.price;
    await persistUser({
      ...currentUser,
      coins: nextCoins,
      ownedSkins: [...currentUser.ownedSkins, item.id],
      ...(item.category === 'VICTORY_FX'
        ? { equippedVictoryFx: item.id }
        : { equippedCardBack: item.id }),
    });
  };

  const handleEquipSkin = async (item) => {
    if (!currentUser) return;
    if (!item.isDefaultFree && !currentUser.ownedSkins.includes(item.id)) return;
    await persistUser({
      ...currentUser,
      ...(item.category === 'VICTORY_FX'
        ? { equippedVictoryFx: item.id }
        : { equippedCardBack: item.id }),
    });
  };

  const handleUnboxReward = async (reward, cratePrice) => {
    if (!currentUser || !reward) return;
    const alreadyOwned = currentUser.ownedSkins.includes(reward.id);
    const baseCoins = currentUser.isAdmin ? currentUser.coins : Math.max(0, currentUser.coins - cratePrice);
    const finalCoins = currentUser.isAdmin ? baseCoins : alreadyOwned ? baseCoins + 150 : baseCoins;

    await persistUser({
      ...currentUser,
      coins: finalCoins,
      ownedSkins: alreadyOwned ? currentUser.ownedSkins : [...currentUser.ownedSkins, reward.id],
    });
  };

  const handleRedeemPromo = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const code = sanitizeText(promoInput, 24).toUpperCase();
    const promo = promosMap[code];
    if (!promo || promo.usedBy?.includes(currentUser.username)) {
      setPromoStatus('❌ Promo-kod yaroqsiz yoki allaqachon ishlatilgan.');
      playNeonSfx('error', muted);
      return;
    }
    const nextPromos = {
      ...promosMap,
      [code]: { ...promo, usedBy: [...(promo.usedBy || []), currentUser.username] },
    };
    setPromosMap(nextPromos);
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(nextPromos));
    await persistUser({
      ...currentUser,
      coins: currentUser.isAdmin ? currentUser.coins : currentUser.coins + promo.coins,
    });
    setPromoInput('');
    setPromoStatus(`✅ +${promo.coins} Coin hisobingizga qo‘shildi!`);
    playNeonSfx('uno', muted);
  };

  // ============================================================================
  // ADMIN PANEL ACTIONS (FAQAT XVIP_404)
  // ============================================================================
  const isSuperAdmin = Boolean(currentUser?.username === ADMIN_USERNAME && currentUser?.isAdmin);

  const handleAdminGiveCoins = async () => {
    if (!isSuperAdmin) return;
    const target = usersMap[sanitizeText(adminTargetUser, 24)];
    const amount = Math.max(1, Math.min(100000, Number(adminCoinAmount) || 0));
    if (!target || target.username === ADMIN_USERNAME) return;
    await persistUser({ ...target, coins: (target.coins || 0) + amount });
    playNeonSfx('uno', muted);
  };

  const handleAdminToggleBan = async (username) => {
    if (!isSuperAdmin || username === ADMIN_USERNAME) return;
    const target = usersMap[username];
    if (!target) return;
    await persistUser({ ...target, banned: !target.banned });
  };

  const handleAdminCreatePromo = () => {
    if (!isSuperAdmin) return;
    const code = sanitizeText(adminNewPromoCode, 20).toUpperCase();
    const coins = Math.max(10, Math.min(50000, Number(adminNewPromoCoins) || 100));
    if (!code) return;
    const next = { ...promosMap, [code]: { coins, usedBy: [] } };
    setPromosMap(next);
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(next));
    setAdminNewPromoCode('');
    playNeonSfx('uno', muted);
  };

  const handleAdminGlobalBanner = () => {
    if (!isSuperAdmin) return;
    const clean = sanitizeText(adminGlobalMsgInput, 140);
    setGlobalBanner(clean);
    localStorage.setItem(STORAGE_KEYS.GLOBAL_MSG, clean);
    broadcastRef.current?.postMessage({ type: 'GLOBAL_BANNER', text: clean });
    setAdminGlobalMsgInput('');
  };

  // Leaderboard ro'yxati
  const leaderboardList = useMemo(() => {
    return Object.values(usersMap)
      .filter((u) => !u.banned)
      .sort((a, b) => (b.rating || 1000) - (a.rating || 1000));
  }, [usersMap]);

  // ============================================================================
  // RENDER: SPLASH SCREEN
  // ============================================================================
  if (showSplash) {
    return (
      <div className="xuno-splash-screen">
        <div className="xuno-splash-particles">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="xuno-splash-particle"
              style={{
                left: `${10 + i * 11}%`,
                '--p-color': i % 2 === 0 ? '#00d2ff' : '#ff1e56',
                '--p-dur': `${5 + (i % 4)}s`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          ))}
        </div>
        <XUnoBrandEmblem size={115} className="xuno-splash-emblem" />
        <h1 className="xuno-splash-title">X UNO — NEON KARTALAR ARENASIGA XUSH KELIBSIZ</h1>
        <div className="xuno-splash-sub">ZERO-TRUST KIBER-XAVFSIZLIK • REAL-TIME MULTIPLAYER</div>
        <div className="xuno-loading-track">
          <div className="xuno-loading-fill" style={{ width: `${splashProgress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="xuno-app-shell">
      {lightningFx && <div className="xuno-lightning-fx" />}

      {/* YUQORI HUD NAVBAR */}
      <header className="xuno-navbar">
        <div className="xuno-brand" onClick={() => setActiveTab('LOBBY')}>
          <XUnoBrandEmblem size={34} />
          <div>
            <div className="xuno-brand-title">🃏 X UNO</div>
            <div style={{ fontSize: '10px', color: 'var(--x-text-muted)', letterSpacing: '1.2px' }}>
              CYBERPUNK MULTIPLAYER
            </div>
          </div>
        </div>

        {currentUser && (
          <nav className="xuno-nav-tabs">
            {[
              { id: 'LOBBY', label: '🌐 LOBBI' },
              { id: 'ARENA', label: '🃏 3D ARENA' },
              { id: 'SHOP', label: '🛒 DO‘KON & SANDIQ' },
              { id: 'LEADERBOARD', label: '🏆 REYTING' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`xuno-nav-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {isSuperAdmin && (
              <button
                type="button"
                className={`xuno-nav-btn is-admin-tab ${activeTab === 'ADMIN' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('ADMIN')}
              >
                👑 ADMIN PANEL
              </button>
            )}
          </nav>
        )}

        <div className="xuno-hud-right">
          <button
            type="button"
            className="xuno-icon-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="Dark / Light Mode"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button
            type="button"
            className="xuno-icon-btn"
            onClick={() => setMuted((m) => !m)}
            title="Ovoz"
          >
            {muted ? '🔇' : '🔊'}
          </button>

          {currentUser && (
            <>
              <div className="xuno-coin-pill">
                🪙 {isSuperAdmin ? '∞' : currentUser.coins}
              </div>
              <button
                type="button"
                className="xuno-icon-btn"
                onClick={() => setInspectProfileUser(currentUser)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{currentUser.username}</span>
                {isSuperAdmin && (
                  <span title="Bosh Admin">
                    👑 <span style={{ color: '#00d2ff' }}>✓</span>
                  </span>
                )}
              </button>
              <button type="button" className="xuno-icon-btn" onClick={handleLogout}>
                🚪 Chiqish
              </button>
            </>
          )}
        </div>
      </header>

      {globalBanner && <div className="xuno-global-banner">📢 ADMIN E’LONI: {globalBanner}</div>}

      {/* ========================================================================
       * AUTH EKRANI (AGAR FOYDALANUVCHI KIRMAGAN BO'LSA)
       * ======================================================================== */}
      {!currentUser ? (
        <main className="xuno-auth-wrapper">
          <form className="xuno-auth-card" onSubmit={handleAuthSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <XUnoBrandEmblem size={44} />
              <div>
                <h2 style={{ margin: 0 }}>{authMode === 'LOGIN' ? 'Arenaga Kirish' : 'Ro‘yxatdan O‘tish'}</h2>
                <div style={{ fontSize: '12px', color: 'var(--x-text-muted)' }}>
                  SHA-256 + Salt Kriptografik Himoya
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`xuno-nav-btn ${authMode === 'LOGIN' ? 'is-active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthMode('LOGIN');
                  setAuthError('');
                }}
              >
                KIRISH
              </button>
              <button
                type="button"
                className={`xuno-nav-btn ${authMode === 'REGISTER' ? 'is-active' : ''}`}
                style={{ flex: 1 }}
                onClick={() => {
                  setAuthMode('REGISTER');
                  setAuthError('');
                }}
              >
                RO‘YXATDAN O‘TISH
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <input
                type="text"
                className="xuno-input"
                placeholder="Foydalanuvchi nomi (Nick)"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                required
              />
              <input
                type="password"
                className="xuno-input"
                placeholder="Parol"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
            </div>

            {authError && (
              <div style={{ color: '#ff1e56', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="xuno-primary-btn">
              {authMode === 'LOGIN' ? '⚡ KIRISH' : '🛡️ HISOB YARATISH (+500 COIN)'}
            </button>
          </form>
        </main>
      ) : (
        <main className="xuno-main-container">
          {/* ==================================================================
           * 1. LOBBI (XONA YARATISH FAQAT XVIP_404, DO'STLAR KOD BILAN KIRADI)
           * ================================================================== */}
          {activeTab === 'LOBBY' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '20px' }}>
              <div className="xuno-sidebar-panel">
                <h2 style={{ margin: 0 }}>🎮 Onlayn Xonaga Qo‘shilish</h2>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--x-text-muted)' }}>
                  Har bir o‘yinchi o‘z qurilmasidan kiradi. Bosh Admin bergan maxfiy Xona Kodini kiriting:
                </p>
                <form onSubmit={handleJoinRoom} style={{ display: 'grid', gap: '10px' }}>
                  <input
                    type="text"
                    className="xuno-input"
                    placeholder="Masalan: XUNO-4821"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                  />
                  <button type="submit" className="xuno-primary-btn">
                    🚀 XONAGA QO‘SHILISH
                  </button>
                </form>

                {isSuperAdmin && (
                  <div style={{ marginTop: '12px', paddingTop: '14px', borderTop: '1px solid var(--x-border)' }}>
                    <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 800, marginBottom: '8px' }}>
                      👑 FAQAT XVIP_404 UCHUN EKSKLYUZIV
                    </div>
                    <button type="button" className="xuno-primary-btn" onClick={handleCreateRoom}>
                      ➕ YANGI O‘YIN XONASI YARATISH
                    </button>
                  </div>
                )}
              </div>

              {/* Bulutli Real-Time Sinxronizatsiya & Promo-Kod */}
              <div className="xuno-sidebar-panel">
                <h2 style={{ margin: 0 }}>☁️ Bulutli Multiplayer & Promo-Kod</h2>
                <div style={{ fontSize: '12.5px', color: 'var(--x-text-muted)' }}>
                  Turli telefon/kompyuterlarda o‘ynash uchun umumiy Firebase RTDB URL (ixtiyoriy; brauzer tablari
                  avtomatik sinxronlanadi):
                </div>
                <input
                  type="url"
                  className="xuno-input"
                  placeholder="https://your-project.firebaseio.com"
                  value={cloudUrl}
                  onChange={(e) => {
                    setCloudUrl(e.target.value);
                    localStorage.setItem(STORAGE_KEYS.CLOUD_URL, e.target.value);
                  }}
                />

                <form onSubmit={handleRedeemPromo} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="text"
                    className="xuno-input"
                    placeholder="🎁 Promo-kod kiriting..."
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                  />
                  <button type="submit" className="xuno-nav-btn is-active">
                    FAOLLASHTIRISH
                  </button>
                </form>
                {promoStatus && <div style={{ fontSize: '12.5px', fontWeight: 700 }}>{promoStatus}</div>}
              </div>
            </div>
          )}

          {/* ==================================================================
           * 2. 3D ARENA & O'YIN STOLI
           * ================================================================== */}
          {activeTab === 'ARENA' && (
            <div>
              {!activeRoom ? (
                <div className="xuno-sidebar-panel" style={{ textAlign: 'center', padding: '40px' }}>
                  <h2>Hali birorta xonaga kirmadingiz</h2>
                  <button
                    type="button"
                    className="xuno-nav-btn is-active"
                    style={{ margin: '0 auto' }}
                    onClick={() => setActiveTab('LOBBY')}
                  >
                    🌐 Lobbiga Qaytish
                  </button>
                </div>
              ) : (
                <div className="xuno-arena-grid">
                  <div className="xuno-table-stage">
                    {/* Xona Yuqori Ma'lumoti */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 900, color: 'var(--x-neon-blue)' }}>
                          XONA: {activeRoom.code}
                        </span>{' '}
                        •{' '}
                        <span style={{ fontSize: '12px', color: 'var(--x-text-muted)' }}>
                          {activeRoom.status === 'WAITING'
                            ? 'O‘yinchilar kutilmoqda...'
                            : `Navbat: ${currentTurnPlayer?.username || '-'}`}
                        </span>
                      </div>

                      {activeRoom.status === 'WAITING' && isSuperAdmin && (
                        <button
                          type="button"
                          className="xuno-nav-btn is-admin-tab"
                          disabled={activeRoom.players.length < 2}
                          onClick={handleStartMatch}
                        >
                          ▶ O‘YINNI BOSHLASH ({activeRoom.players.length} o‘yinchi)
                        </button>
                      )}
                    </div>

                    {/* Raqiblar (Anti-Cheat: Faqat Karta Orqasi va Soni!) */}
                    <div className="xuno-opponents-row">
                      {activeRoom.players
                        .filter((p) => p.username !== currentUser.username)
                        .map((opp) => {
                          const oppHand = activeRoom.hands?.[opp.username] || [];
                          const isTurn = currentTurnPlayer?.username === opp.username;
                          const oppSkin =
                            UNO_SKIN_CATALOG.find((s) => s.id === opp.equippedCardBack)?.artworkType || 'steel';
                          return (
                            <div
                              key={opp.username}
                              className={`xuno-opponent-pod ${isTurn ? 'is-turn' : ''}`}
                              onClick={() =>
                                setInspectProfileUser(usersMap[opp.username] || { username: opp.username })
                              }
                            >
                              <RealisticTacticalAvatar seed={opp.username} isAdmin={opp.isAdmin} size={46} />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '13.5px' }}>
                                  {opp.username} {opp.isAdmin && '👑✓'}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--x-text-muted)' }}>
                                  {oppHand.length} ta karta {opp.unoShouted ? '• 🔥 UNO!' : ''}
                                </div>

                                {/* Anti-Cheat: Oddiy o'yinchilar faqat karta orqasini ko'radi */}
                                <div className="xuno-mini-fan">
                                  {xrayEnabled && isSuperAdmin
                                    ? oppHand.slice(0, 6).map((c) => (
                                        <span
                                          key={c.id}
                                          style={{
                                            fontSize: '10px',
                                            padding: '2px 4px',
                                            marginRight: '2px',
                                            borderRadius: '4px',
                                            background: '#0f172a',
                                            border: '1px solid #fbbf24',
                                          }}
                                        >
                                          {c.color[0].toUpperCase()}:{c.value}
                                        </span>
                                      ))
                                    : Array.from({ length: Math.min(oppHand.length, 6) }).map((_, idx) => (
                                        <div key={idx} className="xuno-mini-card-back">
                                          <CardBackArtwork artworkType={oppSkin} />
                                        </div>
                                      ))}
                                </div>

                                {oppHand.length === 1 && !opp.unoShouted && (
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleCatchUnoPenalty(opp.username);
                                    }}
                                    style={{
                                      marginTop: '4px',
                                      fontSize: '10px',
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#ff1e56',
                                      color: '#fff',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🚨 USHLASH (+2)
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* CSS 3D Stol */}
                    <div className="xuno-3d-perspective">
                      <div
                        className="xuno-3d-table"
                        style={{
                          '--table-color':
                            UNO_COLORS.find((c) => c.id === activeRoom.activeColor)?.hex || '#00d2ff',
                          '--table-glow': `${
                            UNO_COLORS.find((c) => c.id === activeRoom.activeColor)?.hex || '#00d2ff'
                          }55`,
                        }}
                      >
                        <div className={`xuno-direction-ring ${activeRoom.direction === -1 ? 'is-ccw' : ''}`} />

                        {/* Yopiq Kaloda (Draw Deck) */}
                        <div
                          onClick={handleDrawCard}
                          title="Karta tortish"
                          style={{
                            width: '94px',
                            height: '138px',
                            borderRadius: '13px',
                            cursor: isMyTurn ? 'pointer' : 'not-allowed',
                            boxShadow: '0 14px 26px rgba(0,0,0,0.65)',
                            zIndex: 2,
                          }}
                        >
                          <CardBackArtwork
                            artworkType={
                              UNO_SKIN_CATALOG.find((s) => s.id === currentUser.equippedCardBack)?.artworkType ||
                              'steel'
                            }
                          />
                        </div>

                        {/* Ochiq Karta Ustuni (Discard Pile) */}
                        {topCard ? (
                          <div className={`xuno-card color-${topCard.color}`} style={{ zIndex: 2 }}>
                            <span className="xuno-card-corner tl">{formatCardSymbol(topCard.value)}</span>
                            <div className="xuno-card-inner">{formatCardSymbol(topCard.value)}</div>
                            <span className="xuno-card-corner br">{formatCardSymbol(topCard.value)}</span>
                          </div>
                        ) : (
                          <div style={{ color: '#94a3b8', fontWeight: 800 }}>STOL BO‘SH</div>
                        )}
                      </div>
                    </div>

                    {/* O'yinchining Shaxsiy Qo'li */}
                    <div className="xuno-hand-zone">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '13.5px' }}>
                          Sizning kartalaringiz ({myHand.length}) •{' '}
                          {isMyTurn ? (
                            <span style={{ color: '#10b981' }}>⚡ SIZNING NAVBATINGIZ!</span>
                          ) : (
                            <span style={{ color: 'var(--x-text-muted)' }}>Kutilmoqda...</span>
                          )}
                        </div>

                        {myHand.length === 2 && (
                          <button type="button" className="xuno-uno-shout-btn" onClick={handleShoutUno}>
                            🔥 UNO!
                          </button>
                        )}
                      </div>

                      <div className="xuno-hand-fan">
                        {myHand.map((card) => {
                          const playable = isMyTurn && isCardPlayable(card, topCard, activeRoom.activeColor);
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => handleCardClick(card)}
                              className={`xuno-hand-card-btn ${playable ? 'is-playable' : 'is-disabled'}`}
                            >
                              <div className={`xuno-card color-${card.color}`}>
                                <span className="xuno-card-corner tl">{formatCardSymbol(card.value)}</span>
                                <div className="xuno-card-inner">{formatCardSymbol(card.value)}</div>
                                <span className="xuno-card-corner br">{formatCardSymbol(card.value)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Jonli Chat & Tezkor Emotsiyalar */}
                  <aside className="xuno-sidebar-panel">
                    <h3 style={{ margin: 0 }}>💬 Jonli Arena Chati</h3>
                    <div className="xuno-chat-log">
                      {activeRoom.chat.map((m) => (
                        <div key={m.id}>
                          <strong style={{ color: m.sender === ADMIN_USERNAME ? '#fbbf24' : '#00d2ff' }}>
                            {m.sender}:
                          </strong>{' '}
                          <span>{m.text}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {QUICK_EMOTES.map((em) => (
                        <button
                          key={em}
                          type="button"
                          className="xuno-icon-btn"
                          onClick={() => handleSendChat(em)}
                        >
                          {em}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="xuno-input"
                        placeholder="Xabar yozing..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      />
                      <button type="button" className="xuno-nav-btn is-active" onClick={() => handleSendChat()}>
                        ➤
                      </button>
                    </div>
                  </aside>
                </div>
              )}

              {/* Wild Rang Tanlash Modali */}
              {pendingWildCard && (
                <div className="xuno-victory-overlay">
                  <div className="xuno-victory-card" style={{ maxWidth: '400px' }}>
                    <h3 style={{ marginTop: 0 }}>🎨 Kiber-Rangni Tanlang</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {UNO_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const card = pendingWildCard;
                            setPendingWildCard(null);
                            executeCardPlay(card, c.id);
                          }}
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            border: '2px solid #fff',
                            background: c.hex,
                            color: '#fff',
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* O'yin Tugashi (Victory / Outro Reveal) */}
              {activeRoom?.status === 'FINISHED' && (
                <div className="xuno-victory-overlay">
                  <div className="xuno-victory-card">
                    <div style={{ fontSize: '42px', marginBottom: '8px' }}>🏆⚡</div>
                    <h1 style={{ margin: '0 0 8px', color: '#fbbf24' }}>X UNO G‘OLIBI!</h1>
                    <h2 style={{ margin: '0 0 18px', color: '#00d2ff' }}>{activeRoom.winner}</h2>
                    <div style={{ display: 'grid', gap: '8px', marginBottom: '20px', textAlign: 'left' }}>
                      {activeRoom.players.map((p) => (
                        <div
                          key={p.username}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <span>
                            {p.username} {p.username === activeRoom.winner ? '👑 (+250 Coin)' : ''}
                          </span>
                          <span>Qolgan kartalar: {(activeRoom.hands?.[p.username] || []).length}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="xuno-primary-btn"
                      onClick={() => setActiveTab('LOBBY')}
                    >
                      🌐 LOBBIGA QAYTISH
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================================
           * 3. DO'KON & CASE OPENING (ProductCard.jsx)
           * ================================================================== */}
          {activeTab === 'SHOP' && (
            <ArmoryShopSection
              userCoins={currentUser.coins}
              isAdmin={isSuperAdmin}
              ownedIds={currentUser.ownedSkins}
              equippedCardBack={currentUser.equippedCardBack}
              equippedVictoryFx={currentUser.equippedVictoryFx}
              onBuy={handleBuySkin}
              onEquip={handleEquipSkin}
              onUnboxReward={handleUnboxReward}
              playSfx={(name) => playNeonSfx(name, muted)}
            />
          )}

          {/* ==================================================================
           * 4. PREMIUM LEADERBOARD
           * ================================================================== */}
          {activeTab === 'LEADERBOARD' && (
            <div style={{ overflowX: 'auto' }}>
              <table className="xuno-leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>O‘yinchi</th>
                    <th>G‘alabalar</th>
                    <th>Aniqlik %</th>
                    <th>Reyting</th>
                    <th>Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardList.map((u, idx) => {
                    const isAdm = u.username === ADMIN_USERNAME && u.isAdmin;
                    const acc = u.games ? Math.round(((u.wins || 0) / u.games) * 100) : 0;
                    return (
                      <tr
                        key={u.username}
                        className={`xuno-leaderboard-row ${isAdm ? 'is-admin-row' : idx < 3 ? 'is-top-rank' : ''}`}
                        onClick={() => setInspectProfileUser(u)}
                      >
                        <td style={{ fontWeight: 900 }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <RealisticTacticalAvatar seed={u.username} isAdmin={isAdm} size={38} />
                            <span style={{ fontWeight: 800 }}>
                              {u.username} {isAdm && '👑 ✓'}
                            </span>
                          </div>
                        </td>
                        <td>{u.wins || 0}</td>
                        <td>{acc}%</td>
                        <td style={{ color: '#00d2ff', fontWeight: 900 }}>{u.rating || 1000}</td>
                        <td style={{ color: 'var(--x-text-muted)', fontSize: '12px' }}>{u.joinedAt || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ==================================================================
           * 5. BOSH ADMIN PANELI (MUTLAQ FAQAT XVIP_404)
           * ================================================================== */}
          {activeTab === 'ADMIN' && isSuperAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
              <div className="xuno-sidebar-panel">
                <h3 style={{ margin: 0, color: '#fbbf24' }}>👁️ Rentgen (X-Ray) & Arena Nazorati</h3>
                <button
                  type="button"
                  className={`xuno-nav-btn ${xrayEnabled ? 'is-active' : ''}`}
                  onClick={() => setXrayEnabled((v) => !v)}
                >
                  {xrayEnabled ? '👁️ RENTGEN YOQILGAN (O‘CHIRISH)' : '👁️ RENTGENNI YOQISH'}
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    className="xuno-input"
                    value={adminTurnSecondsInput}
                    onChange={(e) => setAdminTurnSecondsInput(e.target.value)}
                    placeholder="Navbat vaqti (sek)"
                  />
                </div>
                <input
                  type="text"
                  className="xuno-input"
                  placeholder="Global E'lon matni..."
                  value={adminGlobalMsgInput}
                  onChange={(e) => setAdminGlobalMsgInput(e.target.value)}
                />
                <button type="button" className="xuno-primary-btn" onClick={handleAdminGlobalBanner}>
                  📢 GLOBAL E’LON CHIQARISH
                </button>
              </div>

              <div className="xuno-sidebar-panel">
                <h3 style={{ margin: 0, color: '#00d2ff' }}>🪙 Coin & Promo-Kod Boshqaruvi</h3>
                <input
                  type="text"
                  className="xuno-input"
                  placeholder="O'yinchi logini"
                  value={adminTargetUser}
                  onChange={(e) => setAdminTargetUser(e.target.value)}
                />
                <input
                  type="number"
                  className="xuno-input"
                  placeholder="Coin miqdori"
                  value={adminCoinAmount}
                  onChange={(e) => setAdminCoinAmount(e.target.value)}
                />
                <button type="button" className="xuno-nav-btn is-active" onClick={handleAdminGiveCoins}>
                  💸 COIN TARQATISH
                </button>

                <hr style={{ width: '100%', borderColor: 'var(--x-border)' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="xuno-input"
                    placeholder="Yangi Promo-kod"
                    value={adminNewPromoCode}
                    onChange={(e) => setAdminNewPromoCode(e.target.value)}
                  />
                  <input
                    type="number"
                    className="xuno-input"
                    style={{ width: '100px' }}
                    value={adminNewPromoCoins}
                    onChange={(e) => setAdminNewPromoCoins(e.target.value)}
                  />
                </div>
                <button type="button" className="xuno-nav-btn is-admin-tab" onClick={handleAdminCreatePromo}>
                  🎁 PROMO-KOD YARATISH
                </button>
              </div>

              <div className="xuno-sidebar-panel">
                <h3 style={{ margin: 0, color: '#ff1e56' }}>🛡️ O‘yinchilarni Boshqarish (Ban/Kick)</h3>
                <div style={{ display: 'grid', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {Object.values(usersMap)
                    .filter((u) => u.username !== ADMIN_USERNAME)
                    .map((u) => (
                      <div
                        key={u.username}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          background: 'var(--x-surface)',
                          borderRadius: '8px',
                        }}
                      >
                        <span>
                          {u.username} ({u.coins} 🪙)
                        </span>
                        <button
                          type="button"
                          className="xuno-icon-btn"
                          style={{ borderColor: '#ff1e56', color: '#ff1e56' }}
                          onClick={() => handleAdminToggleBan(u.username)}
                        >
                          {u.banned ? '🔓 Ochish' : '⛔ Ban'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* INTERAKTIV PROFIL MODALI */}
      {inspectProfileUser && (
        <div className="xuno-victory-overlay" onClick={() => setInspectProfileUser(null)}>
          <div className="xuno-victory-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left' }}>
              <RealisticTacticalAvatar
                seed={inspectProfileUser.username}
                isAdmin={inspectProfileUser.username === ADMIN_USERNAME && inspectProfileUser.isAdmin}
                size={84}
              />
              <div>
                <h2 style={{ margin: 0 }}>
                  {inspectProfileUser.username}{' '}
                  {inspectProfileUser.username === ADMIN_USERNAME && inspectProfileUser.isAdmin && '👑 ✓'}
                </h2>
                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                  Reyting: {inspectProfileUser.rating || 1000} • G‘alabalar: {inspectProfileUser.wins || 0}
                </div>
                <div style={{ color: '#fbbf24', fontSize: '13px', marginTop: '4px', fontWeight: 800 }}>
                  🪙 {inspectProfileUser.username === ADMIN_USERNAME ? '∞' : inspectProfileUser.coins || 0} Coin
                </div>
              </div>
            </div>

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '110px', height: '158px' }}>
                <CardBackArtwork
                  artworkType={
                    UNO_SKIN_CATALOG.find((s) => s.id === inspectProfileUser.equippedCardBack)?.artworkType || 'steel'
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className="xuno-primary-btn"
              style={{ marginTop: '18px' }}
              onClick={() => setInspectProfileUser(null)}
            >
              YOPISH
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
