import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { sitesApi, Site } from '../api/sites';
import { deploymentsApi, Deployment } from '../api/deployments';

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [site, setSite] = useState<Site | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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

  const handleLogoUpload = async () => {
    if (!logoFile || !id) return;

    try {
      setUploadingLogo(true);
      setError('');
      await sitesApi.uploadLogo(id, logoFile);
      await loadData();
      setLogoFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Logo-Upload fehlgeschlagen');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!id) return;
    if (!confirm('Möchten Sie das Custom Logo wirklich löschen?')) {
      return;
    }

    try {
      setError('');
      await sitesApi.deleteLogo(id);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Löschen des Logos');
    }
  };

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
          <button onClick={() => navigate('/')} className="text-blue-600 dark:text-blue-400 hover:underline mb-4 font-medium transition-colors">
            ← Zurück zur Übersicht
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{site.name}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-2">
            <span>🌐</span> {site.domain}
          </p>
          {site.description && <p className="text-gray-500 dark:text-gray-400 mt-1">{site.description}</p>}
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded">{error}</div>}

        {/* Container Status & Controls */}
        {site.containerName && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Container Status</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    site.containerStatus === 'running'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : site.containerStatus === 'stopped'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      : site.containerStatus === 'building'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}
                >
                  {site.containerStatus === 'running' && '● Running'}
                  {site.containerStatus === 'stopped' && '○ Stopped'}
                  {site.containerStatus === 'building' && '⚙ Building'}
                  {site.containerStatus === 'error' && '✕ Error'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ViFlow Version:</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {site.viflowVersion === '7' && 'ViFlow 7 (.NET Core 3.1)'}
                  {site.viflowVersion === '8' && 'ViFlow 8 (.NET 6)'}
                  {site.viflowVersion === '9' && 'ViFlow 9 (.NET 8)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Port:</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{site.containerPort}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">URL:</span>
                <a
                  href={`http://${site.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                >
                  {site.domain}
                </a>
              </div>

              {site.basicAuthPassword && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Passwort:</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {site.basicAuthPassword}
                  </span>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                {site.containerStatus === 'running' && (
                  <button
                    onClick={handleStop}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-semibold"
                  >
                    Container stoppen
                  </button>
                )}
                {site.containerStatus === 'stopped' && (
                  <button
                    onClick={handleStart}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-semibold"
                  >
                    Container starten
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">🎨 Custom Login Logo</h2>

          {site.customLogoPath && (
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <span className="text-sm text-green-700 dark:text-green-300">✓ Custom Login Logo aktiv</span>
              <button
                onClick={handleLogoDelete}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-all font-semibold"
              >
                Löschen
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo hochladen (PNG, JPG, SVG, WebP)
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-50 file:to-pink-50 dark:file:from-purple-900 dark:file:to-pink-900 file:text-purple-700 dark:file:text-purple-200 hover:file:from-purple-100 hover:file:to-pink-100 dark:hover:file:from-purple-800 dark:hover:file:to-pink-800 file:transition-all file:cursor-pointer"
            />
          </div>

          {logoFile && (
            <button
              onClick={handleLogoUpload}
              disabled={uploadingLogo}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-semibold"
            >
              {uploadingLogo ? 'Hochladen...' : 'Logo hochladen'}
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-red-300 dark:border-red-700">
          <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">⚠️ Gefahrenzone</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Das Löschen dieser Seite ist permanent und kann nicht rückgängig gemacht werden.
          </p>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-semibold"
          >
            Seite löschen
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {site.containerName ? '🚀 Neues Deployment' : '📦 Upload & Deployment'}
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ZIP-Datei auswählen
            </label>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => {
                setUploadFile(e.target.files?.[0] || null);
                setUploadProgress(0);
              }}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-50 file:to-indigo-50 dark:file:from-blue-900 dark:file:to-indigo-900 file:text-blue-700 dark:file:text-blue-200 hover:file:from-blue-100 hover:file:to-indigo-100 dark:hover:file:from-blue-800 dark:hover:file:to-indigo-800 file:transition-all file:cursor-pointer"
            />
          </div>

          {uploadFile && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 font-semibold"
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

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">📜 Deployment Historie</h2>

          {deployments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">Noch keine Deployments</p>
          ) : (
            <div className="space-y-3">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                          deployment.status === 'SUCCESS'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : deployment.status === 'FAILED'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : deployment.status === 'RUNNING'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {deployment.status}
                      </span>
                      {deployment.message && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{deployment.message}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(deployment.createdAt).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/deployments/${deployment.id}`)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium transition-colors"
                  >
                    Logs →
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
