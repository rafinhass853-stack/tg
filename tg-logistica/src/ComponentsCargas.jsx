// src/ComponentsCargas.jsx
import React from "react";
import { TG, styles } from "./StylesCargas";

/* =========================
   Componentes pequenos
========================= */
export const Input = ({ label, span, children }) => (
  <div style={{ gridColumn: `span ${span}` }}>
    <label
      style={{
        fontSize: 12,
        color: TG.black,
        fontWeight: 600,
        marginBottom: 6,
        display: "block",
      }}
    >
      {label}
    </label>
    {children}
  </div>
);

export const KPI = ({ title, value, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...styles.kpiBox,
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

export const KPIBadge = ({ code, meta, value, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...styles.kpiBadge,
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
   Renderizadores da célula
========================= */
export function DriverDayStatus({ motoristaId, dateObj, statusIndex }) {
  const key = `${motoristaId}|${dateObj.__dayKey}`;
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

export function CargasCell({ motoristaId, dateObj, cargasIndex, cargaStatusBadgeStyle }) {
  const key = `${motoristaId}|${dateObj.__dayKey}`;
  const list = cargasIndex.get(key) || [];
  if (list.length === 0) return null;

  const c = list[0];
  const badge = cargaStatusBadgeStyle(c.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={styles.cellBox}>
        <div style={{ ...styles.statusBadge, background: badge.bg, color: badge.fg }}>
          {c.status || "STATUS"}
        </div>

        <div style={styles.cellLine}><b>Origem:</b> {c.cidadeOrigem || "-"}</div>
        <div style={styles.cellLine}><b>Cliente coleta:</b> {c.clienteColeta || "-"}</div>
        <div style={styles.cellLine}><b>Destino:</b> {c.cidadeDestino || "-"}</div>
        <div style={styles.cellLine}><b>Cliente destino:</b> {c.clienteEntrega || "-"}</div>

        {c.dataColeta ? <div style={styles.cellLine}><b>Coleta:</b> {c.dataColeta}</div> : null}
        {c.dataEntrega ? <div style={styles.cellLine}><b>Entrega:</b> {c.dataEntrega}</div> : null}
      </div>

      {list.length > 1 ? (
        <div style={{ fontSize: 11, fontWeight: 600, color: TG.blueDark }}>
          +{list.length - 1} carga(s)
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Modais
========================= */
export function ModalPicker({
  open,
  close,
  modalMotorista,
  modalDateLabel,
  onOpenStatus,
  onOpenCarga,
}) {
  if (!open) return null;

  return (
    <div style={styles.modalOverlayStyle} onMouseDown={close}>
      <div style={styles.modalCardSmall} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: TG.black, fontSize: 18 }}>Dia do motorista</div>
            <div style={{ fontSize: 12, color: TG.muted, fontWeight: 700 }}>
              {modalMotorista?.nome} • {modalDateLabel}
            </div>
          </div>
          <button onClick={close} style={styles.btnGhost}>✕</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TG.muted, marginBottom: 10 }}>
            O que você quer lançar/editar?
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onOpenStatus} style={{ ...styles.btnPrimary, flex: "1 1 240px" }}>
              🧑‍✈️ Status do motorista
            </button>

            <button onClick={onOpenCarga} style={{ ...styles.btnSecondary, flex: "1 1 240px" }}>
              🚚 Carga do dia
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: TG.muted, fontWeight: 700 }}>
            Dica: clique direto no badge do status ou no bloco da carga para abrir o modal certo.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModalStatus({
  open,
  close,
  modalMotorista,
  modalDateLabel,
  rangeFrom,
  rangeTo,
  setRangeFrom,
  setRangeTo,
  statusCode,
  setStatusCode,
  statusObs,
  setStatusObs,
  motoristaStatusOptions,
  salvarStatusMotorista,
}) {
  if (!open) return null;

  return (
    <div style={styles.modalOverlayStyle} onMouseDown={close}>
      <div style={styles.modalCardStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: TG.black, fontSize: 18 }}>Status do motorista</div>
            <div style={{ fontSize: 12, color: TG.muted, fontWeight: 700 }}>
              {modalMotorista?.nome} • {modalDateLabel}
            </div>
          </div>
          <button onClick={close} style={styles.btnGhost}>✕</button>
        </div>

        <div style={styles.rangeBar}>
          <div style={{ fontWeight: 800, color: TG.black }}>Aplicar por período (opcional)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={styles.rangeLabel}>
              De:
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} style={{ ...styles.input, width: 150 }} />
            </label>
            <label style={styles.rangeLabel}>
              Até:
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} style={{ ...styles.input, width: 150 }} />
            </label>
            <div style={{ fontSize: 12, fontWeight: 700, color: TG.muted }}>
              * Se não preencher as datas, salva só no dia.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={styles.blockTitle}>Status do motorista (P / DS / FE / etc)</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
            <Input span={4} label="Código">
              <select value={statusCode} onChange={(e) => setStatusCode(e.target.value)} style={styles.input}>
                <option value="">(remover status)</option>
                {motoristaStatusOptions.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </Input>

            <Input span={8} label="Observação (fica nos dias aplicados)">
              <input value={statusObs} onChange={(e) => setStatusObs(e.target.value)} style={styles.input} />
            </Input>

            <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={salvarStatusMotorista} style={styles.btnPrimary}>Salvar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModalCarga({
  open,
  close,
  modalMotorista,
  modalDateLabel,
  rangeFrom,
  rangeTo,
  setRangeFrom,
  setRangeTo,
  formCarga,
  onCargaChange,
  cargaStatusOptions,
  excluirCargaDia,
  salvarCarga,
}) {
  if (!open) return null;

  return (
    <div style={styles.modalOverlayStyle} onMouseDown={close}>
      <div style={styles.modalCardStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, color: TG.black, fontSize: 18 }}>Carga do dia</div>
            <div style={{ fontSize: 12, color: TG.muted, fontWeight: 700 }}>
              {modalMotorista?.nome} • {modalDateLabel}
            </div>
          </div>
          <button onClick={close} style={styles.btnGhost}>✕</button>
        </div>

        <div style={styles.rangeBar}>
          <div style={{ fontWeight: 800, color: TG.black }}>Aplicar por período (opcional)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={styles.rangeLabel}>
              De:
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} style={{ ...styles.input, width: 150 }} />
            </label>
            <label style={styles.rangeLabel}>
              Até:
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} style={{ ...styles.input, width: 150 }} />
            </label>
            <div style={{ fontSize: 12, fontWeight: 700, color: TG.muted }}>
              * Se não preencher as datas, salva só no dia.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={styles.blockTitle}>Dados da carga</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
            <Input span={6} label="Origem (Cidade - UF)">
              <input name="cidadeOrigem" value={formCarga.cidadeOrigem} onChange={onCargaChange} style={styles.input} />
            </Input>

            <Input span={6} label="Cliente coleta">
              <input name="clienteColeta" value={formCarga.clienteColeta} onChange={onCargaChange} style={styles.input} />
            </Input>

            <Input span={6} label="Destino (Cidade - UF)">
              <input name="cidadeDestino" value={formCarga.cidadeDestino} onChange={onCargaChange} style={styles.input} />
            </Input>

            <Input span={6} label="Cliente destino">
              <input name="clienteEntrega" value={formCarga.clienteEntrega} onChange={onCargaChange} style={styles.input} />
            </Input>

            <Input span={6} label='Data/Hora Coleta (dd/mm/aaaa hh:mm) — opcional'>
              <input
                name="dataColeta"
                value={formCarga.dataColeta}
                onChange={onCargaChange}
                style={styles.input}
                placeholder="ex: 08/02/2026 07:30"
              />
            </Input>

            <Input span={6} label='Data/Hora Entrega (dd/mm/aaaa hh:mm) — opcional'>
              <input
                name="dataEntrega"
                value={formCarga.dataEntrega}
                onChange={onCargaChange}
                style={styles.input}
                placeholder="ex: 08/02/2026 14:10"
              />
            </Input>

            <Input span={12} label="Status da carga (operação)">
              <select name="status" value={formCarga.status} onChange={onCargaChange} style={styles.input}>
                {cargaStatusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Input>

            <div style={{ gridColumn: "span 12", display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={excluirCargaDia} style={styles.btnDangerMini}>Excluir carga (dia)</button>
              <button onClick={salvarCarga} style={styles.btnPrimary}>Salvar</button>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: TG.muted, fontWeight: 700 }}>
            * Se você preencher "De" e "Até", o botão salvar preenche todos os dias do período. Se não, salva só no dia.
          </div>
        </div>
      </div>
    </div>
  );
}
