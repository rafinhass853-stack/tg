// src/Cargas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  where,
} from "firebase/firestore";

/* =========================
   NOVA PALETA DE CORES: Preto, Azul e Branco
========================= */
const TG = {
  black: "#000000",
  blue: "#0066cc",
  blueDark: "#004d99",
  blueLight: "#e6f2ff",
  white: "#ffffff",
  bg: "#f8fafc",
  border: "#d1d5db",
  text: "#111827",
  muted: "#6b7280",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

/* =========================
   STATUS DA CARGA (OPERAÇÃO)
========================= */
const cargaStatusOptions = [
  "AGUARDANDO CARREGAMENTO",
  "EM ROTA PARA A COLETA",
  "EM ROTA PARA A ENTREGA",
  "AGUARDANDO DESCARGA",
  "VAZIO",
  "MANUTENÇÃO",
];

/* =========================
   STATUS DO MOTORISTA (ESCALA)
========================= */
const motoristaStatusOptions = [
  { code: "P", label: "P — Trabalhado", bg: "#10b981", fg: "#ffffff" },
  { code: "P/DS", label: "P/DS — Meio período", bg: "#f59e0b", fg: "#111827" },
  { code: "DS", label: "DS — Descanso semanal", bg: "#ec4899", fg: "#ffffff" },
  { code: "F", label: "F — Falta", bg: "#f97316", fg: "#111827" },
  { code: "D", label: "D — Demitido", bg: "#dc2626", fg: "#ffffff" },
  { code: "A", label: "A — Atestado", bg: "#eab308", fg: "#111827" },
  { code: "S", label: "S — Suspenso", bg: "#000000", fg: "#ffffff" },
  { code: "FE", label: "FE — Férias", bg: "#0066cc", fg: "#ffffff" },
];

function getMotoristaStatusMeta(code) {
  return motoristaStatusOptions.find((x) => x.code === code) || null;
}

/* =========================
   HELPERS
========================= */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function dayKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}
function weekdayShort(d) {
  const w = d.getDay();
  return ["D", "S", "T", "Q", "Q", "S", "S"][w];
}
function buildMonthDays(year, monthIndex0) {
  const first = new Date(year, monthIndex0, 1);
  const days = [];
  const d = new Date(first);
  while (d.getMonth() === monthIndex0) {
    days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function formatBRDay(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function toMiddayTimestamp(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 12, 0, 0);
  return Timestamp.fromDate(d);
}
function toDateSafe(ts) {
  if (!ts) return null;
  return ts?.toDate ? ts.toDate() : new Date(ts);
}
function dateToInput(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function inputToDate(v) {
  if (!v) return null;
  const [y, m, dd] = v.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd, 12, 0, 0);
}
function clampRangeDates(a, b) {
  if (!a || !b) return null;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12, 0, 0);
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12, 0, 0);
  if (start.getTime() > end.getTime()) return { start: end, end: start };
  return { start, end };
}
function enumerateDays(start, end) {
  const out = [];
  const d = new Date(start);
  while (d.getTime() <= end.getTime()) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* =========================
   ✅ DATETIME (BR) — dd/mm/aaaa hh:mm
========================= */
function isValidDateObj(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}
function formatBRDateTime(dateObj) {
  if (!isValidDateObj(dateObj)) return "";
  return `${pad2(dateObj.getDate())}/${pad2(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad2(
    dateObj.getHours()
  )}:${pad2(dateObj.getMinutes())}`;
}
function parseBRDateTime(str) {
  const s = (str || "").trim();
  if (!s) return null;

  // aceita: dd/mm/aaaa hh:mm  (hora opcional -> assume 00:00)
  const parts = s.split(" ");
  const dpart = parts[0] || "";
  const tpart = parts[1] || "00:00";

  const [dd, mm, yyyy] = dpart.split("/").map((x) => parseInt(x, 10));
  if (!dd || !mm || !yyyy) return null;

  const [hh, mi] = (tpart || "00:00").split(":").map((x) => parseInt(x, 10));
  const H = Number.isFinite(hh) ? hh : 0;
  const M = Number.isFinite(mi) ? mi : 0;

  const d = new Date(yyyy, mm - 1, dd, H, M, 0, 0);
  if (!isValidDateObj(d)) return null;

  // valida contra datas “impossíveis” (ex: 31/02)
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;

  return d;
}
function brDateToISODate(brDate) {
  // br: dd/mm/aaaa -> yyyy-mm-dd
  const [dd, mm, yyyy] = (brDate || "").split("/").map((x) => (x || "").trim());
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}
function isoDateToBR(iso) {
  // iso: yyyy-mm-dd -> dd/mm/aaaa
  const [yyyy, mm, dd] = (iso || "").split("-");
  if (!yyyy || !mm || !dd) return "";
  return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
}
function isVazioOrManut(status) {
  const s = (status || "").toUpperCase();
  return s === "VAZIO" || s === "MANUTENÇÃO" || s === "MANUTENCAO";
}

/* =========================
   NOVOS HELPERS (VÍNCULO + MOPP)
========================= */
function getTemMopp(m) {
  const v =
    m?.temMopp ??
    m?.temMOPP ??
    m?.mopp ??
    m?.tem_mopp ??
    m?.temMOPPBool ??
    m?.MOPP;

  return v === true || v === "Sim" || v === "SIM" || v === "sim" || v === 1 || v === "1";
}
function getVinculo(m) {
  const v = m?.vinculo ?? m?.vínculo ?? m?.Vinculo ?? m?.VINCULO ?? "";
  return (v || "").toString().trim();
}
function getMotoristaDe(m) {
  const v = m?.motoristaDe ?? m?.motorista_de ?? m?.tipo ?? m?.categoria ?? "";
  return (v || "").toString().trim();
}

/* ===== Badge do status da carga ===== */
function cargaStatusBadgeStyle(status) {
  const s = (status || "").toUpperCase();
  if (s.includes("AGUARDANDO CARREG")) return { bg: "#fef3c7", fg: "#92400e" };
  if (s.includes("EM ROTA PARA A COLETA")) return { bg: "#dbeafe", fg: "#1e40af" };
  if (s.includes("EM ROTA PARA A ENTREGA")) return { bg: "#93c5fd", fg: "#1e3a8a" };
  if (s.includes("AGUARDANDO DESC")) return { bg: "#e5e7eb", fg: "#374151" };
  if (s.includes("VAZIO")) return { bg: "#d1fae5", fg: "#065f46" };
  if (s.includes("MANUT")) return { bg: "#fed7aa", fg: "#7c2d12" };
  return { bg: TG.blueLight, fg: TG.blueDark };
}

/* =========================
   ✅ emptyCarga (inclui datas opcionais)
========================= */
const emptyCarga = {
  cidadeOrigem: "",
  clienteColeta: "",
  cidadeDestino: "",
  clienteEntrega: "",
  status: "AGUARDANDO DESCARGA",

  // texto "dd/mm/aaaa hh:mm"
  dataColeta: "",
  dataEntrega: "",
};

/* =========================
   COMPONENTES AUX
========================= */
const Input = ({ label, span, children }) => (
  <div style={{ gridColumn: `span ${span}` }}>
    <label style={{ fontSize: 12, color: TG.black, fontWeight: 600, marginBottom: 6, display: "block" }}>
      {label}
    </label>
    {children}
  </div>
);

const KPI = ({ title, value, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...kpiBox,
      cursor: "pointer",
      borderColor: active ? TG.blue : TG.border,
      boxShadow: active ? `0 0 0 2px ${TG.blueLight}` : "none",
      background: active ? TG.blueLight : TG.white,
    }}
    title="Clique para destacar na planilha"
  >
    <div style={{ fontSize: 11, color: TG.muted, fontWeight: 600 }}>{title}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: TG.black }}>{value}</div>
  </button>
);

