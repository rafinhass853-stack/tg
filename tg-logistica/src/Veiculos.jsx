// src/Veiculos.jsx
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

// ✅ IMPORT DAS IMAGENS (assets)
import cavaloToco from "./assets/cavalo toco.jpg";
import cavaloTrucado from "./assets/cavalo trucado.jpg";
import truckImg from "./assets/truck.jpg";

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

const defaultForm = {
  placa: "",
  tipo: "Trucado",
  statusManutencao: "Ok",
  motoristaId: "", // ✅ agora é por coleção motoristas
  observacao: "",
};

const tipoOptions = ["Trucado", "Toco", "Truck"];
const statusManutencaoOptions = ["Ok", "Programada", "Em manutenção"];

/* =========================
   HELPERS
========================= */
function normalizePlaca(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

function isPlacaValida(placa) {
  return /^[A-Z0-9]{7}$/.test(placa);
}

/* =========================
   VISUAL (IMAGEM POR TIPO)
========================= */
function VeiculoVisual({ tipo }) {
  const t = (tipo || "").toLowerCase();

  let src = null;
  let alt = "Veículo";

  if (t === "toco") {
    src = cavaloToco;
    alt = "Cavalo Toco";
  } else if (t === "trucado") {
    src = cavaloTrucado;
    alt = "Cavalo Trucado";
  } else if (t === "truck") {
    src = truckImg;
    alt = "Truck";
  }

  if (!src) {
    return (
      <div
        style={{
          width: 340,
          height: 130,
          borderRadius: 12,
          border: `1px solid ${TG.border}`,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          color: TG.muted,
          fontSize: 12,
          padding: 10,
        }}
        title="Sem imagem cadastrada para este tipo"
      >
        SEM IMAGEM
      </div>
    );
  }

  return (
    <div
      style={{
        width: 340,
        height: 130,
        borderRadius: 12,
        border: `1px solid ${TG.border}`,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 10,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

/* =========================
   COMPONENTE
========================= */
export default function Veiculos() {
  const [form, setForm] = useState(defaultForm);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]); // ✅ lista do firebase
  const [editingId, setEditingId] = useState(null);

  const isEditing = useMemo(() => editingId !== null, [editingId]);
  const colRef = useMemo(() => collection(db, "veiculos"), []);
  const colMotoristas = useMemo(() => collection(db, "motoristas"), []);

  /* ✅ Motoristas (A-Z) realtime */
  useEffect(() => {
    const q = query(colMotoristas, orderBy("nome", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => setMotoristas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error(err);
        alert("Erro ao carregar motoristas.");
      }
    );
    return () => unsub();
  }, [colMotoristas]);

  /* ✅ Veículos realtime */
  useEffect(() => {
    const q = query(colRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setVeiculos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error(err);
        alert("Erro ao carregar veículos no Firestore.");
      }
    );
    return () => unsub();
  }, [colRef]);

  function onChange(e) {
    const { name, value } = e.target;

    if (name === "placa") {
      setForm((p) => ({ ...p, placa: normalizePlaca(value) }));
      return;
    }

    setForm((p) => ({ ...p, [name]: value }));
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.placa || !isPlacaValida(form.placa)) {
      alert("Informe uma placa válida (7 caracteres). Ex: ABC1D23 ou ABC1234");
      return;
    }

    // ✅ pega nome do motorista no momento do save (pra exibir fácil na lista)
    const motoristaSel = motoristas.find((m) => m.id === form.motoristaId) || null;

    const payload = {
      placa: form.placa,
      tipo: form.tipo,
      statusManutencao: form.statusManutencao,
      motoristaId: form.motoristaId || "",
      motoristaNome: motoristaSel?.nome || "",
      observacao: form.observacao || "",
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEditing) {
        await updateDoc(doc(db, "veiculos", editingId), payload);
        resetForm();
        return;
      }

      await addDoc(colRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar veículo no Firestore.");
    }
  }

  function editar(v) {
    setEditingId(v.id);
    setForm({
      placa: v.placa ?? "",
      tipo: v.tipo ?? "Trucado",
      statusManutencao: v.statusManutencao ?? "Ok",
      motoristaId: v.motoristaId ?? "",
      observacao: v.observacao ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(id) {
    if (!confirm("Excluir veículo?")) return;
    try {
      await deleteDoc(doc(db, "veiculos", id));
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir veículo no Firestore.");
    }
  }

  const badge = (status) => {
    const base = {
      padding: "6px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      display: "inline-block",
      border: `1px solid ${TG.border}`,
      whiteSpace: "nowrap",
    };

    if (status === "Em manutenção") return { ...base, background: "#fee2e2", color: "#991b1b" };
    if (status === "Programada") return { ...base, background: "#fef3c7", color: "#92400e" };
    return { ...base, background: "#d1fae5", color: "#065f46" };
  };

  return (
    <div style={{ background: TG.bg, minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={header}>
        <div style={headerLeft}>
          <div>
            <h1 style={{ margin: 0, color: TG.white, fontSize: 24 }}>TG Logística</h1>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
              Gestão de Frota • Veículos
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* CADASTRO */}
        <div style={card}>
          <h2 style={sectionTitle}>Cadastro de Veículo</h2>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 16,
              alignItems: "end",
            }}
          >
            <Input span={2} label="Placa">
              <input
                name="placa"
                value={form.placa}
                onChange={onChange}
                style={input}
                placeholder="ABC1D23"
                maxLength={7}
              />
              <div style={{ fontSize: 12, color: TG.muted, marginTop: 8, fontWeight: 500 }}>
                7 caracteres (Mercosul ou antigo)
              </div>
            </Input>

            <Input span={3} label="Tipo">
              <select name="tipo" value={form.tipo} onChange={onChange} style={input}>
                {tipoOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Input>

            <Input span={3} label="Status Manutenção">
              <select
                name="statusManutencao"
                value={form.statusManutencao}
                onChange={onChange}
                style={input}
              >
                {statusManutencaoOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Input>

            {/* ✅ AGORA É MOTORISTA (DA COLEÇÃO motoristas) */}
            <Input span={4} label="Motorista">
              <select
                name="motoristaId"
                value={form.motoristaId}
                onChange={onChange}
                style={input}
              >
                <option value="">(sem motorista)</option>
                {motoristas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} {m.cidadeResidencia ? `— ${m.cidadeResidencia}` : ""}
                  </option>
                ))}
              </select>
            </Input>

            <Input span={12} label="Observação">
              <input
                name="observacao"
                value={form.observacao}
                onChange={onChange}
                style={input}
                placeholder="Ex.: Baú • rastreador Sascar • restrição de altura…"
              />
            </Input>

            <div style={{ gridColumn: "span 12", textAlign: "right", marginTop: 8 }}>
              <button type="button" onClick={resetForm} style={btnSecondary}>
                Limpar
              </button>{" "}
              <button style={btnPrimary}>
                {isEditing ? "Salvar alterações" : "Cadastrar veículo"}
              </button>
            </div>
          </form>
        </div>

        {/* LISTA */}
        <div style={card}>
          <h2 style={sectionTitle}>Lista de Veículos ({veiculos.length})</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ ...table, minWidth: 1250 }}>
              <thead>
                <tr>
                  {["Placa", "Tipo", "Visual", "Status Manutenção", "Motorista", "Observação", "Ações"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          ...th,
                          ...(h === "Visual" ? { minWidth: 360 } : null),
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {veiculos.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={empty}>
                      Nenhum veículo cadastrado
                    </td>
                  </tr>
                ) : (
                  veiculos.map((v) => (
                    <tr key={v.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 800, color: TG.black, fontSize: 15 }}>{v.placa}</div>
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            background: "#f3f4f6",
                            color: TG.text,
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {v.tipo}
                        </span>
                      </td>

                      <td style={{ ...td, minWidth: 360 }}>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <VeiculoVisual tipo={v.tipo} />
                        </div>
                      </td>

                      <td style={td}>
                        <span style={badge(v.statusManutencao)}>{v.statusManutencao}</span>
                      </td>

                      {/* ✅ MOTORISTA */}
                      <td style={td}>
                        {v.motoristaNome ? (
                          <div style={{ fontWeight: 700, color: TG.text }}>
                            {String(v.motoristaNome).toUpperCase()}
                          </div>
                        ) : (
                          <span style={{ color: TG.muted, fontStyle: "italic" }}>-</span>
                        )}
                      </td>

                      <td style={td}>
                        {v.observacao ? (
                          <div style={{ fontSize: 13, color: TG.text }}>{v.observacao}</div>
                        ) : (
                          <span style={{ color: TG.muted, fontStyle: "italic" }}>-</span>
                        )}
                      </td>

                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => editar(v)} style={btnMini}>
                            Editar
                          </button>
                          <button onClick={() => excluir(v.id)} style={btnDanger}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
    <label style={{ fontSize: 13, color: TG.black, fontWeight: 600, marginBottom: 8, display: "block" }}>
      {label}
    </label>
    {children}
  </div>
);

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

const card = {
  background: TG.white,
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
  border: `1px solid ${TG.border}`,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const sectionTitle = {
  marginBottom: 20,
  color: TG.black,
  fontSize: 18,
  fontWeight: 700,
  paddingBottom: 12,
  borderBottom: `2px solid ${TG.blueLight}`,
};

const input = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 8,
  border: `1px solid ${TG.border}`,
  outline: "none",
  fontSize: 14,
  background: TG.white,
  color: TG.text,
  transition: "border 0.2s ease",
};

const btnPrimary = {
  background: TG.blue,
  color: TG.white,
  padding: "12px 24px",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  transition: "all 0.2s ease",
  marginLeft: 8,
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

const btnMini = {
  background: TG.blueLight,
  border: `1px solid ${TG.border}`,
  padding: "6px 12px",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  color: TG.blueDark,
  transition: "all 0.2s ease",
};

const btnDanger = {
  background: "#fee2e2",
  border: `1px solid ${TG.border}`,
  padding: "6px 12px",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  color: "#991b1b",
  transition: "all 0.2s ease",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const th = {
  background: TG.black,
  color: TG.white,
  padding: 12,
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderRight: `1px solid ${TG.border}`,
};

const td = {
  padding: 12,
  borderBottom: `1px solid ${TG.border}`,
  verticalAlign: "middle",
  color: TG.text,
};

const empty = {
  padding: 32,
  textAlign: "center",
  color: TG.muted,
  fontSize: 14,
};
