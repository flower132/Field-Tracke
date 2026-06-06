import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { signIn, supabase } from '../api/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!employeeId.trim() || !password.trim()) {
      setError('请输入工号和密码')
      return
    }
    setLoading(true)
    try {
      const { data, error: signInError } = await signIn(employeeId, password)
      if (signInError || !data.user) {
        setError(signInError?.message || '登录失败，请检查工号和密码')
        setLoading(false)
        return
      }
      // 从 users 表读取完整用户信息
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()
      if (userData) {
        setUser(userData as any)
      } else {
        // users 表无记录，用 metadata 兜底
        setUser({
          id: data.user.id,
          name: data.user.user_metadata?.name || employeeId,
          phone: data.user.user_metadata?.phone || employeeId,
          role: data.user.user_metadata?.role || 'tester',
          status: 'online',
          created_at: data.user.created_at || new Date().toISOString(),
        })
      }
      // 登录成功，跳转到首页（Dashboard 会根据角色自动渲染）
      navigate('/', { replace: true })
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
          <label className="mb-1 block text-sm font-medium text-slate-400">工号</label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="请输入工号"
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
        外场投诉测试管理平台
      </p>
    </div>
  )
}
