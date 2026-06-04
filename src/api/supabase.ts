import { createClient } from '@supabase/supabase-js'
import type { User, Track, Checkin, Photo } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Auth
export async function signInWithPhone(phone: string, password: string) {
  // 使用手机号+密码登录（需先在 Supabase Auth 中配置）
  // 这里简化实现，实际项目中可能需要 OTP 验证
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${phone}@fieldtracker.local`,
    password,
  })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()
  return data as User | null
}

// Users
export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name')
  return { data: data as User[] | null, error }
}

export async function updateUserStatus(userId: string, status: User['status']) {
  return supabase.from('users').update({ status }).eq('id', userId)
}

// Tracks
export async function insertTrack(payload: Omit<Track, 'id' | 'created_at'>) {
  return supabase.from('tracks').insert(payload)
}

export async function getTracksByUser(userId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true })
  return { data: data as Track[] | null, error }
}

export async function getLatestTracks() {
  // 获取每个用户最新的位置
  const { data, error } = await supabase
    .from('tracks')
    .select('*, user:users(*)')
    .order('created_at', { ascending: false })
    .limit(1000)
  return { data: data as (Track & { user: User })[] | null, error }
}

export async function getTracks(start?: string, end?: string) {
  let query = supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: true })

  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  return { data: data as Track[] | null, error }
}

// Checkins
export async function getCheckins(start?: string, end?: string) {
  let query = supabase
    .from('checkins')
    .select('*, user:users(*), photos(*)')
    .order('sequence_no', { ascending: true })

  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  return { data: data as Checkin[] | null, error }
}

export async function getCheckinsByUser(userId: string, start?: string, end?: string) {
  let query = supabase
    .from('checkins')
    .select('*, photos(*)')
    .eq('user_id', userId)
    .order('sequence_no', { ascending: true })

  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  return { data: data as Checkin[] | null, error }
}

export async function getNextSequenceNo(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('checkins')
    .select('sequence_no')
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`)
    .order('sequence_no', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return 1
  return (data[0].sequence_no || 0) + 1
}

export async function createCheckin(checkin: Omit<Checkin, 'id' | 'created_at' | 'photos'>) {
  const { data, error } = await supabase
    .from('checkins')
    .insert(checkin)
    .select()
    .single()
  return { data: data as Checkin | null, error }
}

// Photos
export async function uploadPhoto(file: File, checkinId: string) {
  const ext = file.name.split('.').pop()
  const fileName = `${checkinId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('checkin-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) return { error: uploadError, data: null }

  const { data: urlData } = supabase.storage
    .from('checkin-photos')
    .getPublicUrl(fileName)

  const { data, error } = await supabase
    .from('photos')
    .insert({
      checkin_id: checkinId,
      photo_url: urlData.publicUrl,
    })
    .select()
    .single()

  return { data: data as Photo | null, error }
}

// Realtime subscriptions
export function subscribeToTracks(callback: (payload: any) => void) {
  return supabase
    .channel('tracks-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tracks' },
      callback
    )
    .subscribe()
}

export function subscribeToCheckins(callback: (payload: any) => void) {
  return supabase
    .channel('checkins-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'checkins' },
      callback
    )
    .subscribe()
}
