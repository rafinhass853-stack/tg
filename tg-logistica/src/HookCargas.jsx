// src/HookCargas.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
   STATUS / OPTIONS
========================= */
export const cargaStatusOptions = [
  "AGUARDANDO CARREGAMENTO",
  "EM ROTA PARA A COLETA",
  "EM ROTA PARA A ENTREGA",
  "AGUARDANDO DESCARGA",
  "VAZIO",
  "MANUTENÇÃO",
];

export const motoristaStatusOptions = [
  { code: "P", label: "P — Trabalhado", bg: "#10b981", fg: "#ffffff" },
  { code: "P/DS", label: "P/DS — Meio período", bg: "#f59e0b", fg: "#111827" },
  { code: "DS", label: "DS — Descanso semanal", bg: "#ec4899", fg: "#ffffff" },
  { code: "F", label: "F — Falta", bg: "#f97316", fg: "#111827" },
  { code: "D", label: "D — Demitido", bg: "#dc2626", fg: "#ffffff" },
  { code: "A", label: "A — Atestado", bg: "#eab308", fg: "#111827" },
  { code: "S", label: "S — Suspenso", bg: "#000000", fg: "#ffffff" },
  { code: "FE", label: "FE — Férias", bg: "#0066cc", fg: "#ffffff" },
];

export function getMotoristaStatusMeta(code) {
  return motoristaStatusOptions.find((x) => x.code === code) || null;
}

