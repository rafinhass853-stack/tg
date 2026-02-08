// src/Folgas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, Timestamp, where, getDocs } from "firebase/firestore";

/* =========================
   PALETA DE CORES: Preto, Azul e Branco
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

const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_LONG = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(d, delta) {
  return startOfMonth(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function monthKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthLabel(d) {
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[d.getMonth()]} de ${d.getFullYear()}`;
}
function safeToDate(ts) {
  try {
    return ts?.toDate ? ts.toDate() : null;
  } catch {
    return null;
  }
}

/* regras do negócio */
const WORK_CODES = new Set(["P", "P/DS"]);
const FOLGA_CODES = new Set(["DS"]);
const FERIAS_CODES = new Set(["FE"]);

export default function Folgas() {
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()));
  const [motoristas, setMotoristas] = useState([]);
  const [statusMes, setStatusMes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Drawer (relatórios)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [topN, setTopN] = useState(10);
  const [contarFeriasComoFolga, setContarFeriasComoFolga] = useState(true);

  const diasDoMes = useMemo(() => {
    const end = endOfMonth(mesAtual);
    const days = [];
    for (let i = 1; i <= end.getDate(); i++) {
      days.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), i, 12, 0, 0, 0));
    }
    return days;
  }, [mesAtual]);

  const startTs = useMemo(() => Timestamp.fromDate(startOfMonth(mesAtual)), [mesAtual]);
  const endTs = useMemo(() => Timestamp.fromDate(endOfMonth(mesAtual)), [mesAtual]);

  /* 1) Motoristas (A-Z) realtime */
  useEffect(() => {
    const q = query(collection(db, "motoristas"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
        setMotoristas(list);
      },
      (err) => {
        console.error(err);
        alert("Erro ao carregar motoristas.");
      }
    );
    return () => unsub();
  }, []);

  /* 2) Status do mês */
  useEffect(() => {
    let cancelled = false;

    async function loadStatusMes() {
      try {
        setLoading(true);

        const col = collection(db, "statusMotorista");
        const q = query(col, where("dataRef", ">=", startTs), where("dataRef", "<=", endTs));
        const snap = await getDocs(q);

        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!cancelled) setStatusMes(all);
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar status do mês (Folgas).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatusMes();
    return () => {
      cancelled = true;
    };
  }, [startTs, endTs]);

  /* MAPA motoristaId|YYYY-MM-DD */
  const statusMap = useMemo(() => {
    const map = new Map();
    for (const s of statusMes) {
      const dt = safeToDate(s?.dataRef);
      if (!dt) continue;
      const k = `${s.motoristaId}|${dateKey(dt)}`;
      map.set(k, s);
    }
    return map;
  }, [statusMes]);

  /* KPI por motorista (mês) */
  const resumoPorMotorista = useMemo(() => {
    const byId = new Map();

    for (const m of motoristas) {
      byId.set(m.id, {
        motoristaId: m.id,
        nome: m.nome || "",
        cidade: m.cidadeResidencia || "",
        worked: 0,
        ds: 0,
        fe: 0,
        outros: 0,
      });
    }

    for (const s of statusMes) {
      const mid = s.motoristaId;
      if (!byId.has(mid)) continue;
      const r = byId.get(mid);

      const code = (s.codigo || "").trim();
      if (WORK_CODES.has(code)) r.worked += 1;
      else if (FOLGA_CODES.has(code)) r.ds += 1;
      else if (FERIAS_CODES.has(code)) r.fe += 1;
      else r.outros += 1;
    }

    const list = Array.from(byId.values()).map((r) => {
      const direitoFolga = Math.floor(r.worked / 6);
      const folgasTiradas = r.ds + (contarFeriasComoFolga ? r.fe : 0);
      const saldo = direitoFolga - folgasTiradas;
      return { ...r, direitoFolga, folgasTiradas, saldo };
    });

    list.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    return list;
  }, [motoristas, statusMes, contarFeriasComoFolga]);

  const rankingMaisTrabalhou = useMemo(() => {
    const list = [...resumoPorMotorista];
    list.sort((a, b) => b.worked - a.worked || (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    return list.slice(0, Math.max(1, topN));
  }, [resumoPorMotorista, topN]);

  return (
    <div style={{ background: TG.bg, minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={header}>
        <div style={headerLeft}>
          <div>
            <h1 style={{ margin: 0, color: TG.white, fontSize: 24 }}>TG Logística</h1>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
              Folgas • Controle de escala
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* TOPO DA PÁGINA */}
        <div style={pageTitleRow}>
          <div>
            <div style={pageTitle}>Folgas</div>
            <div style={pageSubTitle}>Visualização da escala • status vem da tela CARGAS</div>
          </div>

          <button style={btnRelatorios} onClick={() => setDrawerOpen(true)}>
            📊 Relatórios
          </button>
        </div>

        {/* NAV */}
        <div style={navCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button style={navBtn} onClick={() => setMesAtual((p) => addMonths(p, -1))}>◀</button>

            <div style={{ fontSize: 18, fontWeight: 700, color: TG.black }}>
              {monthLabel(mesAtual)}
            </div>

            <button style={navBtn} onClick={() => setMesAtual((p) => addMonths(p, 1))}>▶</button>

            <div style={{ marginLeft: "auto", fontSize: 12, color: TG.muted, fontWeight: 600 }}>
              {loading ? "Carregando status..." : `Mês ${monthKey(mesAtual)}`}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: TG.muted, fontWeight: 600 }}>
            * Esta tela é somente visualização. O lançamento vem da tela <b style={{ color: TG.blue }}>CARGAS</b>.
          </div>
        </div>

        {/* PLANILHA */}
        <div style={sheetWrap}>
          <div style={sheetScroll}>
            <table style={sheetTable}>
              <thead>
                <tr>
                  <th style={{ ...thSticky, minWidth: 300 }}>Motorista (A-Z)</th>

                  {diasDoMes.map((d) => {
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;

                    return (
                      <th
                        key={dateKey(d)}
                        style={{
                          ...thDay,
                          background: isWeekend ? "#f3f4f6" : TG.black,
                          color: isWeekend ? TG.black : TG.white,
                        }}
                        title={WEEKDAY_LONG[dow]}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{pad2(d.getDate())}</div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{WEEKDAY_SHORT[dow]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {motoristas.length === 0 ? (
                  <tr>
                    <td colSpan={1 + diasDoMes.length} style={empty}>
                      Nenhum motorista cadastrado.
                    </td>
                  </tr>
                ) : (
                  motoristas.map((m) => (
                    <tr key={m.id}>
                      <td style={tdSticky}>
                        <div style={{ fontWeight: 700, color: TG.text }}>
                          {(m.nome || "").toUpperCase()}
                        </div>
                        <div style={{ fontSize: 12, color: TG.muted, fontWeight: 600 }}>
                          {m.cidadeResidencia || "-"}
                        </div>
                      </td>

                      {diasDoMes.map((d) => {
                        const k = `${m.id}|${dateKey(d)}`;
                        const s = statusMap.get(k);
                        const dow = d.getDay();
                        const isWeekend = dow === 0 || dow === 6;

                        return (
                          <td
                            key={k}
                            style={{
                              ...tdDay,
                              background: isWeekend ? "#f9fafb" : TG.white,
                              cursor: "default",
                              borderLeft: `1px solid ${TG.border}`,
                            }}
                            title={s?.descricao || ""}
                          >
                            {s?.codigo ? (
                              <div
                                style={{
                                  ...cellPill,
                                  background: s.corBg || "#e5e7eb",
                                  color: s.corFg || "#111827",
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.codigo}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.95 }}>
                                  {s.obs ? s.obs : ""}
                                </div>
                              </div>
                            ) : (
                              <div style={cellEmptyDot}>•</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DRAWER RELATÓRIOS */}
      {drawerOpen && (
        <div style={drawerOverlay} onMouseDown={() => setDrawerOpen(false)}>
          <div style={drawer} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: TG.black, fontSize: 18 }}>Relatórios do mês</div>
                <div style={{ fontSize: 12, color: TG.muted, fontWeight: 600 }}>
                  {monthLabel(mesAtual)} • Regra: ⌊(P + P/DS) / 6⌋ − (DS {contarFeriasComoFolga ? "+ FE" : ""})
                </div>
              </div>
              <button style={navBtn} onClick={() => setDrawerOpen(false)}>✕</button>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={tinyLabel}>
                Top
                <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} style={tinySelect}>
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <label style={{ ...tinyLabel, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={contarFeriasComoFolga}
                  onChange={(e) => setContarFeriasComoFolga(e.target.checked)}
                  style={{ accentColor: TG.blue }}
                />
                Contar FE como folga
              </label>
            </div>

            <div style={{ marginTop: 16, ...card }}>
              <div style={cardTitle}>Motoristas que mais trabalharam</div>
              {rankingMaisTrabalhou.length === 0 ? (
                <div style={empty}>Sem dados.</div>
              ) : (
                <table style={miniTable}>
                  <thead>
                    <tr>
                      <th style={miniTh}>#</th>
                      <th style={miniTh}>Motorista</th>
                      <th style={miniTh}>Trabalhados</th>
                      <th style={miniTh}>Direito</th>
                      <th style={miniTh}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingMaisTrabalhou.map((r, idx) => (
                      <tr key={r.motoristaId}>
                        <td style={miniTd}>
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: idx === 0 ? "#f59e0b" : idx === 1 ? "#d1d5db" : idx === 2 ? "#fcd34d" : "#f3f4f6",
                            color: idx < 3 ? "#000" : TG.muted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 12,
                          }}>
                            {idx + 1}
                          </div>
                        </td>
                        <td style={miniTd}>
                          <div style={{ fontWeight: 700, color: TG.black }}>{(r.nome || "").toUpperCase()}</div>
                          <div style={{ fontSize: 12, color: TG.muted, fontWeight: 600 }}>{r.cidade || "-"}</div>
                        </td>
                        <td style={miniTd}><b style={{ fontSize: 16, color: TG.black }}>{r.worked}</b></td>
                        <td style={miniTd}>
                          <span style={{
                            background: TG.blueLight,
                            color: TG.blueDark,
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            {r.direitoFolga}
                          </span>
                        </td>
                        <td style={miniTd}><span style={saldoPill(r.saldo)}>{r.saldo}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: 16, ...card }}>
              <div style={cardTitle}>Resumo por motorista</div>
              <div style={{ overflowX: "auto" }}>
                <table style={miniTable}>
                  <thead>
                    <tr>
                      <th style={miniTh}>Motorista</th>
                      <th style={miniTh}>P + P/DS</th>
                      <th style={miniTh}>DS</th>
                      <th style={miniTh}>FE</th>
                      <th style={miniTh}>Direito</th>
                      <th style={miniTh}>Tiradas</th>
                      <th style={miniTh}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoPorMotorista.map((r) => (
                      <tr key={r.motoristaId}>
                        <td style={miniTd}>
                          <div style={{ fontWeight: 700, color: TG.black }}>{(r.nome || "").toUpperCase()}</div>
                          <div style={{ fontSize: 12, color: TG.muted, fontWeight: 600 }}>{r.cidade || "-"}</div>
                        </td>
                        <td style={miniTd}><b style={{ fontSize: 14 }}>{r.worked}</b></td>
                        <td style={miniTd}>{r.ds}</td>
                        <td style={miniTd}>{r.fe}</td>
                        <td style={miniTd}>{r.direitoFolga}</td>
                        <td style={miniTd}>{r.folgasTiradas}</td>
                        <td style={miniTd}><span style={saldoPill(r.saldo)}>{r.saldo}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: TG.muted, fontWeight: 600 }}>
                * Se quiser, eu ajusto a regra do saldo (ex.: FE não entra, ou DS obrigatório em final de semana).
              </div>
            </div>
          </div>
        </div>
      )}
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

const pageTitleRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const pageTitle = {
  fontSize: 22,
  fontWeight: 800,
  color: TG.black,
  marginBottom: 4,
};

const pageSubTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: TG.muted,
};

const navCard = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const navBtn = {
  width: 44,
  height: 36,
  borderRadius: 8,
  border: `1px solid ${TG.border}`,
  background: TG.white,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
};

const btnRelatorios = {
  border: "none",
  background: TG.blue,
  color: TG.white,
  padding: "12px 20px",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const sheetWrap = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const sheetScroll = {
  overflowX: "auto",
  overflowY: "auto",
  maxHeight: "70vh",
  borderRadius: 8,
};

const sheetTable = {
  width: "max-content",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 13,
};

const thSticky = {
  position: "sticky",
  left: 0,
  top: 0,
  zIndex: 3,
  background: TG.black,
  color: TG.white,
  padding: 12,
  textAlign: "left",
  borderRight: `1px solid ${TG.border}`,
  borderBottom: `1px solid ${TG.border}`,
  fontSize: 13,
  whiteSpace: "nowrap",
  fontWeight: 700,
};

const thDay = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  padding: 10,
  textAlign: "center",
  borderBottom: `1px solid ${TG.border}`,
  borderRight: `1px solid ${TG.border}`,
  minWidth: 80,
  whiteSpace: "nowrap",
};

const tdSticky = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  background: TG.white,
  padding: 12,
  borderRight: `1px solid ${TG.border}`,
  borderBottom: `1px solid ${TG.border}`,
  minWidth: 300,
  fontWeight: 600,
};

const tdDay = {
  padding: 8,
  borderRight: `1px solid ${TG.border}`,
  borderBottom: `1px solid ${TG.border}`,
  textAlign: "center",
  minWidth: 80,
};

const cellPill = {
  borderRadius: 8,
  padding: "8px 6px",
  minHeight: 36,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 4,
  border: `1px solid ${TG.border}`,
};

const cellEmptyDot = {
  color: "#d1d5db",
  fontWeight: 800,
  fontSize: 18,
  lineHeight: "18px",
};

const empty = {
  padding: 24,
  textAlign: "center",
  color: TG.muted,
  fontWeight: 600,
  fontSize: 14,
};

const drawerOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  zIndex: 999,
  display: "flex",
  justifyContent: "flex-end",
  backdropFilter: "blur(2px)",
};

const drawer = {
  width: "min(800px, 100%)",
  height: "100%",
  background: TG.bg,
  borderLeft: `1px solid ${TG.border}`,
  padding: 20,
  overflow: "auto",
  boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
};

const card = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const cardTitle = {
  fontWeight: 700,
  color: TG.black,
  fontSize: 16,
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: `2px solid ${TG.blueLight}`,
};

const miniTable = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const miniTh = {
  textAlign: "left",
  fontSize: 12,
  padding: "10px 12px",
  background: "#f9fafb",
  borderBottom: `1px solid ${TG.border}`,
  color: TG.black,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const miniTd = {
  fontSize: 13,
  padding: "10px 12px",
  borderBottom: `1px solid ${TG.border}`,
  verticalAlign: "middle",
  color: TG.text,
};

const tinyLabel = {
  fontSize: 13,
  color: TG.black,
  fontWeight: 600,
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const tinySelect = {
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${TG.border}`,
  fontWeight: 600,
  fontSize: 13,
  background: TG.white,
  color: TG.text,
  minWidth: 80,
};

function saldoPill(saldo) {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${TG.border}`,
    fontWeight: 800,
    background: saldo < 0 ? "#fee2e2" : saldo === 0 ? "#fef3c7" : "#d1fae5",
    color: saldo < 0 ? "#991b1b" : saldo === 0 ? "#92400e" : "#065f46",
    display: "inline-block",
    minWidth: 40,
    textAlign: "center",
    fontSize: 13,
  };
}