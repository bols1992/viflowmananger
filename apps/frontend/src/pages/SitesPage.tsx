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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredSites = sites.filter((site) =>
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Webseiten</h1>
          {isAdmin && (
            <Link
              to="/sites/new"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
            >
              + Neue Webseite
            </Link>
          )}
        </div>

        <div>
          <input
            type="text"
            placeholder="Seiten durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded">{error}</div>}

        {loading ? (
          <div className="text-center py-12">Lädt...</div>
        ) : filteredSites.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Keine passenden Seiten gefunden.' : 'Keine Webseiten vorhanden.'}
            {!searchQuery && isAdmin && ' Erstellen Sie die erste Webseite.'}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSites.map((site) => (
              <Link
                key={site.id}
                to={`/sites/${site.id}`}
                className="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{site.name}</h3>
                  {site.containerStatus && (
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
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
                  )}
                </div>
                <p className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                  🌐 {site.domain}
                </p>
                {site.description && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{site.description}</p>
                )}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    📦 {site.slug}
                  </span>
                  <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                    🚀 {site._count?.deployments || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
