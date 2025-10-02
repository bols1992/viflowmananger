import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ViFlow Manager
          </Link>

          {user && (
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded dark:text-white"
                title="Theme umschalten"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user.username} ({user.role})
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded dark:text-white"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 dark:text-white">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              ViFlow Manager © 2025
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Erstellt von{' '}
                <a
                  href="https://proht.de"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  pro-HT
                </a>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Kontakt:{' '}
                <a
                  href="mailto:info@proht.de"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  info@proht.de
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
