import { useEffect, useCallback, useState } from 'react'
import { useOfflineStore } from '../store/offlineStore'
import {
  getPendingTasks,
  removeTask,
  getPendingCount,
  type OfflineTable,
} from '../lib/indexeddb'
import { insertTrack, createCheckin, uploadPhoto } from '../api/supabase'
import { SYNC_RETRY_MAX } from '../utils/constants'

export function useOfflineSync() {
  const { syncStatus, setSyncStatus, setLastSyncAt, setOfflineMode } = useOfflineStore()
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  const updateCounts = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

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

    // 初始化时统计
    updateCounts()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOfflineMode, updateCounts])

  const syncTracks = useCallback(async () => {
    const tasks = (await getPendingTasks('tracks')) as Array<{
      id: number
      user_id: string
      latitude: number
      longitude: number
      speed: number
      battery: number
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
      tempId: string
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
        })
        if (data) {
          tempIdMap.set(task.tempId, data.id)
        }
        await removeTask('checkins', task.id)
      } catch {
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
      } else {
        setSyncStatus('success')
        setLastSyncAt(new Date().toISOString())
        setFailedCount(0)
      }
    } catch {
      setSyncStatus('failed')
    } finally {
      await updateCounts()
    }
  }, [syncStatus, setSyncStatus, setLastSyncAt, syncTracks, syncCheckins, syncPhotos, updateCounts])

  return {
    syncStatus,
    pendingCount,
    failedCount,
    triggerSync,
  }
}
