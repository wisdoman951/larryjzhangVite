// src/App.jsx
import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom'; // react-router-dom v5
import MainLayout from './components/MainLayout.jsx';
import Dashboard from './components/Dashboard.jsx';
import ReportPage from './components/ReportPage.jsx';
import CompliancePage from './components/CompliancePage.jsx';
import NessusAIPage from './components/NessusAIPage'; // 您的 Nessus AI 頁面

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Switch> {/* react-router-dom v5 使用 Switch */}
          <Route exact path="/" component={Dashboard} />
          <Route path="/report" component={ReportPage} />
          <Route path="/compliance" component={CompliancePage} />
          <Route path="/nessus-ai" component={NessusAIPage} />
        </Switch>
      </MainLayout>
    </BrowserRouter>
  );
}
export default App;