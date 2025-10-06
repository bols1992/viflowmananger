import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { sitesApi } from '../api/sites';
import { tenantsApi, Tenant } from '../api/tenants';
import { useAuth } from '../context/AuthContext';

const createSiteSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  subdomain: z.string()
    .min(1, 'Subdomain ist erforderlich')
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Nur Kleinbuchstaben, Zahlen und Bindestriche'),
  description: z.string().max(500).optional(),
  basicAuthPassword: z.string().min(8, 'Mindestens 8 Zeichen').max(100),
  tenantId: z.string().optional(),
});

type CreateSiteForm = z.infer<typeof createSiteSchema>;

export function CreateSitePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSiteForm>({
    resolver: zodResolver(createSiteSchema),
  });

  useEffect(() => {
    console.log('CreateSitePage - User:', user);
    if (user?.role === 'ADMIN') {
      loadTenants();
    } else if (user?.role === 'TENANT' && user.tenantId) {
      // Load current tenant's data to get domain
      console.log('Loading tenant data for tenantId:', user.tenantId);
      loadCurrentTenant();
    } else {
      console.log('User is tenant but no tenantId:', user);
    }
  }, [user]);

  const loadTenants = async () => {
    try {
      const data = await tenantsApi.getAll();
      setTenants(data.filter(t => t.active));
    } catch (err) {
      console.error('Failed to load tenants', err);
    }
  };

  const loadCurrentTenant = async () => {
    try {
      if (user?.tenantId) {
        console.log('Fetching tenant data for ID:', user.tenantId);
        const data = await tenantsApi.getById(user.tenantId);
        console.log('Received tenant data:', data);
        setCurrentTenant(data);
      }
    } catch (err) {
      console.error('Failed to load current tenant', err);
    }
  };

  const onSubmit = async (data: CreateSiteForm) => {
    try {
      setError('');
      const site = await sitesApi.create({
        name: data.name,
        subdomain: data.subdomain,
        description: data.description,
        basicAuthPassword: data.basicAuthPassword,
        basicAuthEnabled: true,
        tenantId: data.tenantId,
      });
      navigate(`/sites/${site.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen der Seite');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">+ Neue Webseite erstellen</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          {error && <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded">{error}</div>}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name *
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Meine ViFlow Seite"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
            )}
          </div>

          {user?.role === 'ADMIN' && (
            <div>
              <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mandant (optional)
              </label>
              <select
                id="tenantId"
                {...register('tenantId')}
                onChange={(e) => {
                  const tenant = tenants.find(t => t.id === e.target.value);
                  setSelectedTenant(tenant || null);
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Ohne Mandant (pm-iwt.de)</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.domain})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Subdomain *
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                id="subdomain"
                type="text"
                {...register('subdomain')}
                className="flex-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="meine-seite"
              />
              <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                .{selectedTenant?.domain || currentTenant?.domain || 'pm-iwt.de'}
                {/* Debug: ST={selectedTenant?.domain} CT={currentTenant?.domain} */}
              </span>
            </div>
            {errors.subdomain && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.subdomain.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Beschreibung
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Optionale Beschreibung..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="basicAuthPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Passwort *
            </label>
            <input
              id="basicAuthPassword"
              type="password"
              {...register('basicAuthPassword')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mindestens 8 Zeichen"
            />
            {errors.basicAuthPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.basicAuthPassword.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Dieses Passwort wird für die Login-Seite der Website verwendet
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
            >
              {isSubmitting ? 'Erstellen...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
