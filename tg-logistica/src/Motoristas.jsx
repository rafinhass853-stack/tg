import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

/* =========================
   CONFIGURAÇÕES TG
========================= */
const TG = {
  blue: "#0b2f6b",
  blueDark: "#081f47",
  blueLight: "#e6ecf7",
  bg: "#f1f4f9",
  border: "#d7deea",
  text: "#0f172a",
  muted: "#64748b",
  white: "#ffffff",
};

const vinculoOptions = ["Frota", "Agregado", "PX", "Terceiro"];

/* =========================
   DADOS PADRÃO
========================= */
const defaultForm = {
  nome: "",
  cidadeResidencia: "",
  motoristaDe: "Carreta",
  vinculo: "Frota",
  temMopp: "Não",
};

const statusProgramacaoOptions = [
  "Sem programação",
  "Programado",
  "Em rota",
  "Aguardando carga",
  "Aguardando descarga",
  "Finalizado",
];

const statusFolgaOptions = ["Sem folga", "De folga", "Férias", "Afastado"];

/* =========================
   COMPONENTE
========================= */
export default function Motoristas() {
  const [form, setForm] = useState(defaultForm);
  const [motoristas, setMotoristas] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // ✅ filtro (navegação)
  // "TODOS" | "MOPP_SIM" | "MOPP_NAO" | "CARRETA" | "TRUCK" | "FROTA" | "AGREGADO" | "PX" | "TERCEIRO"
  const [filtro, setFiltro] = useState("TODOS");

  const isEditing = useMemo(() => editingId !== null, [editingId]);

  // 🔥 Coleção Firestore
  const colRef = useMemo(() => collection(db, "motoristas"), []);

  // 🔥 Buscar lista em tempo real
  useEffect(() => {
    const q = query(colRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMotoristas(list);
      },
      (err) => {
        console.error(err);
        alert("Erro ao carregar motoristas no Firestore.");
      }
    );
    return () => unsub();
  }, [colRef]);

  /* =========================
     KPI (contagens)
  ========================= */
  const kpis = useMemo(() => {
    const total = motoristas.length;

    const vinculo = {
      Frota: 0,
      Agregado: 0,
      Terceiro: 0,
      PX: 0,
      Sem: 0,
    };

    const tipo = { Carreta: 0, Truck: 0, Outro: 0 };
    const mopp = { Sim: 0, Nao: 0 };

    for (const m of motoristas) {
      const v = (m.vinculo || "").trim();
      if (vinculo[v] !== undefined) vinculo[v] += 1;
      else vinculo.Sem += 1;

      const t = (m.motoristaDe || "").trim();
      if (t === "Carreta") tipo.Carreta += 1;
      else if (t === "Truck") tipo.Truck += 1;
      else tipo.Outro += 1;

      const mm = (m.temMopp || "Não").toLowerCase() === "sim" ? "Sim" : "Nao";
      mopp[mm] += 1;
    }

    return { total, vinculo, tipo, mopp };
  }, [motoristas]);

  /* =========================
     ✅ Lista filtrada (menu)
  ========================= */
  const motoristasFiltrados = useMemo(() => {
    const base = [...motoristas];

    const temMoppSim = (m) => (m.temMopp || "Não").toLowerCase() === "sim";
    const temMoppNao = (m) => !temMoppSim(m);

    switch (filtro) {
      case "MOPP_SIM":
        return base.filter(temMoppSim);
      case "MOPP_NAO":
        return base.filter(temMoppNao);
      case "CARRETA":
        return base.filter((m) => (m.motoristaDe || "") === "Carreta");
      case "TRUCK":
        return base.filter((m) => (m.motoristaDe || "") === "Truck");
      case "FROTA":
        return base.filter((m) => (m.vinculo || "") === "Frota");
      case "AGREGADO":
        return base.filter((m) => (m.vinculo || "") === "Agregado");
      case "PX":
        return base.filter((m) => (m.vinculo || "") === "PX");
      case "TERCEIRO":
        return base.filter((m) => (m.vinculo || "") === "Terceiro");
      default:
        return base;
    }
  }, [motoristas, filtro]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.nome || !form.cidadeResidencia) {
      alert("Preencha Nome e Cidade Residência.");
      return;
    }

    try {
      if (isEditing) {
        const ref = doc(db, "motoristas", editingId);
        await updateDoc(ref, {
          ...form,
          updatedAt: serverTimestamp(),
        });
        resetForm();
        return;
      }

      await addDoc(colRef, {
        ...form,
        statusProgramacao: "Sem programação",
        statusFolga: "Sem folga",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar no Firestore.");
    }
  }

  function editar(m) {
    setEditingId(m.id);
    setForm({
      nome: m.nome ?? "",
      cidadeResidencia: m.cidadeResidencia ?? "",
      motoristaDe: m.motoristaDe ?? "Carreta",
      vinculo: m.vinculo ?? "Frota",
      temMopp: m.temMopp ?? "Não",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(id) {
    if (!confirm("Excluir motorista?")) return;

    try {
      await deleteDoc(doc(db, "motoristas", id));
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir no Firestore.");
    }
  }

  async function updateStatus(id, field, value) {
    try {
      await updateDoc(doc(db, "motoristas", id), {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar status no Firestore.");
    }
  }

  function clearFiltro() {
    setFiltro("TODOS");
  }

  return (
    <div style={{ background: TG.bg, minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={header}>
        <div style={headerLeft}>
          <img src="/src/assets/logo-tg.png" alt="TG Logística" style={{ height: 48 }} />
          <div>
            <h1 style={{ margin: 0 }}>TG Logística</h1>
            <span style={{ fontSize: 13, opacity: 0.9 }}>
              Gestão de Frota • Motoristas
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* KPIs */}
        <div style={kpiWrap}>
          <KPI title="Total motoristas" value={kpis.total} onClick={clearFiltro} active={filtro === "TODOS"} />

          <KPI title="Frota" value={kpis.vinculo.Frota} onClick={() => setFiltro("FROTA")} active={filtro === "FROTA"} />
          <KPI title="Agregado" value={kpis.vinculo.Agregado} onClick={() => setFiltro("AGREGADO")} active={filtro === "AGREGADO"} />
          <KPI title="Terceiro" value={kpis.vinculo.Terceiro} onClick={() => setFiltro("TERCEIRO")} active={filtro === "TERCEIRO"} />
          <KPI title="PX" value={kpis.vinculo.PX} onClick={() => setFiltro("PX")} active={filtro === "PX"} />

          <KPI title="Carreta" value={kpis.tipo.Carreta} onClick={() => setFiltro("CARRETA")} active={filtro === "CARRETA"} />
          <KPI title="Truck" value={kpis.tipo.Truck} onClick={() => setFiltro("TRUCK")} active={filtro === "TRUCK"} />

          <KPI title="Com MOPP" value={kpis.mopp.Sim} onClick={() => setFiltro("MOPP_SIM")} active={filtro === "MOPP_SIM"} />
          <KPI title="Sem MOPP" value={kpis.mopp.Nao} onClick={() => setFiltro("MOPP_NAO")} active={filtro === "MOPP_NAO"} />
        </div>

        {/* BARRA DO FILTRO */}
        <div style={filterBar}>
          <div style={{ fontWeight: 900, color: TG.blueDark }}>
            Filtro:{" "}
            <span style={{ color: TG.muted }}>
              {filtro === "TODOS" ? "Todos" : filtro.replaceAll("_", " ")}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={clearFiltro} style={btnGhost}>
              Ver todos
            </button>
            <div style={{ fontSize: 12, color: TG.muted, fontWeight: 800 }}>
              Mostrando: <b>{motoristasFiltrados.length}</b>
            </div>
          </div>
        </div>

        {/* CADASTRO */}
        <div style={card}>
          <h2 style={sectionTitle}>Cadastro de Motorista</h2>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 14,
            }}
          >
            <Input span={4} label="Nome">
              <input
                name="nome"
                value={form.nome}
                onChange={onChange}
                style={input}
                placeholder="Ex.: João da Silva"
              />
            </Input>

            <Input span={4} label="Cidade Residência">
              <input
                name="cidadeResidencia"
                value={form.cidadeResidencia}
                onChange={onChange}
                style={input}
                placeholder="Ex.: São Carlos - SP"
              />
            </Input>

            <Input span={2} label="Motorista de">
              <select
                name="motoristaDe"
                value={form.motoristaDe}
                onChange={onChange}
                style={input}
              >
                <option>Carreta</option>
                <option>Truck</option>
              </select>
            </Input>

            <Input span={2} label="Vínculo">
              <select
                name="vinculo"
                value={form.vinculo}
                onChange={onChange}
                style={input}
              >
                {vinculoOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Input>

            <Input span={2} label="Tem MOPP">
              <select name="temMopp" value={form.temMopp} onChange={onChange} style={input}>
                <option>Não</option>
                <option>Sim</option>
              </select>
            </Input>

            <div style={{ gridColumn: "span 12", textAlign: "right" }}>
              <button type="button" onClick={resetForm} style={btnSecondary}>
                Limpar
              </button>{" "}
              <button style={btnPrimary}>
                {isEditing ? "Salvar alterações" : "Cadastrar motorista"}
              </button>
            </div>
          </form>
        </div>

        {/* LISTA */}
        <div style={card}>
          <h2 style={sectionTitle}>
            Lista de Motoristas ({motoristasFiltrados.length})
          </h2>

          <table style={table}>
            <thead>
              <tr>
                {[
                  "Nome",
                  "Cidade Residência",
                  "Motorista de",
                  "Vínculo",
                  "Tem MOPP",
                  "Status Programação",
                  "Status Folga",
                  "Ações",
                ].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {motoristasFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={empty}>
                    Nenhum motorista encontrado com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                motoristasFiltrados.map((m) => (
                  <tr key={m.id}>
                    <td style={td}>{m.nome}</td>
                    <td style={td}>{m.cidadeResidencia}</td>
                    <td style={td}>{m.motoristaDe}</td>
                    <td style={td}>{m.vinculo || "-"}</td>
                    <td style={td}>{m.temMopp}</td>

                    <td style={td}>
                      <select
                        value={m.statusProgramacao || "Sem programação"}
                        onChange={(e) =>
                          updateStatus(m.id, "statusProgramacao", e.target.value)
                        }
                        style={selectMini}
                      >
                        {statusProgramacaoOptions.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </td>

                    <td style={td}>
                      <select
                        value={m.statusFolga || "Sem folga"}
                        onChange={(e) => updateStatus(m.id, "statusFolga", e.target.value)}
                        style={selectMini}
                      >
                        {statusFolgaOptions.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </td>

                    <td style={td}>
                      <button onClick={() => editar(m)} style={btnMini}>
                        Editar
                      </button>{" "}
                      <button onClick={() => excluir(m.id)} style={btnDanger}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 12, color: TG.muted }}>
            * Clique nos KPIs para filtrar a lista (MOPP, Truck, Carreta, Frota, etc).
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   COMPONENTES AUX
========================= */
const Input = ({ label, span, children }) => (
  <div style={{ gridColumn: `span ${span}` }}>
    <label style={{ fontSize: 12, color: TG.blueDark, fontWeight: 700 }}>
      {label}
    </label>
    {children}
  </div>
);

const KPI = ({ title, value, onClick, active }) => (
  <button
    onClick={onClick}
    style={{
      ...kpiBox,
      cursor: "pointer",
      borderColor: active ? TG.blue : TG.border,
      boxShadow: active ? "0 0 0 2px rgba(11,47,107,.12)" : "none",
    }}
    title="Clique para filtrar"
  >
    <div style={{ fontSize: 12, color: TG.muted, fontWeight: 900 }}>{title}</div>
    <div style={{ fontSize: 22, color: TG.blueDark, fontWeight: 900 }}>{value}</div>
  </button>
);

/* =========================
   ESTILOS
========================= */
const header = {
  background: TG.blue,
  color: "#fff",
  padding: "16px 24px",
};

const headerLeft = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const kpiWrap = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const filterBar = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 14,
  padding: 12,
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const btnGhost = {
  border: `1px solid ${TG.border}`,
  background: "#fff",
  padding: "8px 10px",
  borderRadius: 10,
  fontWeight: 900,
  cursor: "pointer",
  color: TG.blueDark,
};

const kpiBox = {
  background: TG.white,
  border: `1px solid ${TG.border}`,
  borderRadius: 14,
  padding: 12,
};

const card = {
  background: TG.white,
  borderRadius: 16,
  padding: 20,
  marginBottom: 24,
  border: `1px solid ${TG.border}`,
};

const sectionTitle = {
  marginBottom: 16,
  color: TG.blue,
};

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${TG.border}`,
  outline: "none",
};

const btnPrimary = {
  background: TG.blue,
  color: "#fff",
  padding: "12px 20px",
  border: "none",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary = {
  background: "#eef2ff",
  color: TG.blueDark,
  padding: "12px 14px",
  border: `1px solid ${TG.border}`,
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const btnMini = {
  background: TG.blueLight,
  border: "none",
  padding: "6px 10px",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};

const btnDanger = {
  background: "#fee2e2",
  border: "none",
  padding: "6px 10px",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  color: "#991b1b",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  background: TG.blue,
  color: "#fff",
  padding: 10,
  textAlign: "left",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const td = {
  padding: 10,
  borderBottom: `1px solid ${TG.border}`,
  verticalAlign: "middle",
};

const empty = {
  padding: 20,
  textAlign: "center",
  color: TG.muted,
};

const selectMini = {
  padding: "6px 8px",
  borderRadius: 8,
  border: `1px solid ${TG.border}`,
};
