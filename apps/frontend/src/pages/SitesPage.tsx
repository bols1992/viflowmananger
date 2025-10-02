import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { sitesApi, Site } from '../api/sites';
import { useAuth } from '../context/AuthContext';

export function SitesPage() {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      setLoading(true);
      const data = await sitesApi.getAll();
      setSites(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Seiten');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Webseiten</h1>
          {isAdmin && (
            <Link
              to="/sites/new"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Neue Webseite
            </Link>
          )}
        </div>

        {error && <div className="bg-red-50 text-red-800 p-4 rounded">{error}</div>}

        {loading ? (
          <div className="text-center py-12">Lädt...</div>
        ) : sites.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Keine Webseiten vorhanden.
            {isAdmin && ' Erstellen Sie die erste Webseite.'}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <Link
                key={site.id}
                to={`/sites/${site.id}`}
                className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900">{site.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{site.domain}</p>
                {site.description && (
                  <p className="mt-2 text-sm text-gray-500">{site.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>Slug: {site.slug}</span>
                  <span>{site._count?.deployments || 0} Deployments</span>
                </div>
                <div className="mt-2 flex gap-2 text-xs flex-wrap">
                  {site.basicAuthEnabled ? (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">
                      Basic Auth aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800">
                      Basic Auth deaktiviert
                    </span>
                  )}
                  {site.containerStatus && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded ${
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
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
