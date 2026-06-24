import { useEffect, useCallback, useState } from 'react'
import { useOfflineStore } from '../store/offlineStore'
import {
  getPendingTasks,
  removeTask,
  getPendingCount,
  updateTaskRetry,
} from '../lib/indexeddb'
import { insertTrack, createCheckin, uploadPhoto } from '../api/supabase'
import { SYNC_RETRY_MAX } from '../utils/constants'

export function useOfflineSync() {
  const { syncStatus, setSyncStatus, setLastSyncAt, setOfflineMode } = useOfflineStore()
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [retryTick, setRetryTick] = useState(0)

  const updateCounts = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  const syncTracks = useCallback(async () => {
    const tasks = (await getPendingTasks('tracks')) as Array<{
      id: number
      user_id: string
      latitude: number
      longitude: number
      speed: number
      battery: number
      retryCount?: number
      _createdAt: string
    }>

    let failed = 0
    for (const task of tasks) {
      try {
        await insertTrack({
          user_id: task.user_id,
          latitude: task.latitude,
          longitude: task.longitude,
          speed: task.speed,
          battery: task.battery,
        })
        await removeTask('tracks', task.id)
      } catch {
        const retry = (task.retryCount || 0) + 1
        if (retry >= SYNC_RETRY_MAX) {
          await removeTask('tracks', task.id)
        } else {
          await updateTaskRetry('tracks', task.id, retry)
        }
        failed++
      }
    }
    return failed
  }, [])

  const syncCheckins = useCallback(async () => {
    const tasks = (await getPendingTasks('checkins')) as Array<{
      id: number
      user_id: string
      sequence_no: number
      latitude: number
      longitude: number
      address: string
      title: string
      complaint_content: string
      test_result: string
      solution_result: string
      remark: string
      gps_accuracy?: number
      gps_status?: string
      tempId: string
      retryCount?: number
      _createdAt: string
    }>

    const tempIdMap = new Map<string, string>() // tempId -> serverId
    let failed = 0

    for (const task of tasks) {
      try {
        const { data } = await createCheckin({
          user_id: task.user_id,
          sequence_no: task.sequence_no,
          latitude: task.latitude,
          longitude: task.longitude,
          address: task.address,
          title: task.title,
          complaint_content: task.complaint_content,
          test_result: task.test_result,
          solution_result: task.solution_result,
          remark: task.remark,
          gps_accuracy: task.gps_accuracy,
          gps_status: task.gps_status,
        })
        if (data) {
          tempIdMap.set(task.tempId, data.id)
        }
        await removeTask('checkins', task.id)
      } catch {
        const retry = (task.retryCount || 0) + 1
        if (retry >= SYNC_RETRY_MAX) {
          await removeTask('checkins', task.id)
        } else {
          await updateTaskRetry('checkins', task.id, retry)
        }
        failed++
      }
    }

    return { failed, tempIdMap }
  }, [])

  const syncPhotos = useCallback(
    async (tempIdMap: Map<string, string>) => {
      const tasks = (await getPendingTasks('photos')) as Array<{
        id: number
        checkinTempId: string
        file: Blob
        fileName: string
        retryCount?: number
        _createdAt: string
      }>

      let failed = 0
      for (const task of tasks) {
        const checkinId = tempIdMap.get(task.checkinTempId)
        if (!checkinId) {
          failed++
          continue
        }
        try {
          const file = new File([task.file], task.fileName, { type: 'image/jpeg' })
          await uploadPhoto(file, checkinId)
          await removeTask('photos', task.id)
        } catch {
          const retry = (task.retryCount || 0) + 1
          if (retry >= SYNC_RETRY_MAX) {
            await removeTask('photos', task.id)
          } else {
            await updateTaskRetry('photos', task.id, retry)
          }
          failed++
        }
      }
      return failed
    },
    []
  )

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return
    if (syncStatus === 'syncing') return

    const count = await getPendingCount()
    if (count === 0) return

    setSyncStatus('syncing')
    let totalFailed = 0

    try {
      // 同步顺序：tracks -> checkins -> photos
      totalFailed += await syncTracks()
      const { failed: checkinFailed, tempIdMap } = await syncCheckins()
      totalFailed += checkinFailed
      totalFailed += await syncPhotos(tempIdMap)

      if (totalFailed > 0) {
        setSyncStatus('failed')
        setFailedCount(totalFailed)
        // 指数退避后重试
        const delay = Math.min(Math.pow(2, Math.min(totalFailed, 5)) * 1000, 30000)
        setTimeout(() => setRetryTick((t) => t + 1), delay)
      } else {
        setSyncStatus('success')
        setLastSyncAt(new Date().toISOString())
        setFailedCount(0)
      }
    } catch {
      setSyncStatus('failed')
      setTimeout(() => setRetryTick((t) => t + 1), 5000)
    } finally {
      await updateCounts()
    }
  }, [syncStatus, setSyncStatus, setLastSyncAt, syncTracks, syncCheckins, syncPhotos, updateCounts])

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => {
      setOfflineMode(false)
      triggerSync()
    }
    const handleOffline = () => {
      setOfflineMode(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOfflineMode(!navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOfflineMode, triggerSync])

  // 重试触发器
  useEffect(() => {
    if (retryTick === 0) return
    const timer = setTimeout(() => triggerSync(), 0)
    return () => clearTimeout(timer)
  }, [retryTick, triggerSync])

  return {
    syncStatus,
    pendingCount,
    failedCount,
    triggerSync,
  }
}
