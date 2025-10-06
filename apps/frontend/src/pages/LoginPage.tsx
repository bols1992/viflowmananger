import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authApi } from '../api/auth';

const adminLoginSchema = z.object({
  username: z.string().min(3, 'Mindestens 3 Zeichen'),
  password: z.string().min(6, 'Mindestens 6 Zeichen'),
});

const tenantLoginSchema = z.object({
  email: z.string().email('Gültige E-Mail erforderlich'),
  password: z.string().min(6, 'Mindestens 6 Zeichen'),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;
type TenantLoginForm = z.infer<typeof tenantLoginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState<'admin' | 'tenant'>('admin');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AdminLoginForm | TenantLoginForm>({
    resolver: zodResolver(loginType === 'admin' ? adminLoginSchema : tenantLoginSchema),
  });

  const handleLoginTypeChange = (type: 'admin' | 'tenant') => {
    setLoginType(type);
    setError('');
    reset();
  };

  const onSubmit = async (data: AdminLoginForm | TenantLoginForm) => {
    try {
      setError('');
      if (loginType === 'admin') {
        const adminData = data as AdminLoginForm;
        await login(adminData.username, adminData.password);
      } else {
        const tenantData = data as TenantLoginForm;
        // Call tenant login API and refresh page to load user
        await authApi.loginTenant(tenantData);
        window.location.href = '/';
        return;
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login fehlgeschlagen');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center">
            <img src="/logo_proht_hell.png" alt="pro-HT Logo" className="mx-auto mb-4 h-12 brightness-0 invert" />
            <h2 className="text-3xl font-bold text-white mb-2">ViFlow Manager</h2>
            <p className="text-blue-100">{loginType === 'admin' ? 'Admin Login' : 'Mandanten Login'}</p>
          </div>

          {/* Login Type Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => handleLoginTypeChange('admin')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-all ${
                loginType === 'admin'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              👤 Admin
            </button>
            <button
              type="button"
              onClick={() => handleLoginTypeChange('tenant')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-all ${
                loginType === 'tenant'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              🏢 Mandant
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {loginType === 'admin' ? (
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Benutzername
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    👤
                  </div>
                  <input
                    id="username"
                    type="text"
                    {...register('username' as any)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="admin"
                  />
                </div>
                {errors.username && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.username.message}</p>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  E-Mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    📧
                  </div>
                  <input
                    id="email"
                    type="email"
                    {...register('email' as any)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="mail@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Passwort
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  🔒
                </div>
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Anmelden...
                </span>
              ) : (
                'Anmelden →'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-8 py-4 text-center text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            Entwickelt von{' '}
            <a href="https://proht.de" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              pro-HT
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
