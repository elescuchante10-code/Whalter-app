/* global __GCB_SOURCE_TEXT__ */

const STORAGE_KEY = "gcb-dashboard-answers-v1";
const STORAGE_INDEX_KEY = "gcb-dashboard-index-v1";
const STORAGE_COMBO_KEY = "gcb-dashboard-combo-v1";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeYesNo(s) {
  const t = (s || "").trim().toLowerCase();
  if (t === "si" || t === "sí") return "Sí";
  if (t === "no") return "No";
  return (s || "").trim();
}

function parseCards(sourceText) {
  const lines = sourceText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/g, ""))
    .filter((l) => l.trim().length > 0);

  /** @type {{id:string, section:string, code:string, title:string, note?:string, options:string[]}[]} */
  const cards = [];

  let section = "Inicio";
  let pendingNote = "";
  let current = null;

  const flush = () => {
    if (!current) return;
    if (pendingNote.trim() && !current.note) current.note = pendingNote.trim();
    pendingNote = "";
    current.options = current.options.map(normalizeYesNo).filter(Boolean);
    cards.push(current);
    current = null;
  };

  const isHeading = (l) =>
    l === l.toUpperCase() &&
    /[A-ZÁÉÍÓÚÑ]/.test(l) &&
    !/^\d/.test(l) &&
    l.length >= 6;

  const questionRe = /^(\d{1,3}[a-z]?)\.\s+(.*)$/i;
  const optionRe = /^•\s+(.*)$/;

  for (const raw of lines) {
    const l = raw.trim();

    if (isHeading(l)) {
      // Algunos headings son muy generales; tratarlos como "sección" si no son demasiado largos.
      if (l.length <= 42) section = l;
      continue;
    }

    const qm = l.match(questionRe);
    if (qm) {
      flush();
      const code = qm[1];
      const title = qm[2].trim();
      current = {
        id: `${code}`.toLowerCase(),
        section,
        code,
        title,
        options: [],
      };
      continue;
    }

    const om = l.match(optionRe);
    if (om && current) {
      current.options.push(om[1].trim());
      continue;
    }

    // Texto auxiliar: nota para la pregunta actual o "buffer" previo.
    if (current) {
      current.note = current.note ? `${current.note}\n${l}` : l;
    } else {
      pendingNote = pendingNote ? `${pendingNote}\n${l}` : l;
    }
  }

  flush();

  // Cards sin opciones: tratarlas como informativas con una opción "OK" para mantener navegación consistente.
  for (const c of cards) {
    if (!c.options.length) c.options = ["OK"];
  }

  return cards;
}

function loadAnswers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveAnswers(answers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
}

