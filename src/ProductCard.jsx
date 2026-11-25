import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

/**
 * ============================================================================
 * 🃏 X UNO — CYBERPUNK ARMORY, SKINS & CS/PUBG CASE OPENING MODULE (ProductCard.jsx)
 * ============================================================================
 * Xavfsizlik Qoidasi:
 * - Ushbu modulda hech qachon Admin huquqlari, Oltin Toj (👑), Ko'k Ptichka (✓)
 *   yoki Cheksiz Coin (∞) sotilmaydi va sandiqdan chiqmaydi.
 * - Barcha xaridlar server/imzo tekshiruviga tayyor ID va narx validatsiyasi
 *   orqali amalga oshiriladi.
 * - Barcha qidiruv va matn maydonlari XSS dan tozalanadi.
 */

// XSS Sanitization helper
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>/"'`&]/g, (ch) => {
      const map = {
        '<': '&lt;',
        '>': '&gt;',
        '/': '&#x2F;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;',
        '&': '&amp;',
      };
      return map[ch] || ch;
    })
    .trim()
    .slice(0, 64);
};

// Web Audio API fallback synthesizer (agar tashqi playSfx berilmasa)
const internalSfx = (type = 'hover') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.__xUnoAudioCtx) {
      window.__xUnoAudioCtx = new AudioCtx();
    }
    const ctx = window.__xUnoAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'hover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'tick') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.03);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'equip') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'unbox') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.07);
        g.gain.setValueAtTime(0.08, now + idx * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.07);
        o.stop(now + idx * 0.07 + 0.36);
      });
    } else if (type === 'error') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    }
  } catch {
    // Audio blocked by browser policy
  }
};

// Rarity Tier konfiguratsiyasi (CS:GO / PUBG daraja tizimi)
export const RARITY_CONFIG = {
  STANDARD: {
    id: 'STANDARD',
    label: 'STANDART PO‘LAT',
    badge: 'BEPUL',
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.35)',
    gradient: 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
    chance: 45,
  },
  RARE: {
    id: 'RARE',
    label: 'NEON TAKTIK',
    badge: 'NODIR',
    color: '#00d2ff',
    glow: 'rgba(0, 210, 255, 0.5)',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #00d2ff 50%, #0f172a 100%)',
    chance: 30,
  },
  EPIC: {
    id: 'EPIC',
    label: 'KIBER ZUMRAD',
    badge: 'EPIK',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.55)',
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #064e3b 100%)',
    chance: 15,
  },
  LEGENDARY: {
    id: 'LEGENDARY',
    label: 'OLTIN IMPERIYA',
    badge: 'AFSONAVIY',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.65)',
    gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 50%, #451a03 100%)',
    chance: 7,
  },
  MYTHIC: {
    id: 'MYTHIC',
    label: 'QONLI JOKER / AJDARHO',
    badge: 'MIFIK',
    color: '#ff1e56',
    glow: 'rgba(255, 30, 86, 0.75)',
    gradient: 'linear-gradient(135deg, #9f1239 0%, #ff1e56 48%, #00d2ff 100%)',
    chance: 3,
  },
};

