// src/App.jsx
import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import MainLayout from './components/MainLayout.jsx'; // 注意副檔名 .jsx
import Dashboard from './components/Dashboard.jsx';
import ReportPage from './components/ReportPage.jsx';
import CompliancePage from './components/CompliancePage.jsx'; // 假設您已創建

function App() {
  return (
    <BrowserRouter> {/* 或 HashRouter */}
      <MainLayout>
        <Switch>
          <Route exact path="/" component={Dashboard} />
          <Route path="/report" component={ReportPage} />
          <Route path="/compliance" component={CompliancePage} />
        </Switch>
      </MainLayout>
    </BrowserRouter>
  );
}
export default App;