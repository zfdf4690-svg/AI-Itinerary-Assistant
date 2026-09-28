/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HomeView } from './components/views/HomeView';
import { ListeningView } from './components/views/ListeningView';
import { ClarificationView } from './components/views/ClarificationView';
import { ConfirmScheduleView } from './components/views/ConfirmScheduleView';
import { ScheduleEditView } from './components/views/ScheduleEditView';
import { SuccessView } from './components/views/SuccessView';
import { CalendarView } from './components/views/CalendarView';
import { SettingsView } from './components/views/SettingsView';
import { PersonaDetailView } from './components/views/PersonaDetailView';
import { NotificationToast } from './components/common/NotificationToast';
import { ViewType } from './types';

const AppContent: React.FC = () => {
  const { currentView, setCurrentView, activeNotification, dismissNotification } = useApp();

  const renderActiveView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'listening':
        return <ListeningView />;
      case 'clarification':
        return <ClarificationView />;
      case 'confirmation':
        return <ConfirmScheduleView />;
      case 'schedule_edit':
        return <ScheduleEditView />;
      case 'success':
        return <SuccessView />;
      case 'calendar':
        return <CalendarView />;
      case 'persona_detail':
        return <PersonaDetailView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="w-full h-[100dvh] bg-[#F5F5F7] text-[#1D1D1F] font-sans select-none antialiased overflow-hidden relative">
      {/* In-app Notification Toast */}
      <NotificationToast
        notification={activeNotification}
        onDismiss={dismissNotification}
        onViewSchedule={() => {
          dismissNotification();
          setCurrentView('calendar');
        }}
      />

      {/* Active Screen View */}
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {renderActiveView()}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