// To'liq Karta Skinlari, Stol Effektlari va G'alaba Animatsiyalari Katalogi
export const UNO_SKIN_CATALOG = [
  {
    id: 'skin_steel_default',
    name: 'Po‘lat Taktik (Standart)',
    category: 'CARD_BACK',
    rarity: 'STANDARD',
    price: 0,
    isDefaultFree: true,
    floatValue: '0.1500 • Standart',
    edition: 'X-UNO Base Issue',
    description:
      'Qora mat metall va po‘lat chiziqli standart karta orqasi. Barcha o‘yinchilar uchun mutlaqo bepul.',
    accentColor: '#94a3b8',
    secondaryColor: '#475569',
    artworkType: 'steel',
    statsBonus: 'Bazaviy Taktik Ko‘rinish',
  },
  {
    id: 'fx_steel_default',
    name: 'Standart Stol Impulsi',
    category: 'VICTORY_FX',
    rarity: 'STANDARD',
    price: 0,
    isDefaultFree: true,
    floatValue: '0.1200 • Standart',
    edition: 'X-UNO Base Issue',
    description:
      'G‘alaba qozonganda klassik kiber-chiziqli to‘lqin effekti. Hamma uchun ochiq.',
    accentColor: '#94a3b8',
    secondaryColor: '#334155',
    artworkType: 'fx_pulse',
    statsBonus: 'Klassik G‘alaba To‘lqini',
  },
  {
    id: 'skin_cyber_neon',
    name: 'Neon Kiber-Matritsa',
    category: 'CARD_BACK',
    rarity: 'RARE',
    price: 450,
    isDefaultFree: false,
    floatValue: '0.0341 • Factory New',
    edition: 'Cyber Grid Series #01',
    description:
      'Yuqori voltli moviy neon (#00d2ff) lazer to‘ri va raqamli mikrosxema gravirovkasi.',
    accentColor: '#00d2ff',
    secondaryColor: '#0284c7',
    artworkType: 'cyber_neon',
    statsBonus: '+100% Kiber-Nur Effekti',
  },
  {
    id: 'skin_toxic_emerald',
    name: 'Zaharli Zumrad Reaktor',
    category: 'CARD_BACK',
    rarity: 'EPIC',
    price: 950,
    isDefaultFree: false,
    floatValue: '0.0189 • Factory New',
    edition: 'Bio-Hazard Vault',
    description:
      'Yashil plazma yadrosi va geksagonal kiber-qalqon bilan himoyalangan epik karta orqasi.',
    accentColor: '#10b981',
    secondaryColor: '#047857',
    artworkType: 'emerald_hex',
    statsBonus: 'Plazma Pulsatsiya Animatsiyasi',
  },
  {
    id: 'skin_imperial_gold',
    name: 'Oltin Imperiya Gravirovkasi',
    category: 'CARD_BACK',
    rarity: 'LEGENDARY',
    price: 2200,
    isDefaultFree: false,
    floatValue: '0.0042 • Souvenir',
    edition: 'Royal Sovereign Gold',
    description:
      '24-karatli kiber-oltin naqshlar va yaltiroq golografik zarba chizig‘iga ega afsonaviy skin.',
    accentColor: '#fbbf24',
    secondaryColor: '#d97706',
    artworkType: 'imperial_gold',
    statsBonus: 'Golografik Oltin Yaltirash',
  },
  {
    id: 'skin_crimson_dragon',
    name: 'Qonli Ajdarho (Crimson Dragon)',
    category: 'CARD_BACK',
    rarity: 'MYTHIC',
    price: 4500,
    isDefaultFree: false,
    floatValue: '0.0008 • StatTrak™',
    edition: 'Mythic Dragon Lore',
    description:
      'Qizil-pushti neon (#ff1e56) alangali ajdarho tangachalari va qilich kesimi gravirovkasi.',
    accentColor: '#ff1e56',
    secondaryColor: '#fbbf24',
    artworkType: 'crimson_dragon',
    statsBonus: 'Olovli Zarracha & Ajdarho Soya',
  },
  {
    id: 'skin_joker_engraved',
    name: 'Ayyor Joker +4 (Gravirovka)',
    category: 'CARD_BACK',
    rarity: 'MYTHIC',
    price: 5500,
    isDefaultFree: false,
    floatValue: '0.0001 • Collectors',
    edition: 'X-UNO Signature Series',
    description:
      'Yarim moviy, yarim qonli-qizil kiberpank Joker niqobi va +4 chaqmoq muhriga ega eng oliy karta skini.',
    accentColor: '#ff1e56',
    secondaryColor: '#00d2ff',
    artworkType: 'joker_engraved',
    statsBonus: 'Ikki Rangli Neon Split Aura',
  },
  {
    id: 'fx_neon_shockwave',
    name: 'Neon Chaqmoq Portlashi',
    category: 'VICTORY_FX',
    rarity: 'EPIC',
    price: 1200,
    isDefaultFree: false,
    floatValue: '0.0210 • Factory New',
    edition: 'Arena FX Pack',
    description:
      'Oxirgi kartani tashlaganingizda butun 3D stol bo‘ylab moviy va pushti chaqmoq zarbasi tarqaladi.',
    accentColor: '#00d2ff',
    secondaryColor: '#ff1e56',
    artworkType: 'fx_shockwave',
    statsBonus: '3D Stol Chaqmoq Zarbasi',
  },
  {
    id: 'fx_dragon_inferno',
    name: 'Oltin & Ajdarho Yomg‘iri',
    category: 'VICTORY_FX',
    rarity: 'MYTHIC',
    price: 3800,
    isDefaultFree: false,
    floatValue: '0.0005 • Mythic FX',
    edition: 'Championship FX',
    description:
      'G‘alaba vaqtida ekranda neon konfetti, oltin uchqunlar va "X UNO G‘OLIBI" gologrammasi yonadi.',
    accentColor: '#fbbf24',
    secondaryColor: '#ff1e56',
    artworkType: 'fx_inferno',
    statsBonus: 'Mifik G‘alaba Konfetti & Ovoz',
  },
];

// Karta Sandiqlari (CS:GO Case Opening uchun)
export const CASE_CRATES = [
  {
    id: 'crate_cyber_supply',
    name: 'Kiber Ta’minot Sandig‘i',
    subtitle: 'Cyber Supply Case v2.4',
    price: 400,
    accent: '#00d2ff',
    badge: 'MASHHUR',
    poolIds: [
      'skin_steel_default',
      'skin_cyber_neon',
      'skin_toxic_emerald',
      'fx_neon_shockwave',
      'skin_imperial_gold',
      'skin_crimson_dragon',
    ],
  },
  {
    id: 'crate_joker_vault',
    name: 'Qonli Joker Maxfiy Seyfi',
    subtitle: 'Mythic Joker & Dragon Vault',
    price: 1100,
    accent: '#ff1e56',
    badge: 'YUQORI IMKONIYAT',
    poolIds: [
      'skin_cyber_neon',
      'skin_toxic_emerald',
      'skin_imperial_gold',
      'fx_neon_shockwave',
      'skin_crimson_dragon',
      'skin_joker_engraved',
      'fx_dragon_inferno',
    ],
  },
];

