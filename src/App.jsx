// src/App.jsx
import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom'; // react-router-dom v5
import MainLayout from './components/MainLayout.jsx';
import Dashboard from './components/Dashboard.jsx';
import ReportPage from './components/ReportPage.jsx';
import CompliancePage from './components/CompliancePage.jsx';
import NessusAIPage from './components/NessusAIPage'; // 您的 Nessus AI 頁面
import SurveyPage from './components/SurveyPage.jsx';
import TestingProcessPage from './components/TestingProcessPage.jsx';
import KSIDashboardPage from './components/KSIDashboardPage.jsx';
function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Switch> {/* react-router-dom v5 使用 Switch */}
          <Route exact path="/" component={Dashboard} />
          <Route path="/report" component={ReportPage} />
          <Route path="/compliance" component={CompliancePage} />
          <Route path="/nessus-ai" component={NessusAIPage} />
		  
		  <Route exact path="/llm-security" render={() => <Redirect to="/llm-security/survey" />} />
          <Route path="/llm-security/survey" component={SurveyPage} />
          <Route path="/llm-security/testing" component={TestingProcessPage} />
          <Route path="/llm-security/dashboard" component={KSIDashboardPage} />

        </Switch>
      </MainLayout>
    </BrowserRouter>
  );
}
export default App;