import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HostPortalPage from './pages/HostPortalPage';
import './pages/HostPortalPage.css';

function MissingToken() {
  return (
    <div className="hp-fallback">
      <div>
        <p><strong>MedPlus MVMS</strong></p>
        <p>Open the link from your SMS to view visitor details.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:portalToken" element={<HostPortalPage />} />
        <Route path="*" element={<MissingToken />} />
      </Routes>
    </BrowserRouter>
  );
}
