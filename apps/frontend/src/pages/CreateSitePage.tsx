import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout } from '../components/Layout';
import { sitesApi } from '../api/sites';

const createSiteSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  domain: z.string().min(3, 'Domain ist erforderlich').max(253),
  description: z.string().max(500).optional(),
  basicAuthPassword: z.string().min(8, 'Mindestens 8 Zeichen').max(100),
  basicAuthEnabled: z.boolean().default(true),
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
    defaultValues: {
      basicAuthEnabled: true,
    },
  });

  const onSubmit = async (data: CreateSiteForm) => {
    try {
      setError('');
      const site = await sitesApi.create(data);
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
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
              Domain *
            </label>
            <input
              id="domain"
              type="text"
              {...register('domain')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="example.com"
            />
            {errors.domain && (
              <p className="mt-1 text-sm text-red-600">{errors.domain.message}</p>
            )}
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
            <label htmlFor="basicAuthPassword" className="block text-sm font-medium text-gray-700">
              Basic Auth Passwort *
            </label>
            <input
              id="basicAuthPassword"
              type="password"
              {...register('basicAuthPassword')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mindestens 8 Zeichen"
            />
            {errors.basicAuthPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.basicAuthPassword.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Dieses Passwort wird für den Nginx Basic Auth Schutz verwendet
            </p>
          </div>

          <div className="flex items-center">
            <input
              id="basicAuthEnabled"
              type="checkbox"
              {...register('basicAuthEnabled')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="basicAuthEnabled" className="ml-2 block text-sm text-gray-900">
              Basic Auth aktivieren (empfohlen)
            </label>
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