/**
 * Yuqori detallashgan SVG Karta Orqasi / Effekt San'ati (Zero external images)
 */
export const CardBackArtwork = ({ artworkType = 'steel', className = '' }) => {
  switch (artworkType) {
    case 'cyber_neon':
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="cnBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#041226" />
              <stop offset="50%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id="cnStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00d2ff" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <rect width="160" height="230" rx="14" fill="url(#cnBg)" />
          <path d="M14 14 H146 V216 H14 Z" fill="none" stroke="url(#cnStroke)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" />
          <g stroke="#00d2ff" strokeWidth="1" opacity="0.35">
            <line x1="0" y1="45" x2="160" y2="45" />
            <line x1="0" y1="185" x2="160" y2="185" />
            <line x1="40" y1="0" x2="40" y2="230" />
            <line x1="120" y1="0" x2="120" y2="230" />
          </g>
          <polygon points="80,44 128,115 80,186 32,115" fill="rgba(0,210,255,0.08)" stroke="#00d2ff" strokeWidth="2" />
          <polygon points="80,62 112,115 80,168 48,115" fill="rgba(0,210,255,0.16)" stroke="#7dd3fc" strokeWidth="1.2" />
          <text x="80" y="121" textAnchor="middle" fill="#e0f2fe" fontSize="22" fontWeight="900" letterSpacing="2" fontFamily="monospace">
            X-UNO
          </text>
          <circle cx="28" cy="28" r="4" fill="#00d2ff" />
          <circle cx="132" cy="202" r="4" fill="#00d2ff" />
        </svg>
      );

    case 'emerald_hex':
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="emRad" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#064e3b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#022c22" />
            </radialGradient>
          </defs>
          <rect width="160" height="230" rx="14" fill="url(#emRad)" />
          <rect x="10" y="10" width="140" height="210" rx="10" fill="none" stroke="#10b981" strokeWidth="2" />
          <polygon points="80,52 122,76 122,154 80,178 38,154 38,76" fill="rgba(16,185,129,0.12)" stroke="#34d399" strokeWidth="2" />
          <polygon points="80,72 106,88 106,142 80,158 54,142 54,88" fill="rgba(16,185,129,0.2)" stroke="#6ee7b7" strokeWidth="1.2" />
          <circle cx="80" cy="115" r="18" fill="#022c22" stroke="#10b981" strokeWidth="2" />
          <text x="80" y="121" textAnchor="middle" fill="#6ee7b7" fontSize="16" fontWeight="900" fontFamily="monospace">
            +4
          </text>
        </svg>
      );

    case 'imperial_gold':
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="goldBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1c1204" />
              <stop offset="50%" stopColor="#451a03" />
              <stop offset="100%" stopColor="#0c0a09" />
            </linearGradient>
            <linearGradient id="goldRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <rect width="160" height="230" rx="14" fill="url(#goldBg)" />
          <rect x="10" y="10" width="140" height="210" rx="10" fill="none" stroke="url(#goldRim)" strokeWidth="2.5" />
          <path d="M22 22 L42 22 L22 42 Z M138 22 L118 22 L138 42 Z M22 208 L42 208 L22 188 Z M138 208 L118 208 L138 188 Z" fill="#fbbf24" opacity="0.85" />
          <ellipse cx="80" cy="115" rx="46" ry="72" fill="rgba(251,191,36,0.08)" stroke="url(#goldRim)" strokeWidth="2" transform="rotate(-14 80 115)" />
          <text x="80" y="110" textAnchor="middle" fill="#fde68a" fontSize="22" fontWeight="900" letterSpacing="1" fontFamily="serif">
            IMPERIAL
          </text>
          <text x="80" y="132" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="800" letterSpacing="4" fontFamily="monospace">
            X-UNO
          </text>
        </svg>
      );

    case 'crimson_dragon':
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="drgBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2a0410" />
              <stop offset="55%" stopColor="#4c0519" />
              <stop offset="100%" stopColor="#090205" />
            </linearGradient>
          </defs>
          <rect width="160" height="230" rx="14" fill="url(#drgBg)" />
          <rect x="9" y="9" width="142" height="212" rx="10" fill="none" stroke="#ff1e56" strokeWidth="2" />
          <path d="M35 170 C30 120, 60 85, 85 60 C105 40, 130 65, 118 95 C106 125, 132 140, 115 175 C100 155, 75 160, 58 182 Z" fill="rgba(255,30,86,0.22)" stroke="#ff1e56" strokeWidth="2" />
          <path d="M55 95 L80 75 L105 95 L90 128 L70 128 Z" fill="rgba(251,191,36,0.18)" stroke="#fbbf24" strokeWidth="1.5" />
          <circle cx="72" cy="96" r="3" fill="#fbbf24" />
          <circle cx="88" cy="96" r="3" fill="#fbbf24" />
          <text x="80" y="198" textAnchor="middle" fill="#fda4af" fontSize="13" fontWeight="900" letterSpacing="3" fontFamily="monospace">
            DRAGON LORE
          </text>
        </svg>
      );

    case 'joker_engraved':
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="jkSplit" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00d2ff" />
              <stop offset="49%" stopColor="#00d2ff" />
              <stop offset="51%" stopColor="#ff1e56" />
              <stop offset="100%" stopColor="#ff1e56" />
            </linearGradient>
          </defs>
          <rect width="160" height="230" rx="14" fill="#07080f" />
          <path d="M0 0 H80 V230 H0 Z" fill="rgba(0,210,255,0.1)" />
          <path d="M80 0 H160 V230 H80 Z" fill="rgba(255,30,86,0.1)" />
          <rect x="8" y="8" width="144" height="214" rx="11" fill="none" stroke="url(#jkSplit)" strokeWidth="2.5" />
          {/* Kiber Joker toj va niqob */}
          <path d="M44 74 L58 50 L80 68 L102 50 L116 74 L108 135 L80 156 L52 135 Z" fill="#0f172a" stroke="url(#jkSplit)" strokeWidth="2.2" />
          {/* Ayyor ko'zlar */}
          <polygon points="56,94 72,102 58,108" fill="#00d2ff" />
          <polygon points="104,94 88,102 102,108" fill="#ff1e56" />
          {/* Ayyor tabassum */}
          <path d="M56 122 Q80 144 104 122 Q80 132 56 122 Z" fill="url(#jkSplit)" />
          <text x="80" y="186" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900" letterSpacing="2" fontFamily="monospace">
            X UNO +4
          </text>
        </svg>
      );

    case 'fx_shockwave':
    case 'fx_inferno':
    case 'fx_pulse':
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <rect width="160" height="230" rx="14" fill="#090d16" />
          <circle cx="80" cy="115" r="62" fill="none" stroke={artworkType === 'fx_inferno' ? '#fbbf24' : artworkType === 'fx_shockwave' ? '#00d2ff' : '#94a3b8'} strokeWidth="2" strokeDasharray="8 4" />
          <circle cx="80" cy="115" r="42" fill="none" stroke={artworkType === 'fx_inferno' ? '#ff1e56' : artworkType === 'fx_shockwave' ? '#ff1e56' : '#64748b'} strokeWidth="2.5" />
          <polygon points="80,68 92,105 128,115 92,125 80,162 68,125 32,115 68,105" fill={artworkType === 'fx_inferno' ? 'rgba(251,191,36,0.3)' : 'rgba(0,210,255,0.22)'} stroke="#ffffff" strokeWidth="1.5" />
          <text x="80" y="205" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="800" letterSpacing="2" fontFamily="monospace">
            VICTORY FX
          </text>
        </svg>
      );

    case 'steel':
    default:
      return (
        <svg viewBox="0 0 160 230" className={className} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="stBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <rect width="160" height="230" rx="14" fill="url(#stBg)" />
          <rect x="12" y="12" width="136" height="206" rx="9" fill="none" stroke="#475569" strokeWidth="2" />
          <line x1="12" y1="50" x2="148" y2="50" stroke="#334155" strokeWidth="1.5" />
          <line x1="12" y1="180" x2="148" y2="180" stroke="#334155" strokeWidth="1.5" />
          <circle cx="80" cy="115" r="36" fill="rgba(148,163,184,0.08)" stroke="#64748b" strokeWidth="2" />
          <text x="80" y="121" textAnchor="middle" fill="#cbd5e1" fontSize="17" fontWeight="900" letterSpacing="2" fontFamily="monospace">
            X UNO
          </text>
        </svg>
      );
  }
};

