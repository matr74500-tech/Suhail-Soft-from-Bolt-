import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (!username || !fullName) {
        setError('يرجى إدخال جميع الحقول');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username, fullName);
      if (error) setError(error);
      else {
        setMode('signin');
        setError(null);
        setEmail('');
        setPassword('');
        setUsername('');
        setFullName('');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-teal-700 to-teal-900 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-300/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-teal-700 mb-4 shadow-lg">
              <span className="text-2xl font-bold text-white">س</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">سهيل سوفت</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              نظام المحاسبة والمخزون والمبيعات
            </p>
          </div>

          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="label">اسم المستخدم</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input"
                    placeholder="أدخل اسم المستخدم"
                    required
                  />
                </div>
                <div>
                  <label className="label">الاسم الكامل</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    placeholder="الاسم الكامل"
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="example@email.com"
                required
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                dir="ltr"
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg p-3 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'signin' ? (
                'تسجيل الدخول'
              ) : (
                'إنشاء حساب'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
