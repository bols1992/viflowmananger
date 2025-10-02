import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { sitesApi, Site } from '../api/sites';
import { deploymentsApi, Deployment } from '../api/deployments';
import { useAuth } from '../context/AuthContext';

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [site, setSite] = useState<Site | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [siteData, deploymentsData] = await Promise.all([
        sitesApi.getById(id!),
        deploymentsApi.getAll(id!),
      ]);
      setSite(siteData);
      setDeployments(deploymentsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !id) return;

    try {
      setUploading(true);
      setError('');
      await sitesApi.upload(id, uploadFile, setUploadProgress);
      setUploadSuccess(true);
      setUploadProgress(100);
      // Keep uploading state for spinner after 100%
      // Reload site data to get new container status
      setTimeout(async () => {
        await loadData();
        setUploading(false);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload fehlgeschlagen');
      setUploading(false);
    }
  };

  const handleStart = async () => {
    if (!id) return;
    try {
      setError('');
      await sitesApi.start(id);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Container konnte nicht gestartet werden');
    }
  };

  const handleStop = async () => {
    if (!id) return;
    try {
      setError('');
      await sitesApi.stop(id);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Container konnte nicht gestoppt werden');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm(`Möchten Sie die Seite "${site?.name}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    try {
      setError('');
      await sitesApi.delete(id);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Lädt...</div>
      </Layout>
    );
  }

  if (!site) {
    return (
      <Layout>
        <div className="text-center py-12 text-red-600">Seite nicht gefunden</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline mb-4">
            ← Zurück zur Übersicht
          </button>
          <h1 className="text-3xl font-bold">{site.name}</h1>
          <p className="text-gray-600 mt-2">{site.domain}</p>
          {site.description && <p className="text-gray-500 mt-1">{site.description}</p>}
        </div>

        {error && <div className="bg-red-50 text-red-800 p-4 rounded">{error}</div>}

        {/* Container Status & Controls */}
        {site.containerName && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Container Status</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    site.containerStatus === 'running'
                      ? 'bg-green-100 text-green-800'
                      : site.containerStatus === 'stopped'
                      ? 'bg-gray-100 text-gray-800'
                      : site.containerStatus === 'building'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {site.containerStatus === 'running' && '● Running'}
                  {site.containerStatus === 'stopped' && '○ Stopped'}
                  {site.containerStatus === 'building' && '⚙ Building'}
                  {site.containerStatus === 'error' && '✕ Error'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">ViFlow Version:</span>
                <span className="text-sm text-gray-600">
                  {site.viflowVersion === '7' ? 'ViFlow 7 (.NET Core 3.1)' : 'ViFlow 8 (.NET Core 8)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Port:</span>
                <span className="text-sm text-gray-600">{site.containerPort}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">URL:</span>
                <a
                  href={`http://${site.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {site.domain}
                </a>
              </div>

              {isAdmin && (
                <div className="pt-4 flex gap-3">
                  {site.containerStatus === 'running' && (
                    <button
                      onClick={handleStop}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Container stoppen
                    </button>
                  )}
                  {site.containerStatus === 'stopped' && (
                    <button
                      onClick={handleStart}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Container starten
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Gefahrenzone</h2>
            <p className="text-sm text-gray-600 mb-4">
              Das Löschen dieser Seite ist permanent und kann nicht rückgängig gemacht werden.
            </p>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Seite löschen
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <h2 className="text-xl font-semibold">
              {site.containerName ? 'Neues Deployment' : 'Upload & Deployment'}
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP-Datei auswählen
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  setUploadFile(e.target.files?.[0] || null);
                  setUploadSuccess(false);
                  setUploadProgress(0);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {uploadFile && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading && uploadProgress < 100 && `Hochladen... ${Math.round(uploadProgress)}%`}
                {uploading && uploadProgress === 100 && (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Container wird gebaut und gestartet...</span>
                  </>
                )}
                {!uploading && 'Hochladen & Deployen'}
              </button>
            )}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Deployment Historie</h2>

          {deployments.length === 0 ? (
            <p className="text-gray-500">Noch keine Deployments</p>
          ) : (
            <div className="space-y-3">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                          deployment.status === 'SUCCESS'
                            ? 'bg-green-100 text-green-800'
                            : deployment.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : deployment.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {deployment.status}
                      </span>
                      {deployment.message && (
                        <span className="text-sm text-gray-600">{deployment.message}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(deployment.createdAt).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/deployments/${deployment.id}`)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Logs
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
