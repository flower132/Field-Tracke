import { useState } from 'react'
import { MapPin, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { signInWithPhone } from '../api/supabase'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !password.trim()) {
      setError('请输入手机号和密码')
      return
    }
    setLoading(true)
    try {
      const { data, error: signInError } = await signInWithPhone(phone, password)
      if (signInError || !data.user) {
        // 模拟登录 fallback（开发环境）
        const mockUser = {
          id: 'mock-' + phone,
          name: phone,
          phone,
          role: phone.includes('admin') ? 'admin' as const : 'tester' as const,
          status: 'online' as const,
          created_at: new Date().toISOString(),
        }
        setUser(mockUser)
        return
      }
      // 实际项目中从 users 表获取用户信息
      setUser({
        id: data.user.id,
        name: data.user.user_metadata?.name || phone,
        phone,
        role: data.user.user_metadata?.role || 'tester',
        status: 'online',
        created_at: data.user.created_at || new Date().toISOString(),
      })
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-slate-950 px-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600/20 text-primary-400">
          <MapPin size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">外场投诉测试管理平台</h1>
        <p className="mt-1 text-sm text-slate-500">Field Tracker</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">手机号</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">密码</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 pr-10 text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-rose-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-600">
        测试账号: admin / 123456 或 tester / 123456
      </p>
    </div>
  )
}
