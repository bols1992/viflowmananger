import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { tenantsApi, Tenant, UpdateTenantDto } from '../api/tenants';
import { useAuth } from '../context/AuthContext';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    // Only admins can access this page
    if (user?.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    if (id) {
      loadTenant();
    }
  }, [id, user, navigate]);

  const loadTenant = async () => {
    try {
      setLoading(true);
      const data = await tenantsApi.getById(id!);
      setTenant(data);
      setFormData({
        name: data.name,
        domain: data.domain,
        email: data.email,
        password: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden des Mandanten');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');

      const updateData: UpdateTenantDto = {
        name: formData.name,
        domain: formData.domain,
        email: formData.email,
      };

      // Only include password if it was changed
      if (formData.password) {
        updateData.password = formData.password;
      }

      await tenantsApi.update(id!, updateData);
      setSuccess('Mandant erfolgreich aktualisiert');
      setEditing(false);
      setFormData({ ...formData, password: '' });
      await loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren');
    }
  };

  const handleToggleActive = async () => {
    if (!tenant) return;

    try {
      setError('');
      await tenantsApi.update(id!, { active: !tenant.active });
      await loadTenant();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Status');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Lädt...</div>
      </Layout>
    );
  }

  if (!tenant) {
    return (
      <Layout>
        <div className="text-center py-12 text-red-600">Mandant nicht gefunden</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <button
            onClick={() => navigate('/tenants')}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 font-medium transition-colors"
          >
            ← Zurück zur Mandantenverwaltung
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {tenant.name}
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 rounded">
            {success}
          </div>
        )}

        {/* Tenant Info */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mandanten-Details</h2>
            <button
              onClick={() => setEditing(!editing)}
              className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm"
            >
              {editing ? 'Abbrechen' : 'Bearbeiten'}
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Firmenname
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  E-Mail (Login)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Neues Passwort (optional, mind. 8 Zeichen)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  minLength={8}
                  placeholder="Leer lassen, um Passwort nicht zu ändern"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-semibold"
              >
                Änderungen speichern
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Firmenname:</span>
                <span className="text-sm text-gray-900 dark:text-white">{tenant.name}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Domain:</span>
                <span className="text-sm text-gray-900 dark:text-white">{tenant.domain}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">E-Mail:</span>
                <span className="text-sm text-gray-900 dark:text-white">{tenant.email}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Anzahl Sites:</span>
                <span className="text-sm text-gray-900 dark:text-white">{tenant._count?.sites || 0}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tenant.active
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {tenant.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  <button
                    onClick={handleToggleActive}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {tenant.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Erstellt am:</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {new Date(tenant.createdAt).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sites List */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Webseiten ({tenant.sites?.length || 0})
          </h2>

          {!tenant.sites || tenant.sites.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Noch keine Webseiten für diesen Mandanten
            </p>
          ) : (
            <div className="space-y-3">
              {tenant.sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {site.name}
                      </span>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                        {!site.containerStatus && '- Kein Container'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      🌐 {site.domain}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/sites/${site.id}`)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium transition-colors"
                  >
                    Details →
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
