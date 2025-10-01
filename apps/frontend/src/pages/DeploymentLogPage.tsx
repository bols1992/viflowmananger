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
        <div className="text-center py-12">Lädt...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12 text-red-600">{error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline mb-2">
              ← Zurück
            </button>
            <h1 className="text-3xl font-bold">Deployment Logs</h1>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-Refresh
            </label>

            <button
              onClick={loadLog}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              Aktualisieren
            </button>
          </div>
        </div>

        {log && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <div className="flex items-center gap-4">
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded ${
                  log.status === 'SUCCESS'
                    ? 'bg-green-100 text-green-800'
                    : log.status === 'FAILED'
                    ? 'bg-red-100 text-red-800'
                    : log.status === 'RUNNING'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {log.status}
              </span>
              {log.message && <span className="text-sm text-gray-600">{log.message}</span>}
            </div>

            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
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