/* =========================
   HELPERS (datas)
========================= */
export function pad2(n) {
  return String(n).padStart(2, "0");
}
export function ymKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
export function dayKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}
export function weekdayShort(d) {
  const w = d.getDay();
  return ["D", "S", "T", "Q", "Q", "S", "S"][w];
}
export function buildMonthDays(year, monthIndex0) {
  const first = new Date(year, monthIndex0, 1);
  const days = [];
  const d = new Date(first);
  while (d.getMonth() === monthIndex0) {
    const item = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    item.__dayKey = dayKey(item); // 👈 para evitar recomputar em todo render
    days.push(item);
    d.setDate(d.getDate() + 1);
  }
  return days;
}
export function formatBRDay(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function toMiddayTimestamp(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 12, 0, 0);
  return Timestamp.fromDate(d);
}
export function toDateSafe(ts) {
  if (!ts) return null;
  return ts?.toDate ? ts.toDate() : new Date(ts);
}
export function dateToInput(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function inputToDate(v) {
  if (!v) return null;
  const [y, m, dd] = v.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd, 12, 0, 0);
}
export function clampRangeDates(a, b) {
  if (!a || !b) return null;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12, 0, 0);
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 12, 0, 0);
  if (start.getTime() > end.getTime()) return { start: end, end: start };
  return { start, end };
}
export function enumerateDays(start, end) {
  const out = [];
  const d = new Date(start);
  while (d.getTime() <= end.getTime()) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* =========================
   HELPERS (motorista)
========================= */
export function getTemMopp(m) {
  const v =
    m?.temMopp ??
    m?.temMOPP ??
    m?.mopp ??
    m?.tem_mopp ??
    m?.temMOPPBool ??
    m?.MOPP;

  return v === true || v === "Sim" || v === "SIM" || v === "sim" || v === 1 || v === "1";
}
export function getVinculo(m) {
  const v = m?.vinculo ?? m?.vínculo ?? m?.Vinculo ?? m?.VINCULO ?? "";
  return (v || "").toString().trim();
}
export function getMotoristaDe(m) {
  const v = m?.motoristaDe ?? m?.motorista_de ?? m?.tipo ?? m?.categoria ?? "";
  return (v || "").toString().trim();
}

/* =========================
   Carga badge
========================= */
export function cargaStatusBadgeStyle(status) {
  const s = (status || "").toUpperCase();
  if (s.includes("AGUARDANDO CARREG")) return { bg: "#fef3c7", fg: "#92400e" };
  if (s.includes("EM ROTA PARA A COLETA")) return { bg: "#dbeafe", fg: "#1e40af" };
  if (s.includes("EM ROTA PARA A ENTREGA")) return { bg: "#93c5fd", fg: "#1e3a8a" };
  if (s.includes("AGUARDANDO DESC")) return { bg: "#e5e7eb", fg: "#374151" };
  if (s.includes("VAZIO")) return { bg: "#d1fae5", fg: "#065f46" };
  if (s.includes("MANUT")) return { bg: "#fed7aa", fg: "#7c2d12" };
  return { bg: "#e6f2ff", fg: "#004d99" };
}

/* =========================
   emptyCarga
========================= */
export const emptyCarga = {
  cidadeOrigem: "",
  clienteColeta: "",
  cidadeDestino: "",
  clienteEntrega: "",
  status: "AGUARDANDO DESCARGA",
  dataColeta: "",
  dataEntrega: "",
};

/* =========================
   vínculo veiculo/carreta
========================= */
export function pickMotoristaIdFromDoc(docObj) {
  return (
    docObj?.motoristaId ??
    docObj?.motorista_id ??
    docObj?.driverId ??
    docObj?.driver_id ??
    ""
  );
}
export function fmtVeiculo(v) {
  if (!v) return "(sem veículo)";
  const placa = v.placa || "-";
  const tipo = v.tipo || "-";
  const st = v.statusManutencao || "-";
  return `${placa} • ${tipo} • ${st}`;
}
export function fmtCarreta(c) {
  if (!c) return "(sem carreta)";
  const placa = c.placaCarreta || c.placa || "-";
  const tipo = c.tipoCarreta || c.tipo || "-";
  const eixos = c.eixos ? `${c.eixos} eixos` : "";
  const st = c.statusManutencao || "-";
  const mid = [placa, tipo, eixos].filter(Boolean).join(" • ");
  return `${mid} • ${st}`;
}

/* =========================
   cor da célula
========================= */
export function getCellBackground(motoristaId, dateObj, statusIndex, cargasIndex) {
  const key = `${motoristaId}|${dateObj.__dayKey ?? dayKey(dateObj)}`;

  const st = statusIndex.get(key);
  const cargas = cargasIndex.get(key) || [];

  const hasStatus = !!(st && st.codigo);
  const hasCarga = cargas.length > 0;

  if (st?.codigo === "F") return "#fee2e2";
  if (st?.codigo === "D") return "#e5e7eb";
  if (st?.codigo === "FE") return "#fce7f3";
  if (st?.codigo === "DS") return "#f3e8ff";
  if (st?.codigo === "A") return "#fef9c3";

  if (hasStatus && hasCarga) return "#dcfce7";
  if (hasCarga) return "#fef3c7";
  if (hasStatus) return "#e0f2fe";

  return null;
}

/* =========================
   ✅ HOOK PRINCIPAL
========================= */
export function useCargas() {
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [cargaModalOpen, setCargaModalOpen] = useState(false);

  const [modalMotorista, setModalMotorista] = useState(null);
  const [modalDate, setModalDate] = useState(null);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [formCarga, setFormCarga] = useState(emptyCarga);
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

  const days = useMemo(() => buildMonthDays(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);

  const monthLabel = useMemo(() => {
    const m = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }, [viewDate]);

  const canNext = useMemo(() => {
    const limit = new Date(2026, 11, 1, 12, 0, 0);
    return viewDate.getTime() < limit.getTime();
  }, [viewDate]);

  function isTodayColumn(d) {
    return (d.__dayKey ?? dayKey(d)) === todayKey;
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

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1, 12, 0, 0));
    setDayFilters({});
  }
  function nextMonth() {
    if (!canNext) return;
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1, 12, 0, 0));
    setDayFilters({});
  }

  /* =========================
     Subscriptions
  ========================= */
  useEffect(() => {
    const q = query(colMotoristas, orderBy("nome", "asc"));
    return onSnapshot(q, (snap) => setMotoristas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [colMotoristas]);

  useEffect(() => {
    const q = query(colCargas, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setCargas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [colCargas]);

  useEffect(() => {
    const q = query(colStatus, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setStatusMotorista(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [colStatus]);

  useEffect(() => {
    const q = query(colVeiculos, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setVeiculos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [colVeiculos]);

  useEffect(() => {
    const q = query(colCarretas, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setCarretas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
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
      arr.sort((a, b) => (toDateSafe(a.createdAt)?.getTime?.() ?? 0) - (toDateSafe(b.createdAt)?.getTime?.() ?? 0));
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
    const k = `${motoristaId}|${dateObj.__dayKey ?? dayKey(dateObj)}`;
    const st = statusIndex.get(k);
    const list = cargasIndex.get(k) || [];
    return !!(st && st.codigo) || list.length > 0;
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
        if ((c.status || "").toUpperCase() === value) set.add(c.motoristaId);
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

  function closeAllModals() {
    setPickerOpen(false);
    setStatusModalOpen(false);
    setCargaModalOpen(false);

    setFormCarga(emptyCarga);
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
    const key = `${motorista.id}|${dateObj.__dayKey ?? dayKey(dateObj)}`;
    const st = statusIndex.get(key) || null;

    setModalMotorista({ id: motorista.id, nome: motorista.nome });
    setModalDate(dateObj);

    const di = dateToInput(dateObj);
    setRangeFrom(di);
    setRangeTo(di);

    if (st) {
      setStatusCode(st.codigo || "");
      setStatusObs(st.obs || "");
    } else {
      setStatusCode("");
      setStatusObs("");
    }

    setPickerOpen(false);
    setCargaModalOpen(false);
    setStatusModalOpen(true);
  }

  function openCargaModal(motorista, dateObj) {
    const key = `${motorista.id}|${dateObj.__dayKey ?? dayKey(dateObj)}`;
    const list = cargasIndex.get(key) || [];

    setModalMotorista({ id: motorista.id, nome: motorista.nome });
    setModalDate(dateObj);

    const di = dateToInput(dateObj);
    setRangeFrom(di);
    setRangeTo(di);

    if (list.length > 0) {
      const first = list[0];
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
      setFormCarga(emptyCarga);
    }

    setPickerOpen(false);
    setStatusModalOpen(false);
    setCargaModalOpen(true);
  }

  function onCargaChange(e) {
    const { name, value } = e.target;
    setFormCarga((p) => ({ ...p, [name]: value }));
  }

  function resolveDiasParaSalvar() {
    const d1 = inputToDate(rangeFrom);
    const d2 = inputToDate(rangeTo);

    if (!d1 || !d2) return modalDate ? [modalDate] : null;

    const range = clampRangeDates(d1, d2);
    if (!range) return modalDate ? [modalDate] : null;

    return enumerateDays(range.start, range.end);
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
      if (!snap.empty) for (const d of snap.docs) await deleteDoc(doc(db, "statusMotorista", d.id));
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
        for (let i = 1; i < snap.docs.length; i++) await deleteDoc(doc(db, "statusMotorista", snap.docs[i].id));
      }
      return;
    }

    await addDoc(colStatus, { ...payload, createdAt: serverTimestamp() });
  }

  async function salvarStatusMotorista() {
    if (!modalMotorista || !modalDate) return;

    const ds = resolveDiasParaSalvar();
    if (!ds || ds.length === 0) return alert("Selecione um dia válido para salvar.");
    if (ds.length > 62) return alert("Período muito grande. Use no máximo 62 dias por vez.");

    try {
      const m = { id: modalMotorista.id, nome: modalMotorista.nome };
      for (const dd of ds) await upsertStatusForDay(m, dd, statusCode, statusObs);
      alert(ds.length === 1 ? "Status do motorista salvo." : `Status salvo no período (${ds.length} dia(s)).`);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar status do motorista.");
    }
  }

  async function upsertCargaForDay(motorista, dayDate, form) {
    const dataRefTs = toMiddayTimestamp(dayDate);

    const qFind = query(
      colCargas,
      where("motoristaId", "==", motorista.id),
      where("dataRef", "==", dataRefTs)
    );
    const snap = await getDocs(qFind);

    const payload = {
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      dataRef: dataRefTs,
      cidadeOrigem: (form.cidadeOrigem || "").trim(),
      clienteColeta: (form.clienteColeta || "").trim(),
      cidadeDestino: (form.cidadeDestino || "").trim(),
      clienteEntrega: (form.clienteEntrega || "").trim(),
      status: (form.status || "").trim(),
      dataColeta: (form.dataColeta || "").trim(),
      dataEntrega: (form.dataEntrega || "").trim(),
      updatedAt: serverTimestamp(),
    };

    if (!payload.status) throw new Error("Sem status de carga.");

    if (!snap.empty) {
      const firstId = snap.docs[0].id;
      await updateDoc(doc(db, "cargas", firstId), payload);
      if (snap.docs.length > 1) {
        for (let i = 1; i < snap.docs.length; i++) await deleteDoc(doc(db, "cargas", snap.docs[i].id));
      }
      return;
    }

    await addDoc(colCargas, { ...payload, createdAt: serverTimestamp() });
  }

  async function salvarCarga() {
    if (!modalMotorista || !modalDate) return;
    if (!formCarga.status) return alert("Escolha o status da carga.");

    const ds = resolveDiasParaSalvar();
    if (!ds || ds.length === 0) return alert("Selecione um dia válido para salvar.");
    if (ds.length > 62) return alert("Período muito grande. Use no máximo 62 dias por vez.");

    try {
      const m = { id: modalMotorista.id, nome: modalMotorista.nome };
      for (const dd of ds) await upsertCargaForDay(m, dd, formCarga);
      alert(ds.length === 1 ? "Carga salva." : `Carga salva no período (${ds.length} dia(s)).`);
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
      if (snap.empty) return alert("Não existe carga neste dia para excluir.");
      if (!confirm("Excluir carga deste dia?")) return;

      for (const d of snap.docs) await deleteDoc(doc(db, "cargas", d.id));
      setFormCarga(emptyCarga);
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir a carga do dia.");
    }
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
    const dk = dateObj.__dayKey ?? dayKey(dateObj);
    setDayFilters((p) => ({ ...(p || {}), [dk]: mode }));
  }
  function clearDayFilters() {
    setDayFilters({});
  }

  function toggleVinculo(motoristaId) {
    setOpenVinculos((p) => ({ ...(p || {}), [motoristaId]: !(p?.[motoristaId] ?? false) }));
  }

  const modalDateLabel = modalDate ? formatBRDay(modalDate) : "";

  return {
    // data
    viewDate, setViewDate,
    motoristas, cargas, statusMotorista,
    veiculos, carretas,
    veiculoPorMotorista, carretaPorMotorista,

    // ui states
    filterDay, setFilterDay,
    activeFilter, setActiveFilter,
    pickerOpen, statusModalOpen, cargaModalOpen,
    modalMotorista, modalDate, modalDateLabel,
    rangeFrom, rangeTo, setRangeFrom, setRangeTo,
    formCarga, setFormCarga,
    statusCode, setStatusCode,
    statusObs, setStatusObs,
    searchNome, setSearchNome,
    dayFilters, compact, setCompact,
    openVinculos,

    // refs
    sheetWrapRef, dayHeaderRefs,

    // derived
    days, monthLabel, canNext,
    cargasIndex, statusIndex,
    todayKey,

    // helpers/actions
    isTodayColumn,
    prevMonth, nextMonth, goToday,
    toggleFilter,
    dayKPIs,
    matchSet,
    visibleMotoristas,
    setDayFilter, clearDayFilters,
    openPicker, openStatusModal, openCargaModal,
    closeAllModals,
    onCargaChange,
    salvarStatusMotorista,
    salvarCarga,
    excluirCargaDia,
    toggleVinculo,

    // exports (utils)
    scrollToDayKey,
  };
}