/**
 * 3D Karta Tekshirish Modali (CS:GO Inspect Weapon uslubida 360° aylantirish)
 */
export const SkinInspectModal = ({ item, onClose, owned, equipped, onBuy, onEquip, userCoins, isAdmin }) => {
  const [rot, setRot] = useState({ x: 8, y: -16 });
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!item) return null;
  const rarity = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.STANDARD;
  const canAfford = isAdmin || item.isDefaultFree || userCoins >= item.price;

  const handlePointerDown = (e) => {
    setDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setRot((prev) => ({
      x: Math.max(-45, Math.min(45, prev.x - dy * 0.45)),
      y: prev.y + dx * 0.6,
    }));
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div
      className="xuno-inspect-backdrop"
      onClick={onClose}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3, 6, 15, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '780px',
          background: 'linear-gradient(160deg, #0b1120 0%, #05070e 100%)',
          border: `1.5px solid ${rarity.color}`,
          boxShadow: `0 0 50px ${rarity.glow}, inset 0 0 30px rgba(0,0,0,0.8)`,
          borderRadius: '18px',
          padding: '28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '28px',
          color: '#f8fafc',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          ✕
        </button>

        {/* 3D Aylanadigan Karta Sahnasi */}
        <div
          onPointerDown={handlePointerDown}
          style={{
            perspective: '1000px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
            borderRadius: '14px',
            border: '1px dashed rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              width: '175px',
              height: '250px',
              transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
              transformStyle: 'preserve-3d',
              transition: dragging ? 'none' : 'transform 0.25s ease-out',
              boxShadow: `0 25px 45px rgba(0,0,0,0.85), 0 0 28px ${rarity.glow}`,
              borderRadius: '14px',
            }}
          >
            <CardBackArtwork artworkType={item.artworkType} />
          </div>
          <span style={{ marginTop: '14px', fontSize: '11px', color: '#94a3b8', letterSpacing: '1px' }}>
            🖱️ 360° AYLANTIRISH UCHUN SURING
          </span>
        </div>

        {/* Texnik Ma'lumotlar va Harakat */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: rarity.glow,
                  color: '#fff',
                  border: `1px solid ${rarity.color}`,
                }}
              >
                {rarity.label}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                {item.category === 'VICTORY_FX' ? 'G‘ALABA EFFEKTI' : 'KARTA SKINI'}
              </span>
            </div>

            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#fff' }}>{item.name}</h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
              {item.description}
            </p>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '12px',
                display: 'grid',
                gap: '6px',
                fontFamily: 'monospace',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>FLOAT / SIFAT:</span>{' '}
                <span style={{ color: rarity.color }}>{item.floatValue}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>KOLLEKSIYA:</span>{' '}
                <span style={{ color: '#e2e8f0' }}>{item.edition}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>BONUS:</span>{' '}
                <span style={{ color: '#10b981' }}>{item.statsBonus}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {owned || item.isDefaultFree ? (
              <button
                type="button"
                disabled={equipped}
                onClick={() => {
                  internalSfx('equip');
                  onEquip?.(item);
                }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: equipped ? '#1e293b' : 'linear-gradient(90deg, #10b981, #059669)',
                  color: equipped ? '#94a3b8' : '#fff',
                  fontWeight: 800,
                  cursor: equipped ? 'default' : 'pointer',
                  letterSpacing: '0.5px',
                }}
              >
                {equipped ? '✓ JIHOZLANGAN (FAOL)' : '⚡ SKINNI JIHOZLASH'}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => {
                  if (!canAfford) {
                    internalSfx('error');
                    return;
                  }
                  internalSfx('equip');
                  onBuy?.(item);
                }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: canAfford
                    ? 'linear-gradient(90deg, #00d2ff, #ff1e56)'
                    : 'rgba(100,116,139,0.3)',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                }}
              >
                {canAfford ? `🛒 SOTIB OLISH • ${item.price} COIN` : `🔒 YETARLI COIN YO‘Q (${item.price})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * CS:GO / PUBG Usulidagi Karta Sandig‘i (Case Opening Roulette)
 */
export const CaseOpeningRoulette = ({
  userCoins = 0,
  isAdmin = false,
  ownedIds = [],
  onUnboxReward,
  playSfx,
}) => {
  const [selectedCrate, setSelectedCrate] = useState(CASE_CRATES[0]);
  const [isSpinning, setIsSpinning] = useState(false);
  // Boshlang'ich ruletka lentasini tayyorlash
  const buildStrip = useCallback((crate) => {
    const pool = crate.poolIds
      .map((id) => UNO_SKIN_CATALOG.find((s) => s.id === id))
      .filter(Boolean);

    const pickWeighted = () => {
      const weights = pool.map((item) => RARITY_CONFIG[item.rarity]?.chance || 10);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < pool.length; i += 1) {
        r -= weights[i];
        if (r <= 0) return pool[i];
      }
      return pool[0];
    };

    const arr = [];
    for (let i = 0; i < 46; i += 1) {
      arr.push({ ...pickWeighted(), _slotKey: `${crate.id}_${i}_${Math.random()}` });
    }
    return arr;
  }, []);

  const [stripItems, setStripItems] = useState(() => buildStrip(CASE_CRATES[0]));
  const [translateX, setTranslateX] = useState(0);
  const [wonItem, setWonItem] = useState(null);
  const [transitionCss, setTransitionCss] = useState('none');
  const tickIntervalRef = useRef(null);

  const sfx = useCallback(
    (name) => {
      if (typeof playSfx === 'function') playSfx(name);
      else internalSfx(name);
    },
    [playSfx]
  );

  const handleSelectCrate = (crate) => {
    if (isSpinning) return;
    setSelectedCrate(crate);
    setStripItems(buildStrip(crate));
    setTranslateX(0);
    setTransitionCss('none');
    setWonItem(null);
  };

  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, []);

  const handleOpenCase = () => {
    if (isSpinning) return;
    if (!isAdmin && userCoins < selectedCrate.price) {
      sfx('error');
      return;
    }

    const freshStrip = buildStrip(selectedCrate);
    const winningIndex = 36; // Lazer chizig'i to'xtaydigan aniq indeks
    const reward = freshStrip[winningIndex];

    setWonItem(null);
    setTransitionCss('none');
    setStripItems(freshStrip);
    setTranslateX(0);
    setIsSpinning(true);

    // Karta slot kengligi: 128px + 10px gap = 138px
    const slotWidth = 138;
    const jitter = Math.floor(Math.random() * 54) - 27;
    const targetOffset = -(winningIndex * slotWidth - 220 + jitter);

    // Tick ovoz effekti sekinlashuvchi intervalda
    let ticks = 0;
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      ticks += 1;
      if (ticks < 28) sfx('tick');
    }, 135);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionCss('transform 4.6s cubic-bezier(0.08, 0.85, 0.14, 1)');
        setTranslateX(targetOffset);
      });
    });

    setTimeout(() => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      setIsSpinning(false);
      setWonItem(reward);
      sfx('unbox');
      onUnboxReward?.(reward, selectedCrate.price);
    }, 4750);
  };

  const canSpin = !isSpinning && (isAdmin || userCoins >= selectedCrate.price);

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(11,17,32,0.95), rgba(5,8,18,0.98))',
        border: `1.5px solid ${selectedCrate.accent}`,
        boxShadow: `0 0 32px ${selectedCrate.accent}33`,
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: selectedCrate.accent, fontWeight: 800, letterSpacing: '1.5px' }}>
            📦 CS / PUBG KARTA SANDIG‘I RULETKASI
          </div>
          <h3 style={{ margin: '4px 0 0 0', fontSize: '19px' }}>{selectedCrate.name}</h3>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CASE_CRATES.map((c) => {
            const active = c.id === selectedCrate.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={isSpinning}
                onClick={() => handleSelectCrate(c)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: `1px solid ${active ? c.accent : 'rgba(255,255,255,0.14)'}`,
                  background: active ? `${c.accent}22` : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: isSpinning ? 'not-allowed' : 'pointer',
                }}
              >
                {c.name} ({c.price} 🪙)
              </button>
            );
          })}
        </div>
      </div>

      {/* Ruletka Oyna */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: '168px',
          borderRadius: '12px',
          background: '#03060d',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Markaziy Lazer Chizig'i */}
        <div
          style={{
            position: 'absolute',
            left: '284px',
            top: 0,
            bottom: 0,
            width: '3px',
            background: 'linear-gradient(180deg, #ff1e56, #fbbf24, #00d2ff)',
            boxShadow: '0 0 14px #fbbf24',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: '10px',
            paddingLeft: '20px',
            transform: `translateX(${translateX}px)`,
            transition: transitionCss,
            willChange: 'transform',
          }}
        >
          {stripItems.map((slot) => {
            const r = RARITY_CONFIG[slot.rarity] || RARITY_CONFIG.STANDARD;
            return (
              <div
                key={slot._slotKey}
                style={{
                  width: '128px',
                  height: '138px',
                  flexShrink: 0,
                  borderRadius: '10px',
                  background: '#0f172a',
                  border: `1.5px solid ${r.color}`,
                  boxShadow: `inset 0 0 16px ${r.glow}`,
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ width: '58px', height: '82px' }}>
                  <CardBackArtwork artworkType={slot.artworkType} />
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#f8fafc',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                  }}
                >
                  {slot.name}
                </div>
                <div style={{ height: '3px', width: '70%', borderRadius: '2px', background: r.color }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Boshqaruv va Yutuq Paneli */}
      <div
        style={{
          marginTop: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
          {wonItem ? (
            <span style={{ color: RARITY_CONFIG[wonItem.rarity]?.color || '#fbbf24', fontWeight: 800 }}>
              🎉 TABRIKLAYMIZ! Yutuq: {wonItem.name}{' '}
              {ownedIds.includes(wonItem.id) ? '(Dublikat → +150 Coin qaytarildi!)' : '(Kolleksiyaga qo‘shildi!)'}
            </span>
          ) : (
            <span>
              Sandiq ichida: Neon, Oltin, Ajdarho va Mifik Joker skinlari. (Admin huquqlari sandiqdan chiqmaydi)
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!canSpin}
          onClick={handleOpenCase}
          style={{
            padding: '11px 22px',
            borderRadius: '10px',
            border: 'none',
            background: canSpin
              ? `linear-gradient(90deg, ${selectedCrate.accent}, #ff1e56)`
              : 'rgba(100,116,139,0.28)',
            color: '#fff',
            fontWeight: 900,
            fontSize: '13px',
            letterSpacing: '0.8px',
            cursor: canSpin ? 'pointer' : 'not-allowed',
            boxShadow: canSpin ? `0 0 20px ${selectedCrate.accent}55` : 'none',
          }}
        >
          {isSpinning
            ? '⚡ RULETKA AYLANMOQDA...'
            : isAdmin
              ? '👑 SANDIQNI OCHISH (BEPUL ADMIN)'
              : `🔓 SANDIQNI OCHISH (${selectedCrate.price} COIN)`}
        </button>
      </div>
    </div>
  );
};