const KPIBadge = ({ code, meta, value, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...kpiBadge,
      cursor: "pointer",
      borderColor: active ? TG.blue : TG.border,
      boxShadow: active ? `0 0 0 2px ${TG.blueLight}` : "none",
      background: active ? TG.blueLight : TG.white,
    }}
    title="Clique para destacar na planilha"
  >
    <div
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 11,
        border: `1px solid ${TG.border}`,
        background: meta?.bg || "#e5e7eb",
        color: meta?.fg || "#111827",
        width: "fit-content",
      }}
    >
      {code}
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color: TG.black }}>{value}</div>
  </button>
);

/* =========================
   ✅ Date+Time Picker (calendário + relógio)
   - Usa <input type="date"> e <input type="time">
   - Salva no formato: dd/mm/aaaa hh:mm
========================= */
function DateTimeBRPicker({ name, value, onChange, placeholder }) {
  const parsed = useMemo(() => parseBRDateTime(value), [value]);

  const isoDate = useMemo(() => {
    if (!parsed) {
      // tenta inferir somente data (dd/mm/aaaa)
      const onlyDate = (value || "").trim().split(" ")[0] || "";
      return brDateToISODate(onlyDate);
    }
    return dateToInput(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
  }, [parsed, value]);

  const timeHHMM = useMemo(() => {
    if (!parsed) return "";
    return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
  }, [parsed]);

  function setFromPieces(nextISODate, nextTime) {
    const dISO = (nextISODate || "").trim();
    if (!dISO) {
      onChange({ target: { name, value: "" } });
      return;
    }
    const br = isoDateToBR(dISO);
    const t = (nextTime || "").trim() || "00:00";
    onChange({ target: { name, value: `${br} ${t}` } });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          readOnly
          style={{ ...input, paddingRight: 44 }}
          placeholder={placeholder || "dd/mm/aaaa hh:mm"}
          title="Escolha no calendário e no relógio"
        />
        <button
          type="button"
          onClick={() => onChange({ target: { name, value: "" } })}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            border: `1px solid ${TG.border}`,
            background: TG.white,
            borderRadius: 10,
            width: 28,
            height: 28,
            cursor: "pointer",
            fontWeight: 900,
            color: TG.muted,
          }}
          title="Limpar"
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <input
          type="date"
          value={isoDate || ""}
          onChange={(e) => setFromPieces(e.target.value, timeHHMM)}
          style={input}
          title="Calendário"
        />
        <input
          type="time"
          value={timeHHMM || ""}
          onChange={(e) => setFromPieces(isoDate, e.target.value)}
          style={input}
          title="Relógio"
          step={60}
        />
      </div>
    </div>
  );
}

/* =========================
   ESTILOS
========================= */
const header = {
  background: TG.black,
  color: TG.white,
  padding: "20px 24px",
  borderBottom: `4px solid ${TG.blue}`,
};
const headerLeft = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};
const kpiPanel = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const kpiBox = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 10,
  padding: "12px 16px",
  minWidth: 120,
  textAlign: "left",
  transition: "all 0.2s ease",
};
const kpiBadge = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 10,
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minWidth: 140,
  transition: "all 0.2s ease",
};
const btnClear = {
  border: `1px solid ${TG.border}`,
  background: TG.white,
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  color: TG.black,
  fontSize: 13,
  transition: "all 0.2s ease",
};
const toolbar = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 12,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  gap: 12,
  flexWrap: "wrap",
};
const toolbarSticky = {
  ...toolbar,
  position: "sticky",
  top: 10,
  zIndex: 20,
};
const btnSmall = {
  border: `1px solid ${TG.border}`,
  background: TG.white,
  padding: "8px 10px",
  borderRadius: 8,
  fontWeight: 800,
  cursor: "pointer",
  color: TG.black,
  fontSize: 12,
  transition: "all 0.2s ease",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  whiteSpace: "nowrap",
};
const sheetWrap = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 12,
  overflow: "auto",
  maxHeight: "74vh",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const sheetTable = {
  width: "max-content",
  borderCollapse: "collapse",
  fontSize: 13,
};
const thStickyLeft = {
  position: "sticky",
  left: 0,
  zIndex: 5,
  background: TG.black,
  color: TG.white,
  padding: 12,
  textAlign: "left",
  borderRight: `1px solid ${TG.border}`,
  top: 0,
  fontWeight: 700,
  fontSize: 13,
};
const thDay = {
  position: "sticky",
  top: 0,
  zIndex: 4,
  padding: "8px",
  borderLeft: `1px solid ${TG.border}`,
  borderBottom: `1px solid ${TG.border}`,
  textAlign: "center",
  minWidth: 180,
  fontWeight: 600,
};

