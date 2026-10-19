/*  Rootocoon – the raccoon mascot.
 *  Drawn entirely in SVG code, so the costumes are just "layers" switched on and off.
 *  raccoonSVG("stuffed") gives you, for example, the raccoon with a huge belly.
 */
const C = {
  fur: "#8b919b", dark: "#33373f", light: "#ece8e0", belly: "#cdc8be",
  pink: "#f2a3ae", nose: "#1f2228",
};

// Eyes for different moods
function eyes(kind) {
  const L = 76, R = 124, Y = 84;
  const pair = (fn) => fn(L) + fn(R);
  switch (kind) {
    case "happy": // ^ ^
      return pair((x) => `<path d="M${x - 7} ${Y + 2} Q${x} ${Y - 7} ${x + 7} ${Y + 2}" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
    case "squeeze": // > <
      return `<path d="M${L - 7} ${Y - 5} L${L + 5} ${Y} L${L - 7} ${Y + 5}" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M${R + 7} ${Y - 5} L${R - 5} ${Y} L${R + 7} ${Y + 5}" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "swirl": // confused
      return pair((x) => `<circle cx="${x}" cy="${Y}" r="9" fill="#fff"/>
        <path d="M${x} ${Y} m-1 0 a1.5 1.5 0 1 1 3 0 a3.5 3.5 0 1 1 -7 0 a5.5 5.5 0 1 1 11 0" stroke="${C.nose}" stroke-width="1.8" fill="none" class="spin"/>`);
    case "squint": // suspicious detective
      return `<circle cx="${L}" cy="${Y}" r="8" fill="#fff"/><circle cx="${L + 1}" cy="${Y + 1}" r="4.5" fill="${C.nose}"/>
              <rect x="${L - 10}" y="${Y - 11}" width="20" height="8" fill="${C.dark}"/>
              <path d="M${R - 7} ${Y} L${R + 7} ${Y}" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`;
    case "focus":
      return pair((x) => `<circle cx="${x}" cy="${Y}" r="8" fill="#fff"/><circle cx="${x}" cy="${Y + 2}" r="4.5" fill="${C.nose}"/>
        <rect x="${x - 10}" y="${Y - 11}" width="20" height="7" fill="${C.dark}"/>`);
    case "sad":
      return pair((x) => `<circle cx="${x}" cy="${Y}" r="8" fill="#fff"/><circle cx="${x}" cy="${Y + 2}" r="4.5" fill="${C.nose}"/>
        <path d="M${x - 9} ${Y - 9} L${x + 9} ${Y - 5}" stroke="${C.dark}" stroke-width="4" transform="${x === R ? `scale(-1 1) translate(${-2 * x} 0)` : ""}"/>`);
    default:
      return pair((x) => `<circle cx="${x}" cy="${Y}" r="8.5" fill="#fff"/><circle cx="${x + 1}" cy="${Y + 1}" r="4.8" fill="${C.nose}"/><circle cx="${x + 2.5}" cy="${Y - 1}" r="1.6" fill="#fff"/>`);
  }
}

function mouth(kind) {
  switch (kind) {
    case "open": return `<path d="M91 108 Q100 122 109 108 Z" fill="#7a2f3a"/><path d="M95 113 Q100 117 105 113" fill="${C.pink}"/>`;
    case "o": return `<ellipse cx="100" cy="112" rx="5" ry="6" fill="#7a2f3a"/>`;
    case "puff": return `<path d="M92 110 Q100 106 108 110" stroke="${C.nose}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                         <circle cx="84" cy="106" r="5" fill="${C.pink}" opacity=".7"/><circle cx="116" cy="106" r="5" fill="${C.pink}" opacity=".7"/>`;
    case "wavy": return `<path d="M90 111 q2.5 -4 5 0 t5 0 t5 0 t5 0" stroke="${C.nose}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    case "flat": return `<path d="M93 110 L107 110" stroke="${C.nose}" stroke-width="2.5" stroke-linecap="round"/>`;
    case "frown": return `<path d="M92 113 Q100 106 108 113" stroke="${C.nose}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    case "hmm": return `<path d="M93 111 Q101 109 109 106" stroke="${C.nose}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    default: return `<path d="M100 104 V108 M92 108 Q96 113 100 108 Q104 113 108 108" stroke="${C.nose}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
}

// The body. belly = 1 normal, 1.5 = stuffed
function body(belly, arms) {
  const rx = 44 * belly, ry = 48 * (belly > 1 ? 1.08 : 1), cy = 168;
  const armL = {
    rest: `<ellipse cx="${100 - rx + 6}" cy="160" rx="10" ry="20" fill="${C.dark}" transform="rotate(18 ${100 - rx + 6} 160)"/>`,
    wave: `<g class="wave"><ellipse cx="44" cy="118" rx="10" ry="22" fill="${C.dark}" transform="rotate(-35 44 118)"/></g>`,
    out: `<ellipse cx="${100 - rx - 4}" cy="146" rx="9" ry="21" fill="${C.dark}" transform="rotate(60 ${100 - rx - 4} 146)"/>`,
    belly: `<ellipse cx="${100 - rx * 0.55}" cy="170" rx="10" ry="18" fill="${C.dark}" transform="rotate(-50 ${100 - rx * 0.55} 170)"/>`,
    head: `<ellipse cx="48" cy="96" rx="9" ry="22" fill="${C.dark}" transform="rotate(20 48 96)"/>`,
  };
  const armR = {
    rest: `<ellipse cx="${100 + rx - 6}" cy="160" rx="10" ry="20" fill="${C.dark}" transform="rotate(-18 ${100 + rx - 6} 160)"/>`,
    out: `<ellipse cx="${100 + rx + 4}" cy="146" rx="9" ry="21" fill="${C.dark}" transform="rotate(-60 ${100 + rx + 4} 146)"/>`,
    hold: `<ellipse cx="${100 + rx - 2}" cy="150" rx="10" ry="20" fill="${C.dark}" transform="rotate(-40 ${100 + rx - 2} 150)"/>`,
    belly: `<ellipse cx="${100 + rx * 0.55}" cy="172" rx="10" ry="18" fill="${C.dark}" transform="rotate(50 ${100 + rx * 0.55} 172)"/>`,
  };
  const tail = `<g transform="rotate(-25 150 200)">
      ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${150 + i * 9}" cy="${196 - i * 6}" rx="14" ry="11" fill="${i % 2 ? C.dark : C.fur}"/>`).join("")}
    </g>`;
  return `${tail}
    <ellipse cx="78" cy="214" rx="15" ry="8" fill="${C.dark}"/><ellipse cx="122" cy="214" rx="15" ry="8" fill="${C.dark}"/>
    <ellipse cx="100" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.fur}"/>
    <ellipse cx="100" cy="${cy + 6}" rx="${rx * 0.66}" ry="${ry * 0.72}" fill="${C.belly}"/>
    ${belly > 1 ? `<path d="M100 ${cy + 4} q-3 3 0 6" stroke="#9c968b" stroke-width="2" fill="none"/>` : ""}
    ${armL[arms[0]] || armL.rest}${armR[arms[1]] || armR.rest}`;
}

function head(e, m) {
  return `
    <ellipse cx="58" cy="42" rx="16" ry="20" fill="${C.dark}" transform="rotate(-25 58 42)"/>
    <ellipse cx="142" cy="42" rx="16" ry="20" fill="${C.dark}" transform="rotate(25 142 42)"/>
    <ellipse cx="59" cy="45" rx="8" ry="11" fill="${C.pink}" transform="rotate(-25 59 45)"/>
    <ellipse cx="141" cy="45" rx="8" ry="11" fill="${C.pink}" transform="rotate(25 141 45)"/>
    <path d="M40 82 Q42 38 100 36 Q158 38 160 82 Q162 120 128 126 L72 126 Q38 120 40 82 Z" fill="${C.fur}"/>
    <path d="M44 96 Q56 128 100 128 Q144 128 156 96 L140 112 L100 118 L60 112 Z" fill="${C.light}"/>
    <ellipse cx="68" cy="66" rx="17" ry="8" fill="${C.light}" transform="rotate(-12 68 66)"/>
    <ellipse cx="132" cy="66" rx="17" ry="8" fill="${C.light}" transform="rotate(12 132 66)"/>
    <path d="M100 52 L94 74 L106 74 Z" fill="${C.dark}"/>
    <path d="M52 86 Q56 72 76 72 Q94 74 96 88 Q92 98 78 98 Q60 98 52 86 Z" fill="${C.dark}"/>
    <path d="M148 86 Q144 72 124 72 Q106 74 104 88 Q108 98 122 98 Q140 98 148 86 Z" fill="${C.dark}"/>
    <ellipse cx="100" cy="106" rx="24" ry="15" fill="${C.light}"/>
    <ellipse cx="100" cy="99" rx="8" ry="5.5" fill="${C.nose}"/>
    <ellipse cx="98" cy="97.5" rx="2.5" ry="1.4" fill="#fff" opacity=".5"/>
    ${eyes(e)}${mouth(m)}`;
}

// --- Costumes & props --------------------------------------------------
const props = {
  beret: `<path d="M62 46 Q70 18 110 20 Q148 24 140 46 Q104 36 62 46 Z" fill="#d94f3d"/><circle cx="104" cy="19" r="4" fill="#d94f3d"/>`,
  brush: `<g transform="rotate(-30 160 140)"><rect x="156" y="104" width="7" height="44" rx="3" fill="#b8793e"/>
           <rect x="155" y="98" width="9" height="9" fill="#c9ccd2"/><path d="M155 98 Q159 80 164 98 Z" fill="#e8a33d"/></g>`,
  hardhat: `<path d="M56 50 Q58 16 100 14 Q142 16 144 50 Z" fill="#f2c230"/><rect x="48" y="46" width="104" height="9" rx="4" fill="#e0ad18"/>
            <rect x="96" y="14" width="8" height="34" rx="3" fill="#e0ad18"/>`,
  wrench: `<g transform="rotate(25 162 140)"><rect x="158" y="118" width="8" height="40" rx="3" fill="#9aa1ab"/>
            <path d="M152 112 a10 10 0 1 1 20 0 l-5 4 -5 -6 -5 6 z" fill="#9aa1ab"/></g>`,
  party: `<path d="M84 40 L104 -4 L122 38 Z" fill="#7c5cd6"/><path d="M90 28 L116 28 M96 14 L111 14" stroke="#f2c230" stroke-width="4"/>
          <circle cx="104" cy="-6" r="6" fill="#f2c230"/>`,
  confetti: `<g class="confetti">${[[30, 30, "#d94f3d"], [170, 22, "#f2c230"], [20, 120, "#4aa36c"], [182, 100, "#7c5cd6"], [44, 8, "#4aa36c"], [160, 58, "#d94f3d"]]
    .map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="7" height="11" rx="1.5" fill="${c}" transform="rotate(${i * 37} ${x} ${y})"/>`).join("")}</g>`,
  question: `<g class="bob" fill="#7c5cd6" font-family="system-ui,sans-serif" font-weight="900">
              <text x="150" y="40" font-size="34">?</text><text x="30" y="34" font-size="24">?</text><text x="168" y="70" font-size="18">?</text></g>`,
  deerstalker: `<path d="M58 50 Q60 20 100 18 Q140 20 142 50 Z" fill="#a9824f"/>
                <path d="M58 50 Q100 40 142 50" stroke="#7d5f36" stroke-width="5" fill="none"/>
                <path d="M70 26 L130 44 M70 44 L130 26" stroke="#7d5f36" stroke-width="2" opacity=".5"/>
                <circle cx="100" cy="18" r="4" fill="#7d5f36"/>`,
  magnifier: `<g transform="rotate(-20 160 140)"><rect x="157" y="146" width="8" height="30" rx="3" fill="#7d5f36"/>
              <circle cx="161" cy="130" r="17" fill="#cfe8f5" fill-opacity=".55" stroke="#55606e" stroke-width="5"/></g>`,
  file: `<g transform="translate(14 150) rotate(-12)"><path d="M0 0 h24 l8 8 v30 h-32 z" fill="#fff" stroke="#55606e" stroke-width="2"/>
          <path d="M24 0 v8 h8" fill="none" stroke="#55606e" stroke-width="2"/><text x="4" y="30" font-size="11" font-family="system-ui" font-weight="800" fill="#d94f3d">.???</text></g>`,
  sweat: `<path d="M150 64 q6 10 0 14 q-6 -4 0 -14 z" fill="#7cc4ea"/>`,
  crumbs: `<g fill="#b8793e"><circle cx="70" cy="132" r="2.5"/><circle cx="128" cy="138" r="2"/><circle cx="112" cy="130" r="2.2"/></g>`,
  burp: `<g class="bob"><path d="M150 84 q24 -14 40 -2 q8 14 -10 20 q-18 6 -30 -18 z" fill="#fff" stroke="#c9c3b8" stroke-width="2"/>
          <text x="154" y="100" font-size="13" font-family="system-ui" font-weight="900" fill="#55606e">BURP</text></g>`,
  bandage: `<g transform="rotate(-20 130 52)"><rect x="110" y="44" width="40" height="13" rx="5" fill="#f3d7b6"/>
             <rect x="124" y="44" width="12" height="13" fill="#e6c49d"/></g>`,
  zz: `<g class="bob" fill="#55606e" font-family="system-ui" font-weight="900"><text x="150" y="44" font-size="20">z</text><text x="166" y="28" font-size="14">z</text></g>`,
};

// Each "costume" = eyes + mouth + belly + arms + props
const COSTUMES = {
  hello:      { e: "default", m: "open",  belly: 1,    arms: ["wave", "rest"], props: [] },
  talk:       { e: "default", m: "smile", belly: 1,    arms: ["rest", "rest"], props: [] },
  painter:    { e: "focus",   m: "smile", belly: 1,    arms: ["rest", "hold"], props: ["beret", "brush"] },
  stuffed:    { e: "squeeze", m: "puff",  belly: 1.5,  arms: ["belly", "belly"], props: ["sweat", "crumbs", "burp"] },
  confused:   { e: "swirl",   m: "wavy",  belly: 1,    arms: ["head", "rest"], props: ["question"] },
  detective:  { e: "squint",  m: "hmm",   belly: 1,    arms: ["rest", "hold"], props: ["deerstalker", "magnifier", "file"] },
  working:    { e: "focus",   m: "flat",  belly: 1,    arms: ["rest", "hold"], props: ["hardhat", "wrench"] },
  party:      { e: "happy",   m: "open",  belly: 1,    arms: ["wave", "out"],  props: ["party", "confetti"] },
  shrug:      { e: "default", m: "flat",  belly: 1,    arms: ["out", "out"],   props: [] },
  hurt:       { e: "sad",     m: "frown", belly: 1,    arms: ["head", "rest"], props: ["bandage"] },
  sleepy:     { e: "happy",   m: "flat",  belly: 1,    arms: ["rest", "rest"], props: ["zz"] },
};

// Props drawn behind the body (everything else is drawn on top)
const BEHIND = new Set(["confetti", "file"]);

export function raccoonSVG(name = "talk") {
  const c = COSTUMES[name] || COSTUMES.talk;
  const back = c.props.filter((p) => BEHIND.has(p)).map((p) => props[p]).join("");
  const front = c.props.filter((p) => !BEHIND.has(p)).map((p) => props[p]).join("");
  return `<svg viewBox="0 -14 200 240" xmlns="http://www.w3.org/2000/svg" class="raccoon is-${name}" role="img" aria-label="Rootocoon the raccoon">
    ${back}<g class="bodybob">${body(c.belly, c.arms)}${head(c.e, c.m)}${front}</g></svg>`;
}

export const COSTUME_NAMES = Object.keys(COSTUMES);