/**
 * ASOSIY KOMPONENT: ProductCard
 * CS:GO / PUBG darajasidagi 3D-Tilt, ikki tomonlama aylanuvchi va interaktiv Karta Skini / Effekt Peshtaxtasi
 */
const ProductCard = ({
  item = UNO_SKIN_CATALOG[4],
  owned = false,
  equipped = false,
  userCoins = 0,
  isAdmin = false,
  onBuy,
  onEquip,
  onInspect,
  playSfx,
}) => {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [pulseAction, setPulseAction] = useState(false);

  const rarity = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.STANDARD;
  const isOwnedOrFree = owned || item.isDefaultFree;
  const canAfford = isAdmin || item.isDefaultFree || userCoins >= item.price;

  const triggerSfx = useCallback(
    (name) => {
      if (typeof playSfx === 'function') playSfx(name);
      else internalSfx(name);
    },
    [playSfx]
  );

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 16,
      ry: (px - 0.5) * 18,
      gx: Math.round(px * 100),
      gy: Math.round(py * 100),
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    triggerSfx('hover');
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  };

  const handlePrimaryClick = () => {
    if (isOwnedOrFree) {
      if (equipped) return;
      triggerSfx('equip');
      setPulseAction(true);
      setTimeout(() => setPulseAction(false), 450);
      onEquip?.(item);
    } else {
      if (!canAfford) {
        triggerSfx('error');
        return;
      }
      triggerSfx('equip');
      setPulseAction(true);
      setTimeout(() => setPulseAction(false), 450);
      onBuy?.(item);
    }
  };

  return (
    <article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`xuno-product-card ${equipped ? 'is-equipped' : ''} ${pulseAction ? 'is-pulsing' : ''}`}
      style={{
        position: 'relative',
        borderRadius: '16px',
        padding: '16px',
        background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.94) 0%, rgba(6, 9, 20, 0.98) 100%)',
        border: `1.5px solid ${equipped ? '#10b981' : isHovered ? rarity.color : 'rgba(255,255,255,0.12)'}`,
        boxShadow: isHovered
          ? `0 20px 40px rgba(0,0,0,0.7), 0 0 28px ${rarity.glow}`
          : equipped
            ? '0 0 22px rgba(16, 185, 129, 0.35)'
            : '0 10px 25px rgba(0,0,0,0.45)',
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${isHovered ? -6 : 0}px)`,
        transition: isHovered ? 'transform 0.08s ease-out, box-shadow 0.25s ease' : 'all 0.35s ease',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Dinamik Golografik Yaltirash (Cursor bilan harakatlanadi) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: isHovered ? 0.35 : 0.08,
          background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, ${rarity.color}, transparent 62%)`,
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Yuqori Rarity va Status Qatori */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 900,
            letterSpacing: '1px',
            padding: '3px 9px',
            borderRadius: '999px',
            background: `${rarity.color}22`,
            color: rarity.color,
            border: `1px solid ${rarity.color}`,
          }}
        >
          {rarity.badge}
        </span>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            title="Old / Orqa tomonini aylantirish"
            onClick={() => {
              triggerSfx('tick');
              setIsFlipped((v) => !v);
            }}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#cbd5e1',
              borderRadius: '6px',
              padding: '3px 7px',
              fontSize: '10px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ↻ 3D
          </button>
          <button
            type="button"
            title="360° Tekshirish (Inspect)"
            onClick={() => {
              triggerSfx('tick');
              onInspect?.(item);
            }}
            style={{
              background: 'rgba(0, 210, 255, 0.12)',
              border: '1px solid rgba(0, 210, 255, 0.4)',
              color: '#00d2ff',
              borderRadius: '6px',
              padding: '3px 7px',
              fontSize: '10px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            🔍 KO‘RISH
          </button>
        </div>
      </div>

      {/* 3D Karta Sahnasi (Old / Orqa Flip) */}
      <div
        style={{
          perspective: '800px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          cursor: 'pointer',
        }}
        onClick={() => {
          triggerSfx('tick');
          setIsFlipped((v) => !v);
        }}
      >
        <div
          style={{
            width: '116px',
            height: '166px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Karta Orqa Dizayni */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              borderRadius: '12px',
              boxShadow: `0 10px 24px rgba(0,0,0,0.6), 0 0 18px ${rarity.glow}`,
              overflow: 'hidden',
            }}
          >
            <CardBackArtwork artworkType={item.artworkType} />
          </div>

          {/* Karta Old Tomon (X UNO +4 Preview) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '12px',
              background: 'linear-gradient(145deg, #0f172a, #020617)',
              border: `2px solid ${item.accentColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              boxShadow: `0 0 20px ${rarity.glow}`,
            }}
          >
            <span style={{ fontSize: '10px', color: item.accentColor, fontWeight: 800 }}>X UNO PREVIEW</span>
            <span style={{ fontSize: '34px', fontWeight: 900, color: '#fff', textShadow: `0 0 14px ${item.accentColor}` }}>
              +4
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>{item.statsBonus}</span>
          </div>
        </div>
      </div>

      {/* Karta Nomi va Tavsifi */}
      <div style={{ zIndex: 2 }}>
        <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace', marginBottom: '2px' }}>
          {item.floatValue}
        </div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>{item.name}</h4>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: 1.45,
            minHeight: '35px',
          }}
        >
          {item.description}
        </p>
      </div>

      {/* Pastki Narx va Tugma */}
      <div
        style={{
          zIndex: 2,
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: '13.5px', color: item.isDefaultFree ? '#10b981' : '#fbbf24' }}>
          {item.isDefaultFree ? 'BEPUL' : `${item.price} 🪙`}
        </div>

        <button
          type="button"
          onClick={handlePrimaryClick}
          disabled={equipped || (!isOwnedOrFree && !canAfford)}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '9px',
            border: 'none',
            fontWeight: 800,
            fontSize: '12px',
            letterSpacing: '0.4px',
            cursor: equipped || (!isOwnedOrFree && !canAfford) ? 'not-allowed' : 'pointer',
            background: equipped
              ? 'rgba(16, 185, 129, 0.18)'
              : isOwnedOrFree
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : canAfford
                  ? `linear-gradient(90deg, ${rarity.color}, #ff1e56)`
                  : 'rgba(100,116,139,0.22)',
            color: equipped ? '#34d399' : '#fff',
          }}
        >
          {equipped
            ? '✓ FAOL SKIN'
            : isOwnedOrFree
              ? 'JIHOZLASH'
              : canAfford
                ? 'SOTIB OLISH'
                : 'COIN YETARLI EMAS'}
        </button>
      </div>
    </article>
  );
};