const tdStickyLeft = {
  position: "sticky",
  left: 0,
  zIndex: 3,
  borderRight: `1px solid ${TG.border}`,
  borderBottom: `1px solid ${TG.border}`,
  padding: 12,
  minWidth: 300,
  fontWeight: 600,
  verticalAlign: "top",
};
const tdDay = {
  borderLeft: `1px solid ${TG.border}`,
  borderBottom: `1px solid ${TG.border}`,
  padding: 10,
  verticalAlign: "top",
  minWidth: 180,
  height: 200,
};
const tdEmpty = {
  padding: 24,
  textAlign: "center",
  color: TG.muted,
  fontSize: 14,
};
const btnGhost = {
  border: `1px solid ${TG.border}`,
  background: TG.white,
  padding: "8px 12px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  color: TG.black,
  fontSize: 14,
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
};
const input = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${TG.border}`,
  outline: "none",
  fontSize: 14,
  width: "100%",
  background: TG.white,
  color: TG.text,
  transition: "border 0.2s ease",
};
const btnPrimary = {
  background: TG.blue,
  color: TG.white,
  padding: "12px 20px",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  transition: "all 0.2s ease",
};
const btnSecondary = {
  background: TG.blueLight,
  color: TG.blueDark,
  padding: "12px 20px",
  border: `1px solid ${TG.border}`,
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  transition: "all 0.2s ease",
};
const btnDangerMini = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "12px 20px",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  transition: "all 0.2s ease",
};
const cellBox = {
  background: "#f9fafb",
  borderRadius: 8,
  padding: 10,
  border: `1px solid ${TG.border}`,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const statusBadge = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  border: `1px solid ${TG.border}`,
  width: "fit-content",
  marginBottom: 4,
};
const cellLine = {
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.3,
  whiteSpace: "normal",
  wordBreak: "break-word",
  color: TG.text,
};
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 999,
  backdropFilter: "blur(2px)",
};
const modalCardStyle = {
  width: "min(1200px, 100%)",
  background: TG.white,
  borderRadius: 16,
  border: `1px solid ${TG.border}`,
  padding: 24,
  maxHeight: "90vh",
  overflow: "auto",
  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
};
const modalCardSmall = {
  width: "min(700px, 100%)",
  background: TG.white,
  borderRadius: 16,
  border: `1px solid ${TG.border}`,
  padding: 24,
  maxHeight: "90vh",
  overflow: "auto",
  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
};
const blockTitle = {
  fontWeight: 700,
  color: TG.black,
  marginBottom: 12,
  marginTop: 8,
  fontSize: 16,
  paddingBottom: 8,
  borderBottom: `2px solid ${TG.blueLight}`,
};
const rangeBar = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  border: `1px solid ${TG.border}`,
  background: "#f9fafb",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};
const rangeLabel = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 13,
  fontWeight: 600,
  color: TG.black,
};

/* =========================
   🔥 VÍNCULO VEÍCULO/CARRETA (placas)
========================= */
function pickMotoristaIdFromDoc(docObj) {
  return docObj?.motoristaId ?? docObj?.motorista_id ?? docObj?.driverId ?? docObj?.driver_id ?? "";
}

function fmtVeiculo(v) {
  if (!v) return "(sem veículo)";
  const placa = v.placa || "-";
  const tipo = v.tipo || "-";
  const st = v.statusManutencao || "-";
  return `${placa} • ${tipo} • ${st}`;
}

function fmtCarreta(c) {
  if (!c) return "(sem carreta)";
  const placa = c.placaCarreta || c.placa || "-";
  const tipo = c.tipoCarreta || c.tipo || "-";
  const eixos = c.eixos ? `${c.eixos} eixos` : "";
  const st = c.statusManutencao || "-";
  const mid = [placa, tipo, eixos].filter(Boolean).join(" • ");
  return `${mid} • ${st}`;
}

/* =========================
   ✅ COR DINÂMICA DA CÉLULA
========================= */
function getCellBackground(motoristaId, dateObj, statusIndex, cargasIndex) {
  const key = `${motoristaId}|${dayKey(dateObj)}`;

  const st = statusIndex.get(key);
  const cargas = cargasIndex.get(key) || [];

  const hasStatus = !!(st && st.codigo);
  const hasCarga = cargas.length > 0;

  // prioridade por códigos
  if (st?.codigo === "F") return "#fee2e2"; // falta
  if (st?.codigo === "D") return "#e5e7eb"; // demitido
  if (st?.codigo === "FE") return "#fce7f3"; // férias
  if (st?.codigo === "DS") return "#f3e8ff"; // descanso
  if (st?.codigo === "A") return "#fef9c3"; // atestado

  // combinações
  if (hasStatus && hasCarga) return "#dcfce7"; // verde claro
  if (hasCarga) return "#fef3c7"; // amarelo claro
  if (hasStatus) return "#e0f2fe"; // azul claro

  return null;
}

export default function Cargas() {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
  });

  const [motoristas, setMotoristas] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [statusMotorista, setStatusMotorista] = useState([]);

  const [veiculos, setVeiculos] = useState([]);
  const [carretas, setCarretas] = useState([]);

  const [filterDay, setFilterDay] = useState(() => dateToInput(new Date()));
  const [activeFilter, setActiveFilter] = useState(null);

  // ✅ modais separados
  const [pickerOpen, setPickerOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [cargaModalOpen, setCargaModalOpen] = useState(false);

  const [modalMotorista, setModalMotorista] = useState(null);
  const [modalDate, setModalDate] = useState(null);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [selectedCargaId, setSelectedCargaId] = useState(null);
  const [formCarga, setFormCarga] = useState(emptyCarga);

  const [selectedStatusId, setSelectedStatusId] = useState(null);
  const [statusCode, setStatusCode] = useState("");
  const [statusObs, setStatusObs] = useState("");

  const [searchNome, setSearchNome] = useState("");
  const [dayFilters, setDayFilters] = useState({});
  const [compact, setCompact] = useState(false);
  const [openVinculos, setOpenVinculos] = useState({});

  const sheetWrapRef = useRef(null);
  const dayHeaderRefs = useRef({});

  const colMotoristas = useMemo(() => collection(db, "motoristas"), []);
  const colCargas = useMemo(() => collection(db, "cargas"), []);
  const colStatus = useMemo(() => collection(db, "statusMotorista"), []);
  const colVeiculos = useMemo(() => collection(db, "veiculos"), []);
  const colCarretas = useMemo(() => collection(db, "carretas"), []);

  const todayMidday = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }, []);
  const todayKey = useMemo(() => dayKey(todayMidday), [todayMidday]);

  function isTodayColumn(d) {
    return dayKey(d) === todayKey;
  }

  function scrollToDayKey(dk) {
    const wrap = sheetWrapRef.current;
    const el = dayHeaderRefs.current?.[dk];
    if (!wrap || !el) return;

    const wrapRect = wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const currentScrollLeft = wrap.scrollLeft;

    const elLeftInsideWrap = elRect.left - wrapRect.left + currentScrollLeft;
    const target = Math.max(0, elLeftInsideWrap - wrap.clientWidth / 2 + el.offsetWidth / 2);

    wrap.scrollTo({ left: target, behavior: "smooth" });
  }

  function goToday() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
    setViewDate(monthStart);
    setDayFilters({});
    setFilterDay(dateToInput(now));

    setTimeout(() => {
      scrollToDayKey(dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)));
    }, 50);
  }

  useEffect(() => {
    const q = query(colMotoristas, orderBy("nome", "asc"));
    return onSnapshot(q, (snap) => {
      setMotoristas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [colMotoristas]);

  useEffect(() => {
    const q = query(colCargas, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setCargas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [colCargas]);

  useEffect(() => {
    const q = query(colStatus, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setStatusMotorista(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [colStatus]);

  useEffect(() => {
    const q = query(colVeiculos, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setVeiculos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [colVeiculos]);

  useEffect(() => {
    const q = query(colCarretas, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setCarretas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [colCarretas]);

  const veiculoPorMotorista = useMemo(() => {
    const map = new Map();
    for (const v of veiculos) {
      const mid = pickMotoristaIdFromDoc(v);
      if (!mid) continue;
      if (!map.has(mid)) map.set(mid, v);
    }
    return map;
  }, [veiculos]);

  const carretaPorMotorista = useMemo(() => {
    const map = new Map();
    for (const c of carretas) {
      const mid = pickMotoristaIdFromDoc(c);
      if (!mid) continue;
      if (!map.has(mid)) map.set(mid, c);
    }
    return map;
  }, [carretas]);

  const days = useMemo(() => buildMonthDays(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);

  const monthLabel = useMemo(() => {
    const m = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }, [viewDate]);

  const canNext = useMemo(() => {
    const limit = new Date(2026, 11, 1, 12, 0, 0);
    return viewDate.getTime() < limit.getTime();
  }, [viewDate]);

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1, 12, 0, 0));
    setDayFilters({});
  }
  function nextMonth() {
    if (!canNext) return;
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1, 12, 0, 0));
    setDayFilters({});
  }

  const cargasIndex = useMemo(() => {
    const idx = new Map();
    const currentYM = ymKey(viewDate);

    for (const c of cargas) {
      const mid = c.motoristaId || "";
      if (!mid) continue;

      const dref = toDateSafe(c.dataRef);
      if (!dref) continue;

      const cYM = ymKey(new Date(dref.getFullYear(), dref.getMonth(), 1, 12, 0, 0));
      if (cYM !== currentYM) continue;

      const k = `${mid}|${dayKey(dref)}`;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(c);
    }

    for (const [k, arr] of idx.entries()) {
      arr.sort((a, b) => {
        const da = toDateSafe(a.createdAt)?.getTime?.() ?? 0;
        const dbb = toDateSafe(b.createdAt)?.getTime?.() ?? 0;
        return da - dbb;
      });
      idx.set(k, arr);
    }

    return idx;
  }, [cargas, viewDate]);

  const statusIndex = useMemo(() => {
    const idx = new Map();
    const currentYM = ymKey(viewDate);

    for (const s of statusMotorista) {
      const mid = s.motoristaId || "";
      if (!mid) continue;

      const dref = toDateSafe(s.dataRef);
      if (!dref) continue;

      const sYM = ymKey(new Date(dref.getFullYear(), dref.getMonth(), 1, 12, 0, 0));
      if (sYM !== currentYM) continue;

      const k = `${mid}|${dayKey(dref)}`;
      idx.set(k, s);
    }

    return idx;
  }, [statusMotorista, viewDate]);

  function cellHasContent(motoristaId, dateObj) {
    const k = `${motoristaId}|${dayKey(dateObj)}`;
    const st = statusIndex.get(k);
    const list = cargasIndex.get(k) || [];
    const hasStatus = !!(st && st.codigo);
    const hasCarga = list.length > 0;
    return hasStatus || hasCarga;
  }

  const matchSet = useMemo(() => {
    const d = inputToDate(filterDay);
    const set = new Set();
    if (!d || !activeFilter) return set;

    const dk = dayKey(d);
    const [kind, value] = activeFilter.split(":");

    if (kind === "motorista") {
      for (const s of statusMotorista) {
        const dref = toDateSafe(s.dataRef);
        if (!dref) continue;
        if (dayKey(dref) !== dk) continue;
        if ((s.codigo || "") === value) set.add(s.motoristaId);
      }
      return set;
    }

    if (kind === "carga") {
      if (value === "TOTAL") {
        for (const c of cargas) {
          const dref = toDateSafe(c.dataRef);
          if (!dref) continue;
          if (dayKey(dref) !== dk) continue;
          if (c.motoristaId) set.add(c.motoristaId);
        }
        return set;
      }

      for (const c of cargas) {
        const dref = toDateSafe(c.dataRef);
        if (!dref) continue;
        if (dayKey(dref) !== dk) continue;

        const st = (c.status || "").toUpperCase();
        if (st === value) set.add(c.motoristaId);
      }
      return set;
    }

    return set;
  }, [filterDay, activeFilter, cargas, statusMotorista]);

  function toggleFilter(key) {
    setActiveFilter((prev) => (prev === key ? null : key));
  }

  const dayKPIs = useMemo(() => {
    const d = inputToDate(filterDay);
    if (!d) {
      return {
        dayLabel: "-",
        cargasTotal: 0,
        aguardandoCarreg: 0,
        aguardandoDesc: 0,
        vazio: 0,
        manut: 0,
        motorista: { P: 0, "P/DS": 0, DS: 0, F: 0, D: 0, A: 0, S: 0, FE: 0 },
      };
    }

    const dk = dayKey(d);

    let cargasTotal = 0;
    let aguardandoCarreg = 0;
    let aguardandoDesc = 0;
    let vazio = 0;
    let manut = 0;

    for (const c of cargas) {
      const dref = toDateSafe(c.dataRef);
      if (!dref) continue;
      if (dayKey(dref) !== dk) continue;

      cargasTotal++;

      const st = (c.status || "").toUpperCase();
      if (st === "AGUARDANDO CARREGAMENTO") aguardandoCarreg++;
      if (st === "AGUARDANDO DESCARGA") aguardandoDesc++;
      if (st === "VAZIO") vazio++;
      if (st === "MANUTENÇÃO") manut++;
    }

    const motorista = { P: 0, "P/DS": 0, DS: 0, F: 0, D: 0, A: 0, S: 0, FE: 0 };
    for (const s of statusMotorista) {
      const dref = toDateSafe(s.dataRef);
      if (!dref) continue;
      if (dayKey(dref) !== dk) continue;

      const code = s.codigo || "";
      if (motorista[code] !== undefined) motorista[code]++;
    }

    return { dayLabel: formatBRDay(d), cargasTotal, aguardandoCarreg, aguardandoDesc, vazio, manut, motorista };
  }, [filterDay, cargas, statusMotorista]);

  // =========================
  // ✅ MODAIS (separados)
  // =========================
  function closeAllModals() {
    setPickerOpen(false);
    setStatusModalOpen(false);
    setCargaModalOpen(false);

    setSelectedCargaId(null);
    setFormCarga(emptyCarga);
    setSelectedStatusId(null);
    setStatusCode("");
    setStatusObs("");
    setRangeFrom("");
    setRangeTo("");
    setModalMotorista(null);
    setModalDate(null);
  }

  function openPicker(motorista, dateObj) {
    setModalMotorista({ id: motorista.id, nome: motorista.nome });
    setModalDate(dateObj);

    const di = dateToInput(dateObj);
    setRangeFrom(di);
    setRangeTo(di);

    setPickerOpen(true);
  }

  function openStatusModal(motorista, dateObj) {
    const key = `${motorista.id}|${dayKey(dateObj)}`;
    const st = statusIndex.get(key) || null;

    setModalMotorista({ id: motorista.id, nome: motorista.nome });
    setModalDate(dateObj);

    const di = dateToInput(dateObj);
    setRangeFrom(di);
    setRangeTo(di);

    if (st) {
      setSelectedStatusId(st.id);
      setStatusCode(st.codigo || "");
      setStatusObs(st.obs || "");
    } else {
      setSelectedStatusId(null);
      setStatusCode("");
      setStatusObs("");
    }

    setPickerOpen(false);
    setCargaModalOpen(false);
    setStatusModalOpen(true);
  }

  function openCargaModal(motorista, dateObj) {
    const key = `${motorista.id}|${dayKey(dateObj)}`;
    const list = cargasIndex.get(key) || [];

    setModalMotorista({ id: motorista.id, nome: motorista.nome });
    setModalDate(dateObj);

    const di = dateToInput(dateObj);
    setRangeFrom(di);
    setRangeTo(di);

    if (list.length > 0) {
      const first = list[0];
      setSelectedCargaId(first.id);
      setFormCarga({
        cidadeOrigem: first.cidadeOrigem || "",
        clienteColeta: first.clienteColeta || "",
        cidadeDestino: first.cidadeDestino || "",
        clienteEntrega: first.clienteEntrega || "",
        status: first.status || "AGUARDANDO DESCARGA",
        dataColeta: first.dataColeta || "",
        dataEntrega: first.dataEntrega || "",
      });
    } else {
      setSelectedCargaId(null);
      setFormCarga(emptyCarga);
    }

    setPickerOpen(false);
    setStatusModalOpen(false);
    setCargaModalOpen(true);
  }

  function onCargaChange(e) {
    const { name, value } = e.target;

    // ✅ ao mudar status para VAZIO/MANUTENÇÃO: mantém só "origem" (cidade atual) + datas
    if (name === "status") {
      const next = value;
      if (isVazioOrManut(next)) {
        setFormCarga((p) => ({
          ...p,
          status: next,
          // mantém origem + datas
          cidadeDestino: "",
          clienteColeta: "",
          clienteEntrega: "",
        }));
        return;
      }
    }

    setFormCarga((p) => ({ ...p, [name]: value }));
  }

  // ✅ resolve: salva dia ou período baseado em rangeFrom/rangeTo
  function resolveDiasParaSalvar() {
    // se não preencher (ou preencher só 1), salva somente o dia do modal
    const d1 = inputToDate(rangeFrom);
    const d2 = inputToDate(rangeTo);

    if (!d1 || !d2) {
      if (!modalDate) return null;
      return [modalDate];
    }

    const range = clampRangeDates(d1, d2);
    if (!range) {
      if (!modalDate) return null;
      return [modalDate];
    }

    const ds = enumerateDays(range.start, range.end);
    return ds;
  }

  async function upsertStatusForDay(motorista, dayDate, code, obs) {
    const meta = getMotoristaStatusMeta(code);
    const dataRefTs = toMiddayTimestamp(dayDate);

    const qFind = query(
      colStatus,
      where("motoristaId", "==", motorista.id),
      where("dataRef", "==", dataRefTs)
    );
    const snap = await getDocs(qFind);

    if (!code) {
      if (!snap.empty) {
        for (const d of snap.docs) await deleteDoc(doc(db, "statusMotorista", d.id));
      }
      return;
    }

    const payload = {
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      dataRef: dataRefTs,

      codigo: code,
      descricao: meta?.label || code,
      corBg: meta?.bg || "#e5e7eb",
      corFg: meta?.fg || "#111827",
      obs: (obs || "").trim(),

      updatedAt: serverTimestamp(),
    };

    if (!snap.empty) {
      const firstId = snap.docs[0].id;
      await updateDoc(doc(db, "statusMotorista", firstId), payload);

      if (snap.docs.length > 1) {
        for (let i = 1; i < snap.docs.length; i++) {
          await deleteDoc(doc(db, "statusMotorista", snap.docs[i].id));
        }
      }
      return;
    }

    await addDoc(colStatus, { ...payload, createdAt: serverTimestamp() });
  }

  // ✅ ÚNICO BOTÃO: SALVAR STATUS (dia ou período)
  async function salvarStatusMotorista() {
    if (!modalMotorista || !modalDate) return;

    const ds = resolveDiasParaSalvar();
    if (!ds || ds.length === 0) {
      alert("Selecione um dia válido para salvar.");
      return;
    }

    if (ds.length > 62) {
      alert("Período muito grande. Use no máximo 62 dias por vez.");
      return;
    }

    try {
      const m = { id: modalMotorista.id, nome: modalMotorista.nome };
      for (const dd of ds) await upsertStatusForDay(m, dd, statusCode, statusObs);

      alert(ds.length === 1 ? "Status do motorista salvo." : `Status salvo no período (${ds.length} dia(s)).`);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar status do motorista.");
    }
  }

  async function upsertCargaForDay(motorista, dayDate, form, overrideStatus = null) {
    const dataRefTs = toMiddayTimestamp(dayDate);

    const qFind = query(
      colCargas,
      where("motoristaId", "==", motorista.id),
      where("dataRef", "==", dataRefTs)
    );
    const snap = await getDocs(qFind);

    const statusFinal = (overrideStatus ?? form.status ?? "").toString().trim();

    const payload = {
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      dataRef: dataRefTs,

      cidadeOrigem: (form.cidadeOrigem || "").trim(),
      clienteColeta: (form.clienteColeta || "").trim(),
      cidadeDestino: (form.cidadeDestino || "").trim(),
      clienteEntrega: (form.clienteEntrega || "").trim(),
      status: statusFinal,

      dataColeta: (form.dataColeta || "").trim(),
      dataEntrega: (form.dataEntrega || "").trim(),

      updatedAt: serverTimestamp(),
    };

    if (!payload.status) throw new Error("Sem status de carga.");

    // ✅ se for VAZIO/MANUTENÇÃO: garante “somente origem”
    if (isVazioOrManut(payload.status)) {
      payload.clienteColeta = "";
      payload.cidadeDestino = "";
      payload.clienteEntrega = "";
    }

    if (!snap.empty) {
      const firstId = snap.docs[0].id;
      await updateDoc(doc(db, "cargas", firstId), payload);

      if (snap.docs.length > 1) {
        for (let i = 1; i < snap.docs.length; i++) {
          await deleteDoc(doc(db, "cargas", snap.docs[i].id));
        }
      }
      return;
    }

    await addDoc(colCargas, { ...payload, createdAt: serverTimestamp() });
  }

  function getAutoDaysFromColetaEntrega(form) {
    const out = { coleta: null, entrega: null };

    const dC = parseBRDateTime(form?.dataColeta);
    const dE = parseBRDateTime(form?.dataEntrega);

    if (dC) out.coleta = new Date(dC.getFullYear(), dC.getMonth(), dC.getDate(), 12, 0, 0);
    if (dE) out.entrega = new Date(dE.getFullYear(), dE.getMonth(), dE.getDate(), 12, 0, 0);

    return out;
  }

  // ✅ ÚNICO BOTÃO: SALVAR CARGA (dia ou período)
  // + se preencher dataColeta/dataEntrega: salva também nos dias dessas datas
  //   - dia da entrega salva com status "AGUARDANDO DESCARGA"
  async function salvarCarga() {
    if (!modalMotorista || !modalDate) return;

    if (!formCarga.status) {
      alert("Escolha o status da carga.");
      return;
    }

    // valida formato se o usuário digitou algo manualmente
    if (formCarga.dataColeta && !parseBRDateTime(formCarga.dataColeta)) {
      alert('Data/Hora Coleta inválida. Use "dd/mm/aaaa hh:mm" (ex: 09/02/2026 11:00).');
      return;
    }
    if (formCarga.dataEntrega && !parseBRDateTime(formCarga.dataEntrega)) {
      alert('Data/Hora Entrega inválida. Use "dd/mm/aaaa hh:mm" (ex: 10/02/2026 05:00).');
      return;
    }

    const ds = resolveDiasParaSalvar();
    if (!ds || ds.length === 0) {
      alert("Selecione um dia válido para salvar.");
      return;
    }

    if (ds.length > 62) {
      alert("Período muito grande. Use no máximo 62 dias por vez.");
      return;
    }

    try {
      const m = { id: modalMotorista.id, nome: modalMotorista.nome };

      // 1) salva no dia/período escolhido (como já era)
      for (const dd of ds) await upsertCargaForDay(m, dd, formCarga);

      // 2) ✅ auto-insere no dia da coleta e no dia da entrega (se preenchidos)
      const { coleta, entrega } = getAutoDaysFromColetaEntrega(formCarga);

      if (coleta) {
        await upsertCargaForDay(m, coleta, formCarga);
      }
      if (entrega) {
        await upsertCargaForDay(m, entrega, formCarga, "AGUARDANDO DESCARGA");
      }

      const extras = [coleta, entrega].filter(Boolean).length;
      if (ds.length === 1 && extras === 0) {
        alert("Carga salva.");
      } else {
        const msg =
          ds.length === 1
            ? `Carga salva. (+${extras} dia(s) automático(s) por coleta/entrega)`
            : `Carga salva no período (${ds.length} dia(s)). (+${extras} dia(s) automático(s) por coleta/entrega)`;
        alert(msg);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a carga.");
    }
  }

  async function excluirCargaDia() {
    if (!modalMotorista || !modalDate) return;

    const dataRefTs = toMiddayTimestamp(modalDate);

    try {
      const qFind = query(
        colCargas,
        where("motoristaId", "==", modalMotorista.id),
        where("dataRef", "==", dataRefTs)
      );
      const snap = await getDocs(qFind);
      if (snap.empty) {
        alert("Não existe carga neste dia para excluir.");
        return;
      }
      if (!confirm("Excluir carga deste dia?")) return;

      for (const d of snap.docs) await deleteDoc(doc(db, "cargas", d.id));

      setSelectedCargaId(null);
      setFormCarga(emptyCarga);
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir a carga do dia.");
    }
  }

  function renderDriverDayStatus(motoristaId, dateObj) {
    const key = `${motoristaId}|${dayKey(dateObj)}`;
    const st = statusIndex.get(key);
    if (!st || !st.codigo) return null;

    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 11,
            border: `1px solid ${TG.border}`,
            background: st.corBg || "#e5e7eb",
            color: st.corFg || "#111827",
            width: "fit-content",
          }}
          title={st.descricao || st.codigo}
        >
          {st.codigo}
        </div>

        {st.obs ? (
          <div style={{ fontSize: 11, fontWeight: 600, color: TG.muted, lineHeight: 1.1 }}>
            {st.obs}
          </div>
        ) : null}
      </div>
    );
  }

  function renderCargasCell(motoristaId, dateObj) {
    const key = `${motoristaId}|${dayKey(dateObj)}`;
    const list = cargasIndex.get(key) || [];
    if (list.length === 0) return null;

    const c = list[0];
    const badge = cargaStatusBadgeStyle(c.status);
    const onlyOrigem = isVazioOrManut(c.status);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={cellBox}>
          <div style={{ ...statusBadge, background: badge.bg, color: badge.fg }}>
            {c.status || "STATUS"}
          </div>

          <div style={cellLine}>
            <b>{onlyOrigem ? "Cidade atual:" : "Origem:"}</b> {c.cidadeOrigem || "-"}
          </div>

          {!onlyOrigem ? (
            <>
              <div style={cellLine}><b>Cliente coleta:</b> {c.clienteColeta || "-"}</div>
              <div style={cellLine}><b>Destino:</b> {c.cidadeDestino || "-"}</div>
              <div style={cellLine}><b>Cliente destino:</b> {c.clienteEntrega || "-"}</div>
            </>
          ) : null}

          {c.dataColeta ? <div style={cellLine}><b>Coleta:</b> {c.dataColeta}</div> : null}
          {c.dataEntrega ? <div style={cellLine}><b>Entrega:</b> {c.dataEntrega}</div> : null}
        </div>

        {list.length > 1 ? (
          <div style={{ fontSize: 11, fontWeight: 600, color: TG.blueDark }}>
            +{list.length - 1} carga(s)
          </div>
        ) : null}
      </div>
    );
  }

  const visibleMotoristas = useMemo(() => {
    const term = (searchNome || "").trim().toLowerCase();
    const activeDayFilters = Object.entries(dayFilters || {}).filter(([, v]) => v && v !== "all");

    return (motoristas || []).filter((m) => {
      if (term) {
        const nome = (m?.nome || "").toString().toLowerCase();
        if (!nome.includes(term)) return false;
      }

      for (const [dk, mode] of activeDayFilters) {
        const dateObj = inputToDate(dk);
        if (!dateObj) continue;

        const has = cellHasContent(m.id, dateObj);
        if (mode === "filled" && !has) return false;
        if (mode === "empty" && has) return false;
      }

      return true;
    });
  }, [motoristas, searchNome, dayFilters, statusIndex, cargasIndex, viewDate]);

  function setDayFilter(dateObj, mode) {
    const dk = dayKey(dateObj);
    setDayFilters((p) => ({ ...(p || {}), [dk]: mode }));
  }
  function clearDayFilters() {
    setDayFilters({});
  }

  const tdDayFinal = useMemo(() => {
    if (!compact) return tdDay;
    return { ...tdDay, minWidth: 160, height: 150, padding: 8 };
  }, [compact]);

  const tdStickyLeftFinal = useMemo(() => {
    if (!compact) return tdStickyLeft;
    return { ...tdStickyLeft, minWidth: 280, padding: 10 };
  }, [compact]);

  const thDayFinal = useMemo(() => {
    if (!compact) return thDay;
    return { ...thDay, minWidth: 160, padding: 6 };
  }, [compact]);

  function toggleVinculo(motoristaId) {
    setOpenVinculos((p) => ({ ...(p || {}), [motoristaId]: !(p?.[motoristaId] ?? false) }));
  }

  const onlyOrigemMode = useMemo(() => isVazioOrManut(formCarga.status), [formCarga.status]);

  return (
    <div style={{ background: TG.bg, minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={header}>
        <div style={headerLeft}>
          <div>
            <h1 style={{ margin: 0, color: TG.white, fontSize: 24 }}>TG Logística</h1>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
              Cargas • KPIs do dia (clique para destacar)
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* PAINEL DO DIA */}
        <div style={kpiPanel}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 700, color: TG.black }}>Resumo do dia:</div>
              <input
                type="date"
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                style={{ ...input, width: 180 }}
              />
              <div style={{ fontSize: 12, fontWeight: 600, color: TG.muted }}>
                {dayKPIs.dayLabel}
              </div>

              {activeFilter ? (
                <button onClick={() => setActiveFilter(null)} style={btnClear}>
                  Limpar destaque
                </button>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <KPI title="Cargas (total)" value={dayKPIs.cargasTotal} active={activeFilter === "carga:TOTAL"} onClick={() => toggleFilter("carga:TOTAL")} />
              <KPI title="Aguard. carreg." value={dayKPIs.aguardandoCarreg} active={activeFilter === "carga:AGUARDANDO CARREGAMENTO"} onClick={() => toggleFilter("carga:AGUARDANDO CARREGAMENTO")} />
              <KPI title="Aguard. descarga" value={dayKPIs.aguardandoDesc} active={activeFilter === "carga:AGUARDANDO DESCARGA"} onClick={() => toggleFilter("carga:AGUARDANDO DESCARGA")} />
              <KPI title="Vazio" value={dayKPIs.vazio} active={activeFilter === "carga:VAZIO"} onClick={() => toggleFilter("carga:VAZIO")} />
              <KPI title="Manutenção" value={dayKPIs.manut} active={activeFilter === "carga:MANUTENÇÃO"} onClick={() => toggleFilter("carga:MANUTENÇÃO")} />
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <KPIBadge code="P" meta={getMotoristaStatusMeta("P")} value={dayKPIs.motorista.P} active={activeFilter === "motorista:P"} onClick={() => toggleFilter("motorista:P")} />
            <KPIBadge code="P/DS" meta={getMotoristaStatusMeta("P/DS")} value={dayKPIs.motorista["P/DS"]} active={activeFilter === "motorista:P/DS"} onClick={() => toggleFilter("motorista:P/DS")} />
            <KPIBadge code="DS" meta={getMotoristaStatusMeta("DS")} value={dayKPIs.motorista.DS} active={activeFilter === "motorista:DS"} onClick={() => toggleFilter("motorista:DS")} />
            <KPIBadge code="FE" meta={getMotoristaStatusMeta("FE")} value={dayKPIs.motorista.FE} active={activeFilter === "motorista:FE"} onClick={() => toggleFilter("motorista:FE")} />
            <KPIBadge code="A" meta={getMotoristaStatusMeta("A")} value={dayKPIs.motorista.A} active={activeFilter === "motorista:A"} onClick={() => toggleFilter("motorista:A")} />
            <KPIBadge code="F" meta={getMotoristaStatusMeta("F")} value={dayKPIs.motorista.F} active={activeFilter === "motorista:F"} onClick={() => toggleFilter("motorista:F")} />
            <KPIBadge code="S" meta={getMotoristaStatusMeta("S")} value={dayKPIs.motorista.S} active={activeFilter === "motorista:S"} onClick={() => toggleFilter("motorista:S")} />
            <KPIBadge code="D" meta={getMotoristaStatusMeta("D")} value={dayKPIs.motorista.D} active={activeFilter === "motorista:D"} onClick={() => toggleFilter("motorista:D")} />
          </div>
        </div>

        {/* CONTROLES MÊS + PESQUISA (STICKY) */}
        <div style={toolbarSticky}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={prevMonth} style={btnGhost}>◀</button>
            <div style={{ fontWeight: 700, color: TG.black, fontSize: 16 }}>{monthLabel}</div>
            <button onClick={nextMonth} style={{ ...btnGhost, opacity: canNext ? 1 : 0.4 }} disabled={!canNext}>▶</button>

            <button onClick={goToday} style={{ ...btnSmall, borderColor: TG.blue, color: TG.blueDark }}>
              📍 Hoje
            </button>

            <button
              onClick={() => setCompact((v) => !v)}
              style={{ ...btnSmall, background: compact ? TG.blueLight : TG.white, borderColor: compact ? TG.blue : TG.border }}
              title="Mostra mais linhas e deixa tudo mais compacto"
            >
              {compact ? "✅ Compacto" : "Compacto"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={searchNome}
                onChange={(e) => setSearchNome(e.target.value)}
                placeholder="Pesquisar motorista..."
                style={{ ...input, width: 260 }}
              />
              {searchNome ? (
                <button onClick={() => setSearchNome("")} style={btnClear}>Limpar pesquisa</button>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={clearDayFilters} style={btnClear}>
                Limpar filtros de colunas
              </button>
              <div style={{ fontSize: 12, color: TG.muted, fontWeight: 600 }}>
                Dica: no topo de cada dia, escolha <b>Vazios</b> ou <b>Preenchidos</b>.
              </div>
            </div>
          </div>
        </div>

        {/* PLANILHA */}
        <div style={sheetWrap} ref={sheetWrapRef}>
          <table style={sheetTable}>
            <thead>
              <tr>
                <th style={{ ...thStickyLeft, minWidth: compact ? 280 : 300 }}>
                  Motorista (A-Z)
                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                    Exibindo: {visibleMotoristas.length} / {motoristas.length}
                  </div>
                </th>

                {days.map((d) => {
                  const dk = dayKey(d);
                  const mode = dayFilters?.[dk] || "all";
                  const todayCol = isTodayColumn(d);

                  return (
                    <th
                      key={dk}
                      ref={(el) => {
                        if (el) dayHeaderRefs.current[dk] = el;
                      }}
                      style={{
                        ...thDayFinal,
                        background: isWeekend(d) ? "#f3f4f6" : TG.black,
                        color: isWeekend(d) ? TG.black : TG.white,
                        boxShadow: todayCol ? `inset 0 -3px 0 ${TG.blue}` : "none",
                        outline: todayCol ? `2px solid ${TG.blue}` : "none",
                        outlineOffset: -2,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{pad2(d.getDate())}</div>
                      <div style={{ fontSize: 11, opacity: 0.9 }}>{weekdayShort(d)}</div>

                      <div style={{ marginTop: 8 }}>
                        <select
                          value={mode}
                          onChange={(e) => setDayFilter(d, e.target.value)}
                          style={{
                            width: "100%",
                            padding: compact ? "5px 8px" : "6px 8px",
                            borderRadius: 8,
                            border: `1px solid ${TG.border}`,
                            fontSize: 12,
                            fontWeight: 700,
                            outline: "none",
                            background: TG.white,
                            color: TG.text,
                          }}
                          title="Filtro da coluna: todos / preenchidos / vazios"
                        >
                          <option value="all">Todos</option>
                          <option value="filled">Preenchidos</option>
                          <option value="empty">Vazios</option>
                        </select>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {motoristas.length === 0 ? (
                <tr>
                  <td style={tdEmpty} colSpan={days.length + 1}>Nenhum motorista cadastrado</td>
                </tr>
              ) : visibleMotoristas.length === 0 ? (
                <tr>
                  <td style={tdEmpty} colSpan={days.length + 1}>
                    Nenhum motorista encontrado com os filtros/pesquisa atuais.
                  </td>
                </tr>
              ) : (
                visibleMotoristas.map((m, idx) => {
                  const matched = !activeFilter || matchSet.has(m.id);
                  const rowOpacity = matched ? 1 : 0.25;
                  const rowOutline = matched && activeFilter ? `2px solid ${TG.blue}` : "none";

                  const vinc = getVinculo(m);
                  const temMopp = getTemMopp(m);
                  const motDe = getMotoristaDe(m);

                  const zebraBg = idx % 2 === 0 ? TG.white : "#f9fafb";

                  const v = veiculoPorMotorista.get(m.id) || null;
                  const c = carretaPorMotorista.get(m.id) || null;

                  const isOpenV = !!openVinculos?.[m.id];

                  return (
                    <tr
                      key={m.id}
                      style={{
                        background: zebraBg,
                        opacity: rowOpacity,
                        outline: rowOutline,
                        outlineOffset: -2,
                        transition: "opacity .15s ease",
                      }}
                    >
                      {/* COLUNA FIXA (ESQUERDA) */}
                      <td style={{ ...tdStickyLeftFinal, background: zebraBg }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontWeight: 800, color: TG.text }}>{m.nome}</span>

                          <span style={{ fontSize: 12, color: TG.muted }}>
                            {m.cidadeResidencia || "-"}
                          </span>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            {motDe ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  border: `1px solid ${TG.border}`,
                                  background: "#e5e7eb",
                                  color: "#111827",
                                  width: "fit-content",
                                }}
                                title="Motorista de"
                              >
                                {motDe}
                              </span>
                            ) : null}

                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: 999,
                                border: `1px solid ${TG.border}`,
                                background: TG.blueLight,
                                color: TG.blueDark,
                                width: "fit-content",
                              }}
                              title="Vínculo"
                            >
                              {vinc || "Sem vínculo"}
                            </span>

                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: 999,
                                border: `1px solid ${TG.border}`,
                                background: temMopp ? "#d1fae5" : "#fee2e2",
                                color: temMopp ? "#065f46" : "#991b1b",
                                width: "fit-content",
                              }}
                              title="Tem MOPP?"
                            >
                              MOPP: {temMopp ? "Sim" : "Não"}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: `1px dashed ${TG.border}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              fontSize: 12,
                              color: TG.text,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleVinculo(m.id)}
                              style={{
                                ...btnSmall,
                                padding: "6px 10px",
                                width: "fit-content",
                                background: isOpenV ? TG.blueLight : TG.white,
                                borderColor: isOpenV ? TG.blue : TG.border,
                                color: isOpenV ? TG.blueDark : TG.black,
                              }}
                              title="Expandir/ocultar informações de veículo e carreta"
                            >
                              {isOpenV ? "▾ Veículo/Carreta" : "▸ Veículo/Carreta"}
                            </button>

                            {isOpenV ? (
                              <>
                                <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                                  🚛 Veículo <span style={{ color: TG.muted, fontWeight: 700 }}>/</span> 🚚 Carreta
                                </div>

                                <div style={{ fontWeight: 700 }}>
                                  Veículo:{" "}
                                  <span style={{ fontWeight: 700, color: v ? TG.text : TG.muted, fontStyle: v ? "normal" : "italic" }}>
                                    {fmtVeiculo(v)}
                                  </span>
                                </div>

                                <div style={{ fontWeight: 700 }}>
                                  Carreta:{" "}
                                  <span style={{ fontWeight: 700, color: c ? TG.text : TG.muted, fontStyle: c ? "normal" : "italic" }}>
                                    {fmtCarreta(c)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: 11, color: TG.muted, fontWeight: 700 }}>
                                {v?.placa ? `🚛 ${v.placa}` : "🚛 (sem veículo)"}{" "}
                                {c?.placaCarreta || c?.placa ? `• 🚚 ${c.placaCarreta || c.placa}` : "• 🚚 (sem carreta)"}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {days.map((d) => {
                        const todayCol = isTodayColumn(d);
                        const dk = dayKey(d);

                        const contentStatus = renderDriverDayStatus(m.id, d);
                        const contentCarga = renderCargasCell(m.id, d);

                        const hasAnything = !!contentStatus || !!contentCarga;
                        const dynamicBg = getCellBackground(m.id, d, statusIndex, cargasIndex);

                        return (
                          <td
                            key={`${m.id}-${dk}`}
                            onClick={() => openPicker(m, d)}
                            style={{
                              ...tdDayFinal,
                              background:
                                dynamicBg ||
                                (todayCol
                                  ? TG.blueLight
                                  : isWeekend(d)
                                  ? "#f9fafb"
                                  : "transparent"),
                              cursor: "pointer",
                              borderLeft: `1px solid ${TG.border}`,
                              outline: todayCol ? `2px solid ${TG.blue}` : "none",
                              outlineOffset: -2,
                              transition: "background .15s ease, outline .15s ease",
                            }}
                            title="Clique para escolher: Status ou Carga"
                            onMouseEnter={(e) => {
                              if (!dynamicBg) {
                                e.currentTarget.style.background =
                                  todayCol ? TG.blueLight : (isWeekend(d) ? "#f3f4f6" : "#f8fafc");
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!dynamicBg) {
                                e.currentTarget.style.background =
                                  todayCol ? TG.blueLight : (isWeekend(d) ? "#f9fafb" : "transparent");
                              }
                            }}
                          >
                            {contentStatus ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStatusModal(m, d);
                                }}
                                style={{ cursor: "pointer" }}
                                title="Clique para editar o STATUS do motorista"
                              >
                                {contentStatus}
                              </div>
                            ) : null}

                            {contentCarga ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCargaModal(m, d);
                                }}
                                style={{ cursor: "pointer" }}
                                title="Clique para editar a CARGA do dia"
                              >
                                {contentCarga}
                              </div>
                            ) : null}

                            {!hasAnything ? (
                              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStatusModal(m, d);
                                  }}
                                  style={{ ...btnSmall, padding: "6px 10px" }}
                                >
                                  Status
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCargaModal(m, d);
                                  }}
                                  style={{ ...btnSmall, padding: "6px 10px", borderColor: TG.blue, color: TG.blueDark }}
                                >
                                  Carga
                                </button>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================
          MODAL 1: PICKER
      ========================== */}
      {pickerOpen && (
        <div style={modalOverlayStyle} onMouseDown={closeAllModals}>
          <div style={modalCardSmall} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, color: TG.black, fontSize: 18 }}>Dia do motorista</div>
                <div style={{ fontSize: 12, color: TG.muted, fontWeight: 700 }}>
                  {modalMotorista?.nome} • {modalDate ? formatBRDay(modalDate) : ""}
                </div>
              </div>
              <button onClick={closeAllModals} style={btnGhost}>✕</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: TG.muted, marginBottom: 10 }}>
                O que você quer lançar/editar?
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => openStatusModal({ id: modalMotorista.id, nome: modalMotorista.nome }, modalDate)}
                  style={{ ...btnPrimary, flex: "1 1 240px" }}
                >
                  🧑‍✈️ Status do motorista
                </button>

                <button
                  onClick={() => openCargaModal({ id: modalMotorista.id, nome: modalMotorista.nome }, modalDate)}
                  style={{ ...btnSecondary, flex: "1 1 240px" }}
                >
                  🚚 Carga do dia
                </button>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: TG.muted, fontWeight: 700 }}>
                Dica: clique direto no badge do status ou no bloco da carga para abrir o modal certo.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          MODAL 2: STATUS
      ========================== */}
      {statusModalOpen && (
        <div style={modalOverlayStyle} onMouseDown={closeAllModals}>
          <div style={modalCardStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, color: TG.black, fontSize: 18 }}>Status do motorista</div>
                <div style={{ fontSize: 12, color: TG.muted, fontWeight: 700 }}>
                  {modalMotorista?.nome} • {modalDate ? formatBRDay(modalDate) : ""}
                </div>
              </div>
              <button onClick={closeAllModals} style={btnGhost}>✕</button>
            </div>

            <div style={rangeBar}>
              <div style={{ fontWeight: 800, color: TG.black }}>Aplicar por período (opcional)</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={rangeLabel}>
                  De:
                  <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} style={{ ...input, width: 150 }} />
                </label>
                <label style={rangeLabel}>
                  Até:
                  <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} style={{ ...input, width: 150 }} />
                </label>
                <div style={{ fontSize: 12, fontWeight: 700, color: TG.muted }}>
                  * Se não preencher as datas, salva só no dia.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={blockTitle}>Status do motorista (P / DS / FE / etc)</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
                <Input span={4} label="Código">
                  <select value={statusCode} onChange={(e) => setStatusCode(e.target.value)} style={input}>
                    <option value="">(remover status)</option>
                    {motoristaStatusOptions.map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </Input>

                <Input span={8} label="Observação (fica nos dias aplicados)">
                  <input value={statusObs} onChange={(e) => setStatusObs(e.target.value)} style={input} />
                </Input>

                <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={salvarStatusMotorista} style={btnPrimary}>Salvar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          MODAL 3: CARGA
      ========================== */}
      {cargaModalOpen && (
        <div style={modalOverlayStyle} onMouseDown={closeAllModals}>
          <div style={modalCardStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, color: TG.black, fontSize: 18 }}>Carga do dia</div>
                <div style={{ fontSize: 12, color: TG.muted, fontWeight: 700 }}>
                  {modalMotorista?.nome} • {modalDate ? formatBRDay(modalDate) : ""}
                </div>
              </div>
              <button onClick={closeAllModals} style={btnGhost}>✕</button>
            </div>

            <div style={rangeBar}>
              <div style={{ fontWeight: 800, color: TG.black }}>Aplicar por período (opcional)</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={rangeLabel}>
                  De:
                  <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} style={{ ...input, width: 150 }} />
                </label>
                <label style={rangeLabel}>
                  Até:
                  <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} style={{ ...input, width: 150 }} />
                </label>
                <div style={{ fontSize: 12, fontWeight: 700, color: TG.muted }}>
                  * Se não preencher as datas, salva só no dia.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={blockTitle}>Dados da carga</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
                <Input span={12} label="Status da carga (operação)">
                  <select name="status" value={formCarga.status} onChange={onCargaChange} style={input}>
                    {cargaStatusOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Input>

                <Input span={6} label={onlyOrigemMode ? "Cidade atual (Cidade - UF)" : "Origem (Cidade - UF)"}>
                  <input name="cidadeOrigem" value={formCarga.cidadeOrigem} onChange={onCargaChange} style={input} />
                </Input>

                {!onlyOrigemMode ? (
                  <Input span={6} label="Cliente coleta">
                    <input name="clienteColeta" value={formCarga.clienteColeta} onChange={onCargaChange} style={input} />
                  </Input>
                ) : (
                  <div style={{ gridColumn: "span 6" }} />
                )}

                {!onlyOrigemMode ? (
                  <>
                    <Input span={6} label="Destino (Cidade - UF)">
                      <input name="cidadeDestino" value={formCarga.cidadeDestino} onChange={onCargaChange} style={input} />
                    </Input>

                    <Input span={6} label="Cliente destino">
                      <input name="clienteEntrega" value={formCarga.clienteEntrega} onChange={onCargaChange} style={input} />
                    </Input>
                  </>
                ) : null}

                <Input span={6} label="Data/Hora Coleta — opcional (calendário + relógio)">
                  <DateTimeBRPicker
                    name="dataColeta"
                    value={formCarga.dataColeta}
                    onChange={onCargaChange}
                    placeholder='ex: 09/02/2026 11:00'
                  />
                </Input>

                <Input span={6} label="Data/Hora Entrega — opcional (calendário + relógio)">
                  <DateTimeBRPicker
                    name="dataEntrega"
                    value={formCarga.dataEntrega}
                    onChange={onCargaChange}
                    placeholder='ex: 10/02/2026 05:00'
                  />
                </Input>

                <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={excluirCargaDia} style={btnDangerMini}>Excluir carga (dia)</button>
                  <button onClick={salvarCarga} style={btnPrimary}>Salvar</button>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: TG.muted, fontWeight: 700 }}>
                * Se você preencher <b>Data/Hora Coleta</b> e/ou <b>Data/Hora Entrega</b>, ao salvar o sistema também grava automaticamente:
                <br />
                - No <b>dia da coleta</b>: mesmas informações e status selecionado
                <br />
                - No <b>dia da entrega</b>: mesmas informações, mas status vira <b>AGUARDANDO DESCARGA</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
