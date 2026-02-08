// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout.jsx";

import Motoristas from "./Motoristas.jsx";
import Veiculos from "./Veiculos.jsx";
import Carretas from "./Carretas.jsx";
import Cargas from "./Cargas.jsx";
import Folgas from "./Folgas.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* rota padrão */}
        <Route index element={<Navigate to="/motoristas" replace />} />

        {/* rotas do sistema */}
        <Route path="motoristas" element={<Motoristas />} />
        <Route path="folgas" element={<Folgas />} />
        <Route path="carretas" element={<Carretas />} />
        <Route path="veiculos" element={<Veiculos />} />
        <Route path="cargas" element={<Cargas />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/motoristas" replace />} />
      </Route>
    </Routes>
  );
}
