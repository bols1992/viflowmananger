import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { deploymentsApi, DeploymentLog } from '../api/deployments';

export function DeploymentLogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [log, setLog] = useState<DeploymentLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (id) {
      loadLog();
    }
  }, [id]);

  useEffect(() => {
    if (!autoRefresh || !id) return;

    const interval = setInterval(() => {
      if (log?.status === 'RUNNING' || log?.status === 'QUEUED') {
        loadLog();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, log?.status, id]);

  const loadLog = async () => {
    try {
      setLoading(true);
      const data = await deploymentsApi.getLog(id!);
      setLog(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !log) {
    return (
      <Layout>
        <div className="text-center py-12 dark:text-white">Lädt...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12 text-red-600 dark:text-red-400">{error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => navigate(-1)} className="text-blue-600 dark:text-blue-400 hover:underline mb-2 font-medium transition-colors">
              ← Zurück
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">📋 Deployment Logs</h1>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 cursor-pointer"
              />
              Auto-Refresh
            </label>

            <button
              onClick={loadLog}
              className="px-4 py-2 text-sm bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500 rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
            >
              Aktualisieren
            </button>
          </div>
        </div>

        {log && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-4">
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  log.status === 'SUCCESS'
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : log.status === 'FAILED'
                    ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    : log.status === 'RUNNING'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}
              >
                {log.status}
              </span>
              {log.message && <span className="text-sm text-gray-600 dark:text-gray-400">{log.message}</span>}
            </div>

            <div className="bg-gray-900 dark:bg-black text-gray-100 dark:text-gray-200 p-4 rounded-lg overflow-x-auto border border-gray-700 dark:border-gray-800">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {log.log || 'Keine Logs verfügbar'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