function loadIndex() {
  try {
    const n = Number(localStorage.getItem(STORAGE_INDEX_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveIndex(i) {
  localStorage.setItem(STORAGE_INDEX_KEY, String(i));
}

function sectionAnsweredCount(section) {
  let answered = 0;
  for (let i = section.start; i < section.start + section.count; i++) {
    if (answers[cards[i].id] !== undefined) answered++;
  }
  return { answered, total: section.count };
}

function buildSections(cards) {
  /** @type {{name:string, start:number, count:number, codes:string[]}[]} */
  const sections = [];
  let current = null;
  cards.forEach((c, idx) => {
    if (!current || current.name !== c.section) {
      current = { name: c.section, start: idx, count: 0, codes: [] };
      sections.push(current);
    }
    current.count += 1;
    current.codes.push(c.code);
  });
  return sections;
}

const els = {
  cover: document.getElementById("cover"),
  coverStartBtn: document.getElementById("coverStartBtn"),
  coverStats: document.getElementById("coverStats"),
  app: document.getElementById("app"),
  sectionList: document.getElementById("sectionList"),
  kicker: document.getElementById("kicker"),
  chipSection: document.getElementById("chipSection"),
  chipCode: document.getElementById("chipCode"),
  question: document.getElementById("question"),
  note: document.getElementById("note"),
  options: document.getElementById("options"),
  scoreBig: document.getElementById("scoreBig"),
  scoreLabel: document.getElementById("scoreLabel"),
  scoreExplain: document.getElementById("scoreExplain"),
  formula: document.getElementById("formula"),
  chart: document.getElementById("chart"),
  chartLegend: document.getElementById("chartLegend"),
  classBadge: document.getElementById("classBadge"),
  classTitle: document.getElementById("classTitle"),
  classExplain: document.getElementById("classExplain"),
  matrix: document.getElementById("matrix"),
  matrixLegend: document.getElementById("matrixLegend"),
  comboSelect: document.getElementById("comboSelect"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  progressPill: document.getElementById("progressPill"),
  helpBtn: document.getElementById("helpBtn"),
  helpDialog: document.getElementById("helpDialog"),
  closeHelpBtn: document.getElementById("closeHelpBtn"),
  progressBarFill: document.getElementById("progressBarFill"),
  scoreRingFill: document.getElementById("scoreRingFill"),
  formulaToggle: document.getElementById("formulaToggle"),
  formulaArrow: document.getElementById("formulaArrow"),
  resetBtn: document.getElementById("resetBtn"),
};

const cards = parseCards(window.__GCB_SOURCE_TEXT__ || "");
const sections = buildSections(cards);
let answers = loadAnswers();
let index = clamp(loadIndex(), 0, Math.max(0, cards.length - 1));
let combo = (localStorage.getItem(STORAGE_COMBO_KEY) || "PBM").toUpperCase();

if (els.comboSelect) {
  if (["PBM", "PB", "PM", "BM", "B", "M"].includes(combo)) els.comboSelect.value = combo;
  els.comboSelect.addEventListener("change", () => {
    combo = String(els.comboSelect.value || "PBM").toUpperCase();
    localStorage.setItem(STORAGE_COMBO_KEY, combo);
    renderClassification();
  });
}

function parseCodeParts(code) {
  const m = String(code).trim().toLowerCase().match(/^(\d+)([a-z])?$/);
  if (!m) return { base: null, suffix: null };
  return { base: Number(m[1]), suffix: m[2] || null };
}

function isRubric03Option(opt) {
  const t = (opt || "").trim().toLowerCase();
  return (
    t === "no existe" ||
    t === "en desarrollo" ||
    t === "buenos resultados" ||
    t === "resultados sobresalientes"
  );
}

function rubric03Points(opt) {
  const t = (opt || "").trim().toLowerCase();
  if (t === "no existe") return 0;
  if (t === "en desarrollo") return 1;
  if (t === "buenos resultados") return 2;
  if (t === "resultados sobresalientes") return 3;
  return null;
}

function rubric87Points(opt) {
  const t = (opt || "").trim().toLowerCase();
  if (t === "no existe") return 0;
  if (t === "en desarrollo") return 3;
  if (t === "buenos resultados") return 5;
  if (t === "resultados sobresalientes") return 8;
  return null;
}

function pointsAndMaxForCard(card, selectedOpt) {
  const { base, suffix } = parseCodeParts(card.code);
  const selected = selectedOpt || null;

  // Default empty state.
  if (!selected) {
    return {
      points: null,
      max: maxPointsForCard(card),
      label: "Selecciona una opción para ver el cálculo.",
      explain: "",
      formula: formulaForCard(card),
    };
  }

  // 87 tiene ponderación especial.
  if (base === 87 && isRubric03Option(selected)) {
    const p = rubric87Points(selected);
    return {
      points: p,
      max: 8,
      label: `${p}/8 puntos`,
      explain:
        "Según la guía (págs. 34–85), esta pregunta usa una escala especial: 0 / 3 / 5 / 8.",
      formula: formulaForCard(card),
    };
  }

  // Rubrica general (aplica a la mayoría de preguntas de procesos/resultados).
  if (isRubric03Option(selected)) {
    const p = rubric03Points(selected);
    const max = 3;
    return {
      points: p,
      max,
      label: `${p}/${max} puntos`,
      explain: "Escala: No existe (0), En desarrollo (1), Buenos resultados (2), Resultados sobresalientes (3).",
      formula: formulaForCard(card),
    };
  }

  // Multi-select modeladas como subpreguntas Sí/No en el dashboard.
  const yesNo = selected.trim().toLowerCase();
  const isYes = yesNo === "sí" || yesNo === "si";
  const isNo = yesNo === "no";

  // 15a..15g (zonas cocina): 1 punto por zona si = Sí. 15h se ignora (derivada).
  if (base === 15 && suffix && suffix !== "h" && (isYes || isNo)) {
    return {
      points: isYes ? 1 : 0,
      max: 1,
      label: `${isYes ? 1 : 0}/1 punto`,
      explain: "Cada zona de cocina escolar suma 1 punto si existe.",
      formula: "Puntaje = 1 si respondió “Sí”; de lo contrario 0.",
    };
  }

  // 21a..21d (accesibilidad): 1 punto por característica.
  if (base === 21 && suffix && (isYes || isNo)) {
    return {
      points: isYes ? 1 : 0,
      max: 1,
      label: `${isYes ? 1 : 0}/1 punto`,
      explain: "Cada característica de accesibilidad suma 1 punto si está implementada.",
      formula: "Puntaje = 1 si respondió “Sí”; de lo contrario 0.",
    };
  }

  // 25a..25f (dotación): 1 punto por área con dotación adecuada.
  if (base === 25 && suffix && (isYes || isNo)) {
    return {
      points: isYes ? 1 : 0,
      max: 1,
      label: `${isYes ? 1 : 0}/1 punto`,
      explain: "Cada área con dotación adecuada suma 1 punto.",
      formula: "Puntaje = 1 si respondió “Sí”; de lo contrario 0.",
    };
  }

  // 31a..31c, 32a..32d, 33a..33d, 34a..34c, 84a..84c: 1 punto por Sí.
  const onePointYesBases = new Set([31, 32, 33, 34, 84]);
  if (base && onePointYesBases.has(base) && suffix && (isYes || isNo)) {
    return {
      points: isYes ? 1 : 0,
      max: 1,
      label: `${isYes ? 1 : 0}/1 punto`,
      explain: "Este ítem suma 1 punto si aplica/está presente.",
      formula: "Puntaje = 1 si respondió “Sí”; de lo contrario 0.",
    };
  }

  // Reglas puntuales por pregunta (1–34, 85).
  const mapped = pointsFromOptionMapping(base, selected);
  if (mapped) {
    return {
      points: mapped.points,
      max: mapped.max,
      label: `${mapped.points}/${mapped.max} puntos`,
      explain: mapped.explain || "",
      formula: mapped.formula || formulaForCard(card),
    };
  }

  // Fallback: si no hay regla, no bloquear UI.
  return {
    points: 0,
    max: maxPointsForCard(card),
    label: `0/${maxPointsForCard(card)} puntos`,
    explain: "Regla no encontrada en el mapeo local (pendiente de ajuste).",
    formula: formulaForCard(card),
  };
}

function pointsFromOptionMapping(base, opt) {
  const t = String(opt || "").trim().toLowerCase();
  const isYes = t === "sí" || t === "si";
  const isNo = t === "no";

  // Nota: mapeos implementados según el documento guía (págs. 34–85 extraídas).
  switch (base) {
    case 1: {
      // Niveles: 3 / 2 / 1
      if (t.includes("oferta completa")) return { points: 3, max: 3, explain: "Oferta completa de niveles." };
      if (t.includes("al menos")) return { points: 2, max: 3, explain: "Ofrece preescolar y básica completa." };
      return { points: 1, max: 3, explain: "Otra combinación de niveles." };
    }
    case 2: {
      // Jornada única: Sí=10, No=0
      if (isYes) return { points: 10, max: 10, explain: "Jornada única diurna." };
      if (isNo) return { points: 0, max: 10, explain: "Más de una jornada diurna." };
      return null;
    }
    case 3: {
      // Horas efectivas: solo cumple total en todos niveles = 5
      if (t.includes("todos")) return { points: 5, max: 5, explain: "Cumple total de horas en todos los niveles." };
      return { points: 0, max: 5, explain: "No cumple total en algún nivel." };
    }
    case 4: {
      // RAD: <=20:8; 20-30:5; 30-35:2; >35:0
      if (t.includes("menor o igual") && t.includes("20")) return { points: 8, max: 8, explain: "RAD ≤ 20." };
      if (t.includes("mayor que 20") && t.includes("menor o igual que 30")) return { points: 5, max: 8, explain: "20 < RAD ≤ 30." };
      if (t.includes("mayor que 30") && t.includes("menor o igual que 35")) return { points: 2, max: 8, explain: "30 < RAD ≤ 35." };
      if (t.includes("mayor que 35")) return { points: 0, max: 8, explain: "RAD > 35." };
      return null;
    }
    case 5: {
      // REPA: <=200:3; 200-350:2; 350-500:1; >500:0
      if (t.includes("menor o igual") && t.includes("200")) return { points: 3, max: 3, explain: "REPA ≤ 200." };
      if (t.includes("mayor que 200") && t.includes("menor igual que 350")) return { points: 2, max: 3, explain: "200 < REPA ≤ 350." };
      if (t.includes("mayor que 350") && t.includes("menor o igual que 500")) return { points: 1, max: 3, explain: "350 < REPA ≤ 500." };
      if (t.includes("mayor que 500")) return { points: 0, max: 3, explain: "REPA > 500." };
      return null;
    }
    case 6: {
      // REA: <=120:2; 120-250:1; >250:0
      if (t.includes("menor o igual") && t.includes("120")) return { points: 2, max: 2, explain: "REA ≤ 120." };
      if (t.includes("mayor que 120") && t.includes("menor o igual que 250")) return { points: 1, max: 2, explain: "120 < REA ≤ 250." };
      if (t.includes("mayor que 250")) return { points: 0, max: 2, explain: "REA > 250." };
      return null;
    }
    case 7: {
      // RESG: <=160:2; >160:0
      if (t.includes("menor o igual") && t.includes("160")) return { points: 2, max: 2, explain: "RESG ≤ 160." };
      if (t.includes("mayor que 160")) return { points: 0, max: 2, explain: "RESG > 160." };
      return null;
    }
    case 8: {
      // AFD: >=5:13; 4-5:10; 3-4:5; 2-3:3; <2:0
      if (t.includes("mayor o igual a 5")) return { points: 13, max: 13, explain: "AFD ≥ 5." };
      if (t.includes("mayor o igual a 4") && t.includes("menor")) return { points: 10, max: 13, explain: "4 ≤ AFD < 5." };
      if (t.includes("mayor o igual a 3") && t.includes("menor")) return { points: 5, max: 13, explain: "3 ≤ AFD < 4." };
      if (t.includes("mayor o igual a 2") && t.includes("menor")) return { points: 3, max: 13, explain: "2 ≤ AFD < 3." };
      if (t.includes("menor a 2")) return { points: 0, max: 13, explain: "AFD < 2." };
      return null;
    }
    case 9: {
      // Seguridad social: Tiene=3, No tiene=0
      if (t === "tiene") return { points: 3, max: 3, explain: "Afiliación a seguridad social integral." };
      if (t === "no tiene") return { points: 0, max: 3, explain: "No afiliado." };
      if (isYes) return { points: 3, max: 3, explain: "Afiliación a seguridad social integral." };
      if (isNo) return { points: 0, max: 3, explain: "No afiliado." };
      return null;
    }
    case 10: {
      // M2/E: >=3.5:6, 3-3.5:4, 2-3:2, <2:0
      if (t.includes("mayor o igual a 3,5")) return { points: 6, max: 6, explain: "M2/E ≥ 3,5." };
      if (t.includes("mayor o igual a 3") && t.includes("menor")) return { points: 4, max: 6, explain: "3 ≤ M2/E < 3,5." };
      if (t.includes("mayor o igual a 2") && t.includes("menor")) return { points: 2, max: 6, explain: "2 ≤ M2/E < 3." };
      if (t.includes("menos de 2")) return { points: 0, max: 6, explain: "M2/E < 2." };
      return null;
    }
    case 11: {
      // M2AR/E: >=5:6, 4-5:4, 3-4:2, <3:0
      if (t.includes("mayor o igual a 5")) return { points: 6, max: 6, explain: "M2AR/E ≥ 5." };
      if (t.includes("mayor o igual a 4") && t.includes("menor")) return { points: 4, max: 6, explain: "4 ≤ M2AR/E < 5." };
      if (t.includes("mayor o igual a 3") && t.includes("menor")) return { points: 2, max: 6, explain: "3 ≤ M2AR/E < 4." };
      if (t.includes("menos de 3")) return { points: 0, max: 6, explain: "M2AR/E < 3." };
      return null;
    }
    case 12: {
      // AA: 100%:6, 80-100:4, 50-80:2, <50:0
      if (t.includes("igual al 100")) return { points: 6, max: 6, explain: "AA = 100%." };
      if (t.includes("mayor o igual que 80")) return { points: 4, max: 6, explain: "80% ≤ AA < 100%." };
      if (t.includes("mayor o igual que 50")) return { points: 2, max: 6, explain: "50% ≤ AA < 80%." };
      if (t.includes("menor a 50")) return { points: 0, max: 6, explain: "AA < 50%." };
      return null;
    }
    case 13: {
      // ES: <=22:3, 22-30:2, >30:0
      if (t.includes("menor o igual") && t.includes("22")) return { points: 3, max: 3, explain: "ES ≤ 22." };
      if (t.includes("mayor que 22") && t.includes("menor o igual que 30")) return { points: 2, max: 3, explain: "22 < ES ≤ 30." };
      if (t.includes("mayor que 30")) return { points: 0, max: 3, explain: "ES > 30." };
      return null;
    }
    case 14: {
      // M2 por juego sanitario: >2.8 =>3, <=2.8 =>0 (en el dashboard se pregunta por "menor" vs "mayor o igual")
      if (t.includes("menor")) return { points: 0, max: 3, explain: "M2 ≤ 2,8." };
      if (t.includes("mayor")) return { points: 3, max: 3, explain: "M2 > 2,8." };
      return null;
    }
    case 16: {
      if (isYes) return { points: 2, max: 2, explain: "Sala de profesores adecuada." };
      if (isNo) return { points: 0, max: 2, explain: "Sala de profesores no adecuada." };
      return null;
    }
    case 17: {
      if (t.includes("no tiene")) return { points: 0, max: 2, explain: "No tiene." };
      if (t.includes("tipo a")) return { points: 1, max: 2, explain: "Tipo A." };
      if (t.includes("tipo b")) return { points: 2, max: 2, explain: "Tipo B." };
      return null;
    }
    case 18: {
      if (t.includes("no tiene")) return { points: 0, max: 2, explain: "No tiene." };
      if (t.includes("tipo a")) return { points: 1, max: 2, explain: "Tipo A." };
      if (t.includes("tipo b")) return { points: 2, max: 2, explain: "Tipo B." };
      return null;
    }
    case 19: {
      if (t.includes("no tiene")) return { points: 0, max: 4, explain: "No tiene." };
      if (t.includes("un aula")) return { points: 1, max: 4, explain: "Un aula." };
      if (t.includes("dos aulas")) return { points: 2, max: 4, explain: "Dos aulas." };
      if (t.includes("tres aulas")) return { points: 3, max: 4, explain: "Tres aulas." };
      if (t.includes("cuatro")) return { points: 4, max: 4, explain: "Cuatro o más." };
      return null;
    }
    case 20: {
      if (isYes) return { points: 2, max: 2, explain: "Área de preescolar separada." };
      if (isNo) return { points: 0, max: 2, explain: "No está separada." };
      return null;
    }
    case 22: {
      if (t.includes("no iniciado")) return { points: 0, max: 3, explain: "No iniciado." };
      if (t.includes("en proceso")) return { points: 1, max: 3, explain: "En proceso." };
      if (t.includes("implementado")) return { points: 2, max: 3, explain: "Implementado." };
      if (t.includes("verificado")) return { points: 3, max: 3, explain: "Verificado y/o con plan de mejora." };
      return null;
    }
    case 23: {
      // Biblioteca: ver tabla de puntajes
      if (t.includes("no tiene")) return { points: 0, max: 3, explain: "Sin biblioteca." };
      if (t === "convenio") return { points: 1, max: 3, explain: "Convenio." };
      if (t === "de aula" || t === "bibliobanco" || t.includes("depósito de libros")) return { points: 1, max: 3, explain: "Servicio básico." };
      if (t.includes("depósito y sala")) return { points: 2, max: 3, explain: "Depósito y sala de lectura." };
      if (t === "mixta") return { points: 2, max: 3, explain: "Mixta." };
      if (t.includes("mixta más computadores")) return { points: 3, max: 3, explain: "Mixta + computadores con biblioteca virtual." };
      return null;
    }
    case 24: {
      if (t.includes("menor que 2")) return { points: 0, max: 2, explain: "LE < 2." };
      if (t.includes("mayor o igual que 2") && t.includes("menor")) return { points: 1, max: 2, explain: "2 ≤ LE < 4." };
      if (t.includes("mayor o igual a 4") && t.includes("menor")) return { points: 1, max: 2, explain: "4 ≤ LE < 6." };
      if (t.includes("mayor o igual 6") && t.includes("menor")) return { points: 2, max: 2, explain: "6 ≤ LE < 8." };
      if (t.includes("mayor o igual a 8")) return { points: 2, max: 2, explain: "LE ≥ 8." };
      return null;
    }
    case 26: {
      if (t.includes("no tiene")) return { points: 0, max: 5, explain: "Sin laboratorio." };
      if (t.includes("tipo a")) return { points: 1, max: 5, explain: "Tipo A." };
      if (t.includes("tipo b")) return { points: 3, max: 5, explain: "Tipo B." };
      if (t.includes("tipo c")) return { points: 5, max: 5, explain: "Tipo C." };
      return null;
    }
    case 27: {
      if (t.includes("no tiene")) return { points: 0, max: 3, explain: "Sin computadores." };
      if (t.includes("10 o más")) return { points: 1, max: 3, explain: "ExC ≥ 10." };
      if (t.includes("entre 8 y 9")) return { points: 2, max: 3, explain: "ExC = 8–9." };
      if (t.includes("7 o menos")) return { points: 3, max: 3, explain: "ExC ≤ 7." };
      return null;
    }
    case 28: {
      if (t.includes("no tiene")) return { points: 0, max: 3, explain: "Sin internet para estudiantes." };
      if (t.includes("10 o más")) return { points: 1, max: 3, explain: "ExCI ≥ 10." };
      if (t.includes("menor o igual a 9")) return { points: 3, max: 3, explain: "ExCI ≤ 9." };
      return null;
    }
    case 29: {
      if (t.includes("poco")) return { points: 0, max: 3, explain: "Poco adecuada." };
      if (t.includes("medianamente")) return { points: 1, max: 3, explain: "Medianamente adecuada." };
      if (t.includes("totalmente")) return { points: 3, max: 3, explain: "Totalmente adecuada." };
      return null;
    }
    case 30: {
      if (isYes) return { points: 3, max: 3, explain: "Cuenta con espacios para Tecnología e Informática." };
      if (isNo) return { points: 0, max: 3, explain: "No cuenta con espacios." };
      return null;
    }
    case 85: {
      // Saber 11: A+10, A8, B5, C2, D0, no presenta 0
      if (t.includes("a+")) return { points: 10, max: 10, explain: "Categoría A+." };
      if (t === "a") return { points: 8, max: 10, explain: "Categoría A." };
      if (t === "b") return { points: 5, max: 10, explain: "Categoría B." };
      if (t === "c") return { points: 2, max: 10, explain: "Categoría C." };
      if (t === "d") return { points: 0, max: 10, explain: "Categoría D." };
      if (t.includes("no presenta")) return { points: 0, max: 10, explain: "No presenta SABER 11." };
      return null;
    }
    case 87: {
      // Evaluación institucional (escala especial): 0/3/5/8
      if (t.includes("no existe")) return { points: 0, max: 8, explain: "No existe." };
      if (t.includes("insuficiente")) return { points: 3, max: 8, explain: "Insuficiente." };
      if (t.includes("buenos resultados")) return { points: 5, max: 8, explain: "Buenos resultados." };
      if (t.includes("sobresalientes")) return { points: 8, max: 8, explain: "Resultados sobresalientes." };
      return null;
    }
    default:
      return null;
  }
}

function maxPointsForCard(card) {
  const { base, suffix } = parseCodeParts(card.code);
  if (!base) return 0;

  if (base === 87) return 8;

  // Subítems de 15,21,25,31,32,33,34,84 valen 1 (excepto 15h que se ignora).
  if (suffix) {
    if (base === 15 && suffix === "h") return 0;
    if ([15, 21, 25, 31, 32, 33, 34, 84].includes(base)) return 1;
  }

  // Rubrica 0-3 (la mayoría de procesos/resultados).
  if (card.options.every(isRubric03Option)) return 3;

  // Por mapeo explícito.
  const byBase = {
    1: 3,
    2: 10,
    3: 5,
    4: 8,
    5: 3,
    6: 2,
    7: 2,
    8: 13,
    9: 3,
    10: 6,
    11: 6,
    12: 6,
    13: 3,
    14: 3,
    16: 2,
    17: 2,
    18: 2,
    19: 4,
    20: 2,
    22: 3,
    23: 3,
    24: 2,
    26: 5,
    27: 3,
    28: 3,
    29: 3,
    30: 3,
    85: 10,
    86: 3,
  };
  return byBase[base] ?? 0;
}

function formulaForCard(card) {
  const { base, suffix } = parseCodeParts(card.code);
  if (!base) return "";
  if (suffix) {
    if ([15, 21, 25, 31, 32, 33, 34, 84].includes(base)) {
      return "Puntaje = 1 por cada característica marcada como «Sí». Los ítems se suman en la pregunta madre.";
    }
  }

  switch (base) {
    case 1:
      return "Niveles educativos ofrecidos.\n• Oferta completa (Preescolar + Básica completa + Media) → 3 pts\n• Al menos Preescolar y Básica completa → 2 pts\n• Otra combinación → 1 pt\n\n(Guía 4, pág. 34)";
    case 2:
      return "¿El establecimiento opera en jornada única diurna?\n• Sí → 10 pts\n• No (más de una jornada diurna) → 0 pts\n\n(Guía 4, pág. 35)";
    case 3:
      return "Cumplimiento del total de horas efectivas de clase.\n• Cumple el total de horas en TODOS los niveles ofrecidos → 5 pts\n• No cumple en algún nivel → 0 pts\n\n(Guía 4, págs. 35–36)";
    case 4:
      return "RAD = Estudiantes matriculados ÷ Docentes y directivos equivalentes a tiempo completo\n\n• RAD ≤ 20 → 8 pts\n• 20 < RAD ≤ 30 → 5 pts\n• 30 < RAD ≤ 35 → 2 pts\n• RAD > 35 → 0 pts\n\n(Guía 4, pág. 36)";
    case 5:
      return "REPA = Estudiantes matriculados ÷ Personal de apoyo equivalente a tiempo completo\n\n• REPA ≤ 200 → 3 pts\n• 200 < REPA ≤ 350 → 2 pts\n• 350 < REPA ≤ 500 → 1 pt\n• REPA > 500 → 0 pts\n\n(Guía 4, pág. 37)";
    case 6:
      return "REA = Estudiantes matriculados ÷ Personal administrativo equivalente a tiempo completo\n\n• REA ≤ 120 → 2 pts\n• 120 < REA ≤ 250 → 1 pt\n• REA > 250 → 0 pts\n\n(Guía 4, pág. 38)";
    case 7:
      return "RESG = Estudiantes matriculados ÷ Personal de servicios generales equivalente a tiempo completo\n\n• RESG ≤ 160 → 2 pts\n• RESG > 160 → 0 pts\n\n(Guía 4, pág. 39)";
    case 8:
      return "AFD = Σ años de formación acreditada de docentes y directivos ÷ Total docentes y directivos\n\n• AFD ≥ 5 → 13 pts\n• 4 ≤ AFD < 5 → 10 pts\n• 3 ≤ AFD < 4 → 5 pts\n• 2 ≤ AFD < 3 → 3 pts\n• AFD < 2 → 0 pts\n\n(Guía 4, págs. 40–41)";
    case 9:
      return "¿La totalidad del personal está afiliada a seguridad social integral (salud, pensión y riesgos)?\n• Sí → 3 pts\n• No → 0 pts\n\n(Guía 4, pág. 41)";
    case 10:
      return "M²/E = Metros² construidos ÷ Cantidad de estudiantes\n\n• M²/E ≥ 3,5 → 6 pts\n• 3,0 ≤ M²/E < 3,5 → 4 pts\n• 2,0 ≤ M²/E < 3,0 → 2 pts\n• M²/E < 2,0 → 0 pts\n\n(Guía 4, pág. 42)";
    case 11:
      return "M²AR/E = Metros² de áreas recreativas y zonas libres ÷ Cantidad de estudiantes\n\n• M²AR/E ≥ 5 → 6 pts\n• 4 ≤ M²AR/E < 5 → 4 pts\n• 3 ≤ M²AR/E < 4 → 2 pts\n• M²AR/E < 3 → 0 pts\n\n(Guía 4, pág. 43)";
    case 12:
      return "AA = Total aulas adecuadas ÷ Total aulas del establecimiento\n\n• AA = 100% → 6 pts\n• 80% ≤ AA < 100% → 4 pts\n• 50% ≤ AA < 80% → 2 pts\n• AA < 50% → 0 pts\n\n(Guía 4, págs. 43–44)";
    case 13:
      return "ES = Total estudiantes ÷ Total juegos sanitarios\n\n• ES ≤ 22 → 3 pts\n• 22 < ES ≤ 30 → 2 pts\n• ES > 30 → 0 pts\n\n(Guía 4, pág. 44)";
    case 14:
      return "M² = Área total sanitaria (m²) ÷ Total juegos sanitarios\n\n• M² > 2,8 → 3 pts\n• M² ≤ 2,8 → 0 pts\n\n(Guía 4, pág. 45)";
    case 15:
      return "Zonas de la cocina escolar. Se asigna 1 punto por cada zona presente (a–g).\n• (a) Almacenamiento seco  (b) Almacenamiento frío  (c) Preparación  (d) Cocción\n• (e) Distribución  (f) Lavado  (g) Residuos sólidos\n\n(Guía 4, págs. 45–46)";
    case 16:
      return "¿Cuenta con sala de profesores adecuada?\n• Sí (espacio suficiente y dotado) → 2 pts\n• No → 0 pts\n\n(Guía 4, pág. 47)";
    case 17:
      return "Tipo de sala administrativa:\n• No tiene → 0 pts\n• Tipo A (espacio básico) → 1 pt\n• Tipo B (completamente dotada) → 2 pts\n\n(Guía 4, pág. 47)";
    case 18:
      return "Tipo de sala de archivo y gestión:\n• No tiene → 0 pts\n• Tipo A (básica) → 1 pt\n• Tipo B (dotada y organizada) → 2 pts\n\n(Guía 4, pág. 48)";
    case 19:
      return "Número de aulas de apoyo (bilingüismo, música, artes, etc.):\n• No tiene → 0 pts\n• 1 aula → 1 pt\n• 2 aulas → 2 pts\n• 3 aulas → 3 pts\n• 4 aulas o más → 4 pts\n\n(Guía 4, pág. 49)";
    case 20:
      return "¿El área de Preescolar está físicamente separada de los demás niveles?\n• Sí → 2 pts\n• No → 0 pts\n\n(Guía 4, pág. 50)";
    case 21:
      return "Accesibilidad para personas en situación de discapacidad. 1 punto por cada característica presente (a–d):\n• (a) Rampas de acceso  (b) Señalización  (c) Baterías sanitarias adaptadas  (d) Ayudas técnicas\n\n(Guía 4, pág. 51)";
    case 22:
      return "Estado del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST):\n• No iniciado → 0 pts\n• En proceso → 1 pt\n• Implementado → 2 pts\n• Verificado / con plan de mejora → 3 pts\n\n(Guía 4, págs. 51–52)";
    case 23:
      return "Tipo de biblioteca o servicio bibliográfico:\n• No tiene → 0 pts\n• Convenio / Bibliobanco / De aula → 1 pt\n• Depósito + sala de lectura / Mixta → 2 pts\n• Mixta + computadores con biblioteca virtual → 3 pts\n\n(Guía 4, págs. 52–53)";
    case 24:
      return "LE = Número de libros catalogados ÷ Total estudiantes por jornada\n\n• LE < 2 → 0 pts\n• 2 ≤ LE < 6 → 1 pt\n• 6 ≤ LE < 8 → 2 pts   • LE ≥ 8 → 2 pts\n\n(Guía 4, pág. 53)";
    case 25:
      return "Dotación adecuada por área. 1 punto por cada área con dotación suficiente (a–f):\n• (a) Aulas  (b) Ciencias  (c) Tecnología  (d) Música/Artes  (e) Ed. Física  (f) Biblioteca\n\n(Guía 4, págs. 54–55)";
    case 26:
      return "Tipo de laboratorio de ciencias:\n• No tiene → 0 pts\n• Tipo A (básico, sin mesones fijos) → 1 pt\n• Tipo B (mesones fijos, agua y electricidad) → 3 pts\n• Tipo C (completamente dotado y seguro) → 5 pts\n\n(Guía 4, págs. 55–56)";
    case 27:
      return "ExC = Total estudiantes (jornada) ÷ Total computadores de uso académico\n\n• Sin computadores → 0 pts\n• ExC ≥ 10 → 1 pt\n• 8 ≤ ExC ≤ 9 → 2 pts\n• ExC ≤ 7 → 3 pts\n\n(Guía 4, pág. 56)";
    case 28:
      return "ExCI = Total estudiantes (jornada) ÷ Total computadores con Internet\n\n• Sin internet → 0 pts\n• ExCI ≥ 10 → 1 pt\n• ExCI ≤ 9 → 3 pts\n\n(Guía 4, pág. 57)";
    case 29:
      return "Adecuación de la conectividad a Internet:\n• Poco adecuada (insuficiente o muy lenta) → 0 pts\n• Medianamente adecuada → 1 pt\n• Totalmente adecuada (suficiente para todos los usuarios) → 3 pts\n\n(Guía 4, pág. 57)";
    case 30:
      return "¿El establecimiento cuenta con espacios específicos para Tecnología e Informática?\n• Sí → 3 pts\n• No → 0 pts\n\n(Guía 4, pág. 58)";
    case 31:
    case 32:
    case 33:
    case 34:
      return "Ítem de verificación de procesos de gestión. 1 punto si el proceso/documento está presente y activo, 0 si no existe o no aplica.\n\n(Guía 4, págs. 59–65)";
    case 85:
      return "Resultado institucional en las Pruebas Saber 11 (ICFES):\n• Categoría A+ → 10 pts\n• Categoría A → 8 pts\n• Categoría B → 5 pts\n• Categoría C → 2 pts\n• Categoría D → 0 pts\n• No presenta Saber 11 → 0 pts\n\n(Guía 4, pág. 75)";
    case 86:
      return "Escala de valoración de procesos institucionales (rubrica 0–3):\n• No existe → 0 pts\n• En desarrollo → 1 pt\n• Buenos resultados → 2 pts\n• Resultados sobresalientes → 3 pts\n\n(Guía 4, págs. 66–77)";
    case 87:
      return "Logros escolares en pruebas externas (escala especial):\n• No existe → 0 pts\n• En desarrollo → 3 pts\n• Buenos resultados → 5 pts\n• Resultados sobresalientes → 8 pts\n\n(Guía 4, pág. 76)";
    default:
      // Preguntas de procesos Q35–Q84: rubrica estándar 0–3
      if (base >= 35 && base <= 84) {
        return "Escala de valoración de procesos institucionales (rúbrica 0–3):\n• No existe → 0 pts\n• En desarrollo → 1 pt\n• Buenos resultados → 2 pts\n• Resultados sobresalientes → 3 pts\n\n(Guía 4, págs. 66–74)";
      }
      return "Consultar criterio específico en la Guía 4 MEN (págs. 34–85).";
  }
}

function computeTotals() {
  let earned = 0;
  let max = 0;
  let answeredCount = 0;

  for (const c of cards) {
    const sel = answers[c.id];
    const { points, max: m } = pointsAndMaxForCard(c, sel);
    max += m;
    if (points !== null) {
      earned += points;
      answeredCount += 1;
    }
  }

  return { earned, max, answeredCount, totalCards: cards.length };
}

function computeDomainTotals() {
  let resourcesEarned = 0;
  let resourcesMax = 0;
  let processesEarned = 0;
  let processesMax = 0;

  for (const c of cards) {
    const { base, suffix } = parseCodeParts(c.code);
    if (!base) continue;
    if (base === 15 && suffix === "h") continue; // derivada

    const sel = answers[c.id];
    const { points, max } = pointsAndMaxForCard(c, sel);
    const addPoints = points === null ? 0 : points;

    if (base <= 34) {
      resourcesEarned += addPoints;
      resourcesMax += max;
    } else {
      processesEarned += addPoints;
      processesMax += max;
    }
  }

  return { resourcesEarned, resourcesMax, processesEarned, processesMax };
}

function getPriorityControlledReasons() {
  // Tabla 1 (Recursos): Q3, Q8, Q9, Q13, Q14.
  // Tabla 2 (Procesos): Q79.
  const priorityBases = new Set([3, 8, 9, 13, 14, 79]);
  const reasons = [];

  for (const c of cards) {
    const { base, suffix } = parseCodeParts(c.code);
    if (!base || suffix) continue;
    if (!priorityBases.has(base)) continue;

    const sel = answers[c.id];
    const info = pointsAndMaxForCard(c, sel);
    if (info.points === null) continue; // no afirmar si no está respondida
    if (info.points === 0) reasons.push(`Indicador prioritario en 0: Pregunta ${base}.`);
  }

  return reasons;
}

function classifyInstitution() {
  const { resourcesEarned, resourcesMax, processesEarned, processesMax } = computeDomainTotals();
  // Para clasificación por Cuadros 1–6 se usan los puntajes (no porcentajes).
  const rPts = resourcesEarned;
  const pPts = processesEarned;

  const reasons = getPriorityControlledReasons();
  if (reasons.length) {
    return {
      regimen: "CONTROLADO",
      category: null,
      badge: "Régimen Controlado",
      explain:
        "La guía indica que si un indicador prioritario obtiene 0 puntos, la clasificación pasa a Régimen Controlado. " +
        reasons.join(" "),
      rPts,
      pPts,
      rMax: resourcesMax,
      pMax: processesMax,
    };
  }

  const exact = classifyByCuadro(combo, rPts, pPts);
  return {
    ...exact,
    rPts,
    pPts,
    rMax: resourcesMax,
    pMax: processesMax,
  };
}

function classifyByCuadro(cuadro, rPts, pPts) {
  // Rangos exactos leídos de los Cuadros (docx):
  // Cuadro 1 (PBM): Recursos [0,36,68,83,95,140], Procesos [0,63,65,81,106,175]
  // Cuadro 2 (PB):  Recursos [0,34,63,76,88,134], Procesos [0,45,60,75,97,162]
  // Cuadro 3 (PM):  Recursos [0,36,68,82,95,139], Procesos [0,49,65,81,106,175]
  // Cuadro 4 (BM):  Recursos [0,36,67,80,93,137], Procesos [0,63,65,81,106,175]
  // Cuadro 5 (B):   Recursos [0,33,62,74,87,131], Procesos [0,45,60,75,97,162]
  // Cuadro 6 (M):   Recursos [0,36,67,80,93,136], Procesos [0,49,65,81,106,175]
  const CFG = {
    PBM: { r: [0, 36, 68, 83, 95, 140], p: [0, 63, 65, 81, 106, 175] },
    PB: { r: [0, 34, 63, 76, 88, 134], p: [0, 45, 60, 75, 97, 162] },
    PM: { r: [0, 36, 68, 82, 95, 139], p: [0, 49, 65, 81, 106, 175] },
    BM: { r: [0, 36, 67, 80, 93, 137], p: [0, 63, 65, 81, 106, 175] },
    B: { r: [0, 33, 62, 74, 87, 131], p: [0, 45, 60, 75, 97, 162] },
    M: { r: [0, 36, 67, 80, 93, 136], p: [0, 49, 65, 81, 106, 175] },
  };

  const cfg = CFG[cuadro] || CFG.PBM;

  // Controlado (amarillo): si está a la izquierda del primer umbral de recursos o por debajo del primer umbral de procesos.
  if (rPts < cfg.r[1] || pPts < cfg.p[1]) {
    return {
      regimen: "CONTROLADO",
      category: null,
      badge: "Régimen Controlado",
      explain:
        "Según el Cuadro seleccionado, puntajes bajos en Recursos y/o Procesos ubican al establecimiento en Régimen Controlado.",
      cfg,
    };
  }

  // Zona superior (procesos altos): V13 si recursos en la primera columna (entre r1 y r2), regulada si recursos >= r2.
  if (pPts >= cfg.p[4]) {
    if (rPts < cfg.r[2]) {
      return {
        regimen: "VIGILADA",
        category: "V13",
        badge: "Libertad Vigilada • V13",
        explain: "Ubicado en el bloque V13 del Cuadro (procesos altos, recursos en primer tramo).",
        cfg,
      };
    }
    return {
      regimen: "REGULADA",
      category: null,
      badge: "Libertad Regulada",
      explain: "Ubicado en el bloque superior derecho del Cuadro (Libertad Regulada).",
      cfg,
    };
  }

  // Zona vigilada V1–V12 (3 filas x 4 columnas)
  // Filas por procesos:
  // - p1..p2 => fila 0 (V1..V4)
  // - p2..p3 => fila 1 (V5..V8)
  // - p3..p4 => fila 2 (V9..V12)
  let row = 0;
  if (pPts >= cfg.p[3]) row = 2;
  else if (pPts >= cfg.p[2]) row = 1;
  else row = 0;

  // Columnas por recursos (r2..r5 en 4 tramos)
  let col = 0;
  if (rPts >= cfg.r[4]) col = 3;
  else if (rPts >= cfg.r[3]) col = 2;
  else if (rPts >= cfg.r[2]) col = 1;
  else col = 0; // r1..r2

  const base = row === 0 ? 1 : row === 1 ? 5 : 9;
  const v = base + col;
  return {
    regimen: "VIGILADA",
    category: `V${v}`,
    badge: `Libertad Vigilada • V${v}`,
    explain: "Categoría calculada por cruce exacto (Recursos vs Procesos) del Cuadro seleccionado.",
    cfg,
  };
}
function buildCumulativeSeries() {
  let earned = 0;
  let maxEarned = 0;
  const actual = [];
  const projectedMax = [];

  for (const c of cards) {
    const sel = answers[c.id];
    const max = maxPointsForCard(c);
    const { points } = pointsAndMaxForCard(c, sel);

    maxEarned += max;
    earned += points === null ? 0 : points;

    actual.push(earned);
    projectedMax.push(maxEarned);
  }

  return { actual, projectedMax };
}

function drawChart() {
  if (!els.chart) return;
  const ctx = els.chart.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = els.chart.clientWidth || 860;
  const cssH = Math.round((cssW * 230) / 860);
  els.chart.width = Math.round(cssW * dpr);
  els.chart.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { actual, projectedMax } = buildCumulativeSeries();
  const totals = computeTotals();
  const maxY = Math.max(1, totals.max);

  // Clear
  ctx.clearRect(0, 0, cssW, cssH);

  // Grid
  const pad = 16;
  const w = cssW - pad * 2;
  const h = cssH - pad * 2;
  ctx.save();
  ctx.translate(pad, pad);

  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const xFor = (i) => (actual.length <= 1 ? 0 : (w * i) / (actual.length - 1));
  const yFor = (v) => h - (h * v) / maxY;

  // Projected max line
  ctx.strokeStyle = "rgba(254,195,2,.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  projectedMax.forEach((v, i) => {
    const x = xFor(i);
    const y = yFor(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Actual line
  ctx.strokeStyle = "rgba(255,255,255,.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  actual.forEach((v, i) => {
    const x = xFor(i);
    const y = yFor(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Marker at current index
  const mx = xFor(index);
  const my = yFor(actual[index] ?? 0);
  ctx.fillStyle = "rgba(198,21,49,.95)";
  ctx.beginPath();
  ctx.arc(mx, my, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Legend
  if (els.chartLegend) {
    els.chartLegend.innerHTML = "";
    const add = (color, label) => {
      const item = document.createElement("div");
      item.className = "legendItem";
      const sw = document.createElement("div");
      sw.className = "legendSwatch";
      sw.style.background = color;
      const tx = document.createElement("div");
      tx.textContent = label;
      item.appendChild(sw);
      item.appendChild(tx);
      els.chartLegend.appendChild(item);
    };
    add("rgba(255,255,255,.92)", `Acumulado actual: ${totals.earned}/${totals.max}`);
    add("rgba(254,195,2,.75)", "Tope acumulado (máximo posible)");
    add("rgba(198,21,49,.95)", "Pregunta actual");
  }
}

function renderSectionNav(activeSectionName) {
  els.sectionList.innerHTML = "";
  sections.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sectionBtn";
    btn.setAttribute("aria-current", s.name === activeSectionName ? "true" : "false");

    const dot = document.createElement("div");
    dot.className = "sectionDot";

    const textWrap = document.createElement("div");
    textWrap.className = "sectionTextWrap";

    const name = document.createElement("div");
    name.className = "sectionName";
    name.textContent = s.name;

    const { answered, total } = sectionAnsweredCount(s);

    const meta = document.createElement("div");
    meta.className = "sectionMeta";
    meta.textContent = `${answered}/${total} respondidas`;

    const progressBar = document.createElement("div");
    progressBar.className = "sectionProgress";
    const progressFill = document.createElement("div");
    progressFill.className = "sectionProgressFill";
    progressFill.style.width = total > 0 ? `${((answered / total) * 100).toFixed(0)}%` : "0%";
    progressBar.appendChild(progressFill);

    textWrap.appendChild(name);
    textWrap.appendChild(meta);
    textWrap.appendChild(progressBar);

    btn.appendChild(dot);
    btn.appendChild(textWrap);

    btn.addEventListener("click", () => {
      index = s.start;
      saveIndex(index);
      render();
    });

    els.sectionList.appendChild(btn);
  });
}

function setOptionSelected(uiOptEl, selected) {
  if (selected) uiOptEl.classList.add("isSelected");
  else uiOptEl.classList.remove("isSelected");
}

function render() {
  const c = cards[index];
  if (!c) return;

  renderSectionNav(c.section);

  els.kicker.textContent = "Pregunta / item";
  els.chipSection.textContent = c.section;
  els.chipCode.textContent = `Código: ${c.code}`;
  els.question.textContent = c.title;

  if (c.note && c.note.trim().length) {
    els.note.textContent = c.note.trim();
    els.note.classList.add("isVisible");
  } else {
    els.note.textContent = "";
    els.note.classList.remove("isVisible");
  }

  const total = cards.length;
  const answeredCount = Object.keys(answers).length;
  els.progressPill.textContent = `${index + 1}/${total} • Respondidas: ${answeredCount}`;

  // Global progress bar
  if (els.progressBarFill) {
    const pct = total > 0 ? ((index + 1) / total) * 100 : 0;
    els.progressBarFill.style.width = `${pct.toFixed(1)}%`;
  }

  // Reset formula toggle on each new question
  if (els.formula) els.formula.classList.remove("formulaOpen");
  if (els.formulaArrow) els.formulaArrow.textContent = "▾";

  els.prevBtn.disabled = index === 0;
  els.nextBtn.disabled = index === total - 1;

  const selected = answers[c.id];
  els.options.innerHTML = "";

  c.options.forEach((opt, optIdx) => {
    const label = document.createElement("label");
    label.className = "opt";

    // Score-tier accent color
    const optInfo = pointsAndMaxForCard(c, opt);
    let scoreTier = "neutral";
    if (optInfo.points !== null && optInfo.max > 0) {
      const ratio = optInfo.points / optInfo.max;
      if (optInfo.points === 0) scoreTier = "zero";
      else if (ratio < 0.4) scoreTier = "low";
      else if (ratio < 0.75) scoreTier = "mid";
      else scoreTier = "high";
    }
    label.dataset.scoreTier = scoreTier;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `q-${c.id}`;
    input.value = opt;
    input.checked = selected === opt;
    input.setAttribute("aria-label", opt);

    const text = document.createElement("div");
    text.className = "optText";
    text.textContent = opt;

    label.appendChild(input);
    label.appendChild(text);

    setOptionSelected(label, input.checked);

    const commit = () => {
      answers = { ...answers, [c.id]: opt };
      saveAnswers(answers);

      // re-render selection styles only
      for (const node of els.options.querySelectorAll(".opt")) setOptionSelected(node, false);
      setOptionSelected(label, true);

      // Update insights and chart
      renderInsights();
    };

    input.addEventListener("change", commit);
    label.addEventListener("click", () => {
      // click en el label debe seleccionar sin depender de "change" del input (mejor UX)
      if (!input.checked) {
        input.checked = true;
        commit();
      }
    });

    // Shortcut: números 1-9 para elegir opciones rápidas cuando hay pocas.
    if (optIdx < 9) {
      label.dataset.shortcut = String(optIdx + 1);
    }

    els.options.appendChild(label);
  });

  renderInsights();
}

function renderInsights() {
  const c = cards[index];
  if (!c) return;
  const selected = answers[c.id];
  const info = pointsAndMaxForCard(c, selected);

  if (els.scoreBig) els.scoreBig.textContent = info.points === null ? "—" : `${info.points}/${info.max}`;
  if (els.scoreLabel) els.scoreLabel.textContent = info.label || "";
  if (els.scoreExplain) els.scoreExplain.textContent = info.explain || "";
  if (els.formula) els.formula.textContent = info.formula || "";

  // Score ring animation
  if (els.scoreRingFill) {
    const C = 238.76; // 2π × 38
    const ratio = (info.points !== null && info.max > 0) ? info.points / info.max : 0;
    els.scoreRingFill.style.strokeDashoffset = String(C * (1 - ratio));
    if (info.points === null) {
      els.scoreRingFill.style.stroke = "rgba(255,255,255,.18)";
    } else if (info.points === 0) {
      els.scoreRingFill.style.stroke = "rgba(198,21,49,.85)";
    } else if (ratio < 0.5) {
      els.scoreRingFill.style.stroke = "rgba(254,195,2,.92)";
    } else {
      els.scoreRingFill.style.stroke = "rgba(40,190,80,.90)";
    }
  }

  drawChart();
  renderClassification();
}

function drawMatrix(r, p) {
  if (!els.matrix) return;
  const ctx = els.matrix.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = els.matrix.clientWidth || 860;
  // Altura extra para que ejes y leyenda visual no queden pegados al borde
  const cssH = Math.round((cssW * 280) / 860);
  els.matrix.width = Math.round(cssW * dpr);
  els.matrix.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padL = 52;
  const padR = 20;
  const padT = 16;
  const padB = 44;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;

  const fontStack =
    getComputedStyle(document.documentElement).getPropertyValue("--font").trim() ||
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.translate(padL, padT);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const x = (w * i) / 5;
    const y = (h * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Diagonal bands (V1..V13 conceptual)
  ctx.strokeStyle = "rgba(254,195,2,.10)";
  ctx.lineWidth = 1;
  for (let i = -6; i <= 18; i++) {
    const offset = (i / 13) * w;
    ctx.beginPath();
    ctx.moveTo(offset, h);
    ctx.lineTo(offset + w, 0);
    ctx.stroke();
  }

  // Point: convertir a coordenadas normalizadas en el cuadro actual (0..max de ejes)
  const cl = classifyInstitution();
  const cfg = cl.cfg || { r: [0, 1], p: [0, 1] };
  const rMaxAxis = cfg.r[cfg.r.length - 1];
  const pMaxAxis = cfg.p[cfg.p.length - 1];
  const rN = rMaxAxis ? cl.rPts / rMaxAxis : 0;
  const pN = pMaxAxis ? cl.pPts / pMaxAxis : 0;

  const x = w * Math.max(0, Math.min(1, rN));
  const y = h * (1 - Math.max(0, Math.min(1, pN)));
  ctx.fillStyle = "rgba(198,21,49,.95)";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Crosshair
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();

  ctx.restore();

  // Etiquetas fuera del área de trazado (evita recortes)
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.font = `600 12px ${fontStack}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Recursos →", padL + w / 2, cssH - padB / 2);

  ctx.save();
  ctx.translate(padL / 2, padT + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Procesos ↑", 0, 0);
  ctx.restore();
}

function renderClassification() {
  const c = classifyInstitution();
  if (!els.classBadge || !els.classTitle || !els.classExplain) return;

  els.classBadge.classList.remove("isControlled", "isVigilada", "isRegulada");
  if (c.regimen === "CONTROLADO") els.classBadge.classList.add("isControlled");
  if (c.regimen === "VIGILADA") els.classBadge.classList.add("isVigilada");
  if (c.regimen === "REGULADA") els.classBadge.classList.add("isRegulada");

  els.classBadge.textContent = c.badge;
  els.classTitle.textContent =
    c.regimen === "VIGILADA" ? `Régimen de Libertad Vigilada (${c.category})` : `Régimen: ${c.badge}`;

  const { resourcesEarned, resourcesMax, processesEarned, processesMax } = computeDomainTotals();
  els.classExplain.textContent =
    `${c.explain}\n` +
    `Recursos: ${resourcesEarned}/${resourcesMax}. Procesos: ${processesEarned}/${processesMax}.`;

  drawMatrix(0, 0);

  if (els.matrixLegend) {
    els.matrixLegend.innerHTML = "";
    const add = (color, label) => {
      const item = document.createElement("div");
      item.className = "legendItem";
      const sw = document.createElement("div");
      sw.className = "legendSwatch";
      sw.style.background = color;
      const tx = document.createElement("div");
      tx.textContent = label;
      item.appendChild(sw);
      item.appendChild(tx);
      els.matrixLegend.appendChild(item);
    };
    add("rgba(198,21,49,.95)", "Ubicación actual (Recursos vs Procesos)");
    add("rgba(254,195,2,.35)", "Zonas por Cuadro (rangos exactos)");
  }
}

function showCover() {
  if (!els.cover) return;
  els.cover.classList.remove("cover--hidden");

  if (els.coverStats) {
    const { answeredCount, totalCards, earned, max } = computeTotals();
    if (answeredCount === 0) {
      els.coverStats.innerHTML = "";
    } else {
      els.coverStats.innerHTML =
        `<span class="coverStat"><b>${answeredCount}</b> / ${totalCards} respondidas</span>` +
        `<span class="coverStatDivider">·</span>` +
        `<span class="coverStat">Puntaje acumulado: <b>${earned}</b> / ${max}</span>`;
    }
  }
}

function hideCover() {
  if (!els.cover) return;
  els.cover.classList.add("cover--hidden");
}

function go(delta) {
  const card = document.getElementById("card");
  if (card) card.classList.add("card--fade");
  requestAnimationFrame(() => {
    setTimeout(() => {
      index = clamp(index + delta, 0, cards.length - 1);
      saveIndex(index);
      render();
      if (card) card.classList.remove("card--fade");
    }, 120);
  });
}

if (els.coverStartBtn) {
  els.coverStartBtn.addEventListener("click", () => {
    hideCover();
    render();
  });
}

if (els.resetBtn) {
  els.resetBtn.addEventListener("click", () => {
    if (!confirm("¿Borrar todas las respuestas y volver al inicio? Esta acción no se puede deshacer.")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_INDEX_KEY);
    answers = {};
    index = 0;
    showCover();
  });
}

els.prevBtn.addEventListener("click", () => go(-1));
els.nextBtn.addEventListener("click", () => go(1));

document.addEventListener("keydown", (e) => {
  if (els.helpDialog && els.helpDialog.open) return;
  if (e.key === "ArrowLeft") return go(-1);
  if (e.key === "ArrowRight") return go(1);

  // 1..9 selecciona opción
  if (/^[1-9]$/.test(e.key)) {
    const opt = els.options.querySelector(`.opt[data-shortcut="${e.key}"] input`);
    if (opt && opt instanceof HTMLInputElement) {
      opt.click();
    }
  }
});

els.helpBtn.addEventListener("click", () => {
  if (!els.helpDialog) return;
  els.helpDialog.showModal();
});
els.closeHelpBtn.addEventListener("click", () => {
  if (!els.helpDialog) return;
  els.helpDialog.close();
});
if (els.formulaToggle) {
  els.formulaToggle.addEventListener("click", () => {
    if (!els.formula) return;
    const isOpen = els.formula.classList.toggle("formulaOpen");
    if (els.formulaArrow) els.formulaArrow.textContent = isOpen ? "▴" : "▾";
  });
}

els.helpDialog?.addEventListener("click", (e) => {
  const rect = els.helpDialog.getBoundingClientRect();
  const inDialog =
    rect.top <= e.clientY &&
    e.clientY <= rect.top + rect.height &&
    rect.left <= e.clientX &&
    e.clientX <= rect.left + rect.width;
  if (!inDialog) els.helpDialog.close();
});

showCover();

window.addEventListener("resize", () => {
  // Redibuja con dimensiones correctas.
  drawChart();
  renderClassification();
});

