import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout } from '../components/Layout';
import { sitesApi } from '../api/sites';

const createSiteSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  subdomain: z.string()
    .min(1, 'Subdomain ist erforderlich')
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Nur Kleinbuchstaben, Zahlen und Bindestriche'),
  description: z.string().max(500).optional(),
  basicAuthPassword: z.string().min(8, 'Mindestens 8 Zeichen').max(100),
});

type CreateSiteForm = z.infer<typeof createSiteSchema>;

export function CreateSitePage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSiteForm>({
    resolver: zodResolver(createSiteSchema),
  });

  const onSubmit = async (data: CreateSiteForm) => {
    try {
      setError('');
      // Combine subdomain with base domain
      const fullDomain = `${data.subdomain}.pm-iwt.de`;
      const site = await sitesApi.create({
        name: data.name,
        domain: fullDomain,
        description: data.description,
        basicAuthPassword: data.basicAuthPassword,
        basicAuthEnabled: true, // Always enabled
      });
      navigate(`/sites/${site.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen der Seite');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Neue Webseite erstellen</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow">
          {error && <div className="bg-red-50 text-red-800 p-3 rounded text-sm">{error}</div>}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Meine ViFlow Seite"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

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
                .pm-iwt.de
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
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Beschreibung
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optionale Beschreibung..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Erstellen...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
