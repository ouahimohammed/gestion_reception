import { useState } from 'react';
import { ThemeProvider, useTheme } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import { ReceptionForm } from './components/reception-form';
import { ReceptionTable } from './components/reception-table';
import { useTranslation } from './lib/i18n';

function AppContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { language } = useTheme();
  const t = useTranslation();

  const translate = (key) => {
    return t(language, key);
  };

  const handleReceptionAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/20">
      {/* Header moderne avec effet glass */}
      <header className="sticky top-0 z-50 border-b border-gray-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo avec design moderne */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-lg">📦</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {translate('app.title')}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                  {translate('app.subtitle')}
                </p>
              </div>
            </div>

            {/* Badge version */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg shadow-green-500/25">
                v2.0
              </span>
            </div>

            {/* Actions avec toggle de thème */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <section className="animate-fade-in">
            <ReceptionForm onReceptionAdded={handleReceptionAdded} />
          </section>
          
          <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <ReceptionTable refreshTrigger={refreshTrigger} />
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl mt-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {translate('app.footer')} • © 2024 Warehouse System • <span className="font-semibold text-blue-600 dark:text-blue-400">v2.0.0</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="warehouse-theme">
      <AppContent />
    </ThemeProvider>
  );
}

export default App; 