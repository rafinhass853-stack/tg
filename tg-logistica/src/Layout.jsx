// src/Layout.jsx
import { NavLink, Outlet } from "react-router-dom";

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
};

const linkStyle = ({ isActive }) => ({
  padding: "12px 20px",
  borderRadius: 8,
  textDecoration: "none",
  border: isActive ? `2px solid ${TG.blue}` : `1px solid ${TG.border}`,
  background: isActive ? TG.black : TG.white,
  color: isActive ? TG.white : TG.text,
  fontWeight: 700,
  fontSize: 14,
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  gap: 8,
});

export default function Layout() {
  const menuItems = [
    { path: "/motoristas", label: "Motoristas", icon: "👤" },
    { path: "/folgas", label: "Folgas", icon: "📅" },
    { path: "/carretas", label: "Carretas", icon: "🚛" },
    { path: "/veiculos", label: "Veículos", icon: "🚚" },
    { path: "/cargas", label: "Cargas", icon: "📦" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: TG.bg }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 20 }}>
        {/* HEADER */}
        <div style={{ 
          background: TG.black, 
          color: TG.white, 
          padding: "20px 24px", 
          borderRadius: 12,
          marginBottom: 20,
          borderBottom: `4px solid ${TG.blue}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 28 }}>TG Logística • Frota</h1>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)" }}>
            Sistema de gestão de frota e motoristas
          </div>
        </div>

        {/* MENU DE NAVEGAÇÃO */}
        <div style={{ 
          display: "flex", 
          gap: 12, 
          flexWrap: "wrap", 
          marginBottom: 24,
          background: TG.white,
          padding: 16,
          borderRadius: 12,
          border: `1px solid ${TG.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          {menuItems.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              style={linkStyle}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* CONTEÚDO */}
        <div style={{ 
          background: TG.white, 
          borderRadius: 12, 
          border: `1px solid ${TG.border}`,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <Outlet />
        </div>

        {/* FOOTER */}
        <div style={{ 
          marginTop: 24, 
          textAlign: "center", 
          fontSize: 12, 
          color: TG.muted,
          padding: 16,
        }}>
          TG Logística • Sistema de Gestão de Frota • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}