/**
 * To'liq Peshtaxta (Armory Shop + Filter + Case Opening + Inspect Modal)
 */
export const ArmoryShopSection = ({
  userCoins = 0,
  isAdmin = false,
  ownedIds = ['skin_steel_default', 'fx_steel_default'],
  equippedCardBack = 'skin_steel_default',
  equippedVictoryFx = 'fx_steel_default',
  onBuy,
  onEquip,
  onUnboxReward,
  playSfx,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectItem, setInspectItem] = useState(null);

  const filteredItems = useMemo(() => {
    const safeQuery = sanitizeInput(searchQuery).toLowerCase();
    return UNO_SKIN_CATALOG.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (
        safeQuery &&
        !item.name.toLowerCase().includes(safeQuery) &&
        !item.description.toLowerCase().includes(safeQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, searchQuery]);

  return (
    <section className="xuno-armory-section" style={{ width: '100%' }}>
      {/* CS/PUBG Karta Sandig'i Ruletkasi */}
      <CaseOpeningRoulette
        userCoins={userCoins}
        isAdmin={isAdmin}
        ownedIds={ownedIds}
        onUnboxReward={onUnboxReward}
        playSfx={playSfx}
      />

      {/* Peshtaxta Filtrlari */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'BARCHASI' },
            { id: 'CARD_BACK', label: '🃏 KARTA SKINLARI' },
            { id: 'VICTORY_FX', label: '⚡ G‘ALABA EFFEKTLARI' },
          ].map((tab) => {
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '9px',
                  border: `1px solid ${active ? '#00d2ff' : 'rgba(255,255,255,0.14)'}`,
                  background: active ? 'rgba(0, 210, 255, 0.16)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#00d2ff' : '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Skin yoki effekt qidirish..."
          maxLength={48}
          style={{
            padding: '9px 14px',
            borderRadius: '9px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(15,23,42,0.8)',
            color: '#fff',
            fontSize: '13px',
            minWidth: '220px',
          }}
        />
      </div>

      {/* Mahsulot Kartalari Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))',
          gap: '18px',
        }}
      >
        {filteredItems.map((item) => {
          const isEquipped =
            item.category === 'VICTORY_FX'
              ? equippedVictoryFx === item.id
              : equippedCardBack === item.id;
          return (
            <ProductCard
              key={item.id}
              item={item}
              owned={ownedIds.includes(item.id)}
              equipped={isEquipped}
              userCoins={userCoins}
              isAdmin={isAdmin}
              onBuy={onBuy}
              onEquip={onEquip}
              onInspect={(target) => setInspectItem(target)}
              playSfx={playSfx}
            />
          );
        })}
      </div>

      {/* 360° Inspect Modal */}
      {inspectItem && (
        <SkinInspectModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          owned={ownedIds.includes(inspectItem.id)}
          equipped={
            inspectItem.category === 'VICTORY_FX'
              ? equippedVictoryFx === inspectItem.id
              : equippedCardBack === inspectItem.id
          }
          userCoins={userCoins}
          isAdmin={isAdmin}
          onBuy={onBuy}
          onEquip={onEquip}
        />
      )}
    </section>
  );
};

export default ProductCard;
