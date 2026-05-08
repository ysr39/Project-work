import { useState, FormEvent, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { post } from '@/api/client'
import { EP  } from '@/api/endpoints'
import { useAuthStore } from '@/store/auth.store'

export function Login() {
  const navigate   = useNavigate()
  const setTokens  = useAuthStore((s) => s.setTokens)

  const [step,    setStep]    = useState<'phone' | 'otp'>('phone')
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [loading, setLoading] = useState(false)

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await post('/auth/send-otp', { phone: `+91${phone}`, role: 'ADMIN' })
      setStep('otp')
      toast.success('OTP sent')
    } catch {
      // error toast handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await post<{
        accessToken: string
        refreshToken: string
        user: { id: string; phone: string; fullName: string | null; role: string }
      }>(EP.login, { phone: `+91${phone}`, otp, role: 'ADMIN' })

      if (data.user.role !== 'ADMIN') {
        toast.error('Access denied — Admin accounts only')
        return
      }

      setTokens(data.accessToken, data.refreshToken, data.user)
      navigate('/', { replace: true })
    } catch {
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-primary-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">TaxiPool Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your admin account</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Phone Number</label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
                <span className="flex items-center bg-slate-50 px-3 text-sm text-slate-500 border-r border-slate-200">+91</span>
                <input
                  type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  required maxLength={10}
                  className="flex-1 px-3 py-2.5 text-sm text-slate-800 focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit" disabled={loading || phone.length < 10}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
              OTP sent to +91 {phone} &nbsp;
              <button type="button" onClick={() => setStep('phone')} className="underline font-medium">Change</button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">6-digit OTP</label>
              <input
                type="text" value={otp} inputMode="numeric"
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required maxLength={6}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-center text-lg tracking-[0.5em] text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit" disabled={loading || otp.length < 6}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
