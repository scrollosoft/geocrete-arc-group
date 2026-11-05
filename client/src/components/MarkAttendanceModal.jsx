import React, { useState, useEffect } from 'react'
import { X, UserCheck, Loader2, AlertTriangle } from 'lucide-react'
import { attendanceService } from '../services/attendanceService.js'

const STATUS_OPTIONS = ['Present', 'Half Day', 'Absent', 'Leave']

const STATUS_COLORS = {
  Present: { bg: '#DCFCE7', color: '#15803D' },
  'Half Day': { bg: '#FEF9C3', color: '#A16207' },
  Absent: { bg: '#FEE2E2', color: '#B91C1C' },
  Leave: { bg: '#E0E7FF', color: '#4338CA' },
  Pending: { bg: '#F1F5F9', color: '#64748B' },
}

export default function MarkAttendanceModal({ onClose, selectedSite, sites = [], onSuccess }) {
  const today = new Date().toISOString().slice(0, 10)
  const [attendanceDate, setAttendanceDate] = useState(today)
  const [selectedSiteId, setSelectedSiteId] = useState(selectedSite?._id || selectedSite?.id || '')
  const [workers, setWorkers] = useState([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [workersError, setWorkersError] = useState('')
  const [records, setRecords] = useState({}) // workerId -> { status, remarks }
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch workers when site or date changes
  useEffect(() => {
    if (!selectedSiteId || !attendanceDate) {
      setWorkers([])
      setRecords({})
      return
    }
    setLoadingWorkers(true)
    setWorkersError('')
    setSaveError('')
    setSaveSuccess(false)
    setWorkers([])
    setRecords({})

    attendanceService
      .getByDateAndSite(selectedSiteId, attendanceDate)
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        // Filter: Worker Joining Date <= Selected Attendance Date
        const eligible = list.filter((w) => {
          if (!w.joiningDate) return true
          const joinStr = new Date(w.joiningDate).toISOString().slice(0, 10)
          return joinStr <= attendanceDate
        })
        setWorkers(eligible)
        // Pre-fill existing attendance or default to Present
        const init = {}
        for (const w of eligible) {
          init[w.workerId] = {
            status: w.status === 'Pending' ? 'Present' : w.status,
            remarks: w.remarks || '',
          }
        }
        setRecords(init)
      })
      .catch((err) => setWorkersError(err.message || 'Failed to load workers'))
      .finally(() => setLoadingWorkers(false))
  }, [selectedSiteId, attendanceDate])

  function setWorkerField(workerId, field, value) {
    setRecords((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], [field]: value },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedSiteId) { setSaveError('Please select a site.'); return }
    if (!attendanceDate) { setSaveError('Please select a date.'); return }

    // Worker-wise filtering: ensure only eligible workers (joining_date <= attendanceDate) are submitted
    const eligibleWorkers = workers.filter((w) => {
      if (!w.joiningDate) return true
      const joinStr = new Date(w.joiningDate).toISOString().slice(0, 10)
      return joinStr <= attendanceDate
    })

    if (eligibleWorkers.length === 0) {
      setSaveError('No eligible workers found for the selected attendance date.')
      return
    }

    const recordsArray = eligibleWorkers.map((w) => ({
      workerId: w.workerId,
      status: records[w.workerId]?.status || 'Absent',
      remarks: records[w.workerId]?.remarks || '',
    }))

    setSaving(true)
    setSaveError('')
    try {
      await attendanceService.save({ siteId: selectedSiteId, attendanceDate, records: recordsArray, markedBy: 'Admin' })
      setSaveSuccess(true)
      if (onSuccess) onSuccess()
      setTimeout(() => onClose(), 1200)
    } catch (err) {
      setSaveError(err.message || 'Failed to save attendance.')
    } finally {
      setSaving(false)
    }
  }

  const selectedSiteName = sites.find((s) => String(s._id || s.id) === String(selectedSiteId))?.name || 'Selected Site'

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-box"
        style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #E5EAF1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#EFF6FF', borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={20} color="#2563EB" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#172033' }}>Mark Attendance</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#70829F', marginTop: '2px' }}>Record daily attendance for site workers</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#70829F', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto' }}>
          {/* Filters */}
          <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid #F1F5F9' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Construction Site <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: '#172033', background: '#fff' }}
                required
              >
                <option value="">Select a site...</option>
                {sites.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Attendance Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                value={attendanceDate}
                max={today}
                onChange={(e) => setAttendanceDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: '#172033', background: '#fff', boxSizing: 'border-box' }}
                required
              />
            </div>
          </div>

          {/* Workers Table */}
          <div style={{ padding: '0 24px 20px' }}>
            {loadingWorkers && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '32px 0', justifyContent: 'center', color: '#70829F' }}>
                <Loader2 size={20} className="spin" />
                <span>Loading workers...</span>
              </div>
            )}

            {!loadingWorkers && workersError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', marginTop: '16px' }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: '13px' }}>{workersError}</span>
              </div>
            )}

            {!loadingWorkers && !workersError && selectedSiteId && workers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#70829F', fontSize: '14px' }}>
                No eligible workers found for this site on the selected date.
              </div>
            )}

            {!loadingWorkers && workers.length > 0 && (
              <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px' }}>WORKER</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px' }}>TRADE</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px' }}>DAILY RATE</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px' }}>STATUS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px' }}>REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w) => {
                      const rec = records[w.workerId] || { status: 'Present', remarks: '' }
                      const statusStyle = STATUS_COLORS[rec.status] || STATUS_COLORS.Pending
                      return (
                        <tr key={w.workerId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#172033', fontSize: '14px' }}>{w.name}</div>
                            <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px' }}>{w.phone}</div>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '13.5px', color: '#374151' }}>{w.trade}</td>
                          <td style={{ padding: '12px 14px', fontSize: '13.5px', color: '#172033', fontWeight: 600 }}>
                            ₹{Number(w.dailyRate).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <select
                              value={rec.status}
                              onChange={(e) => setWorkerField(w.workerId, 'status', e.target.value)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '20px',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: statusStyle.bg,
                                color: statusStyle.color,
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <input
                              type="text"
                              placeholder="Optional note..."
                              value={rec.remarks}
                              onChange={(e) => setWorkerField(w.workerId, 'remarks', e.target.value)}
                              style={{ width: '100%', padding: '6px 10px', border: '1px solid #E5EAF1', borderRadius: '6px', fontSize: '13px', color: '#374151', background: '#F8FAFC', boxSizing: 'border-box' }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {saveError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', marginTop: '16px' }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: '13px' }}>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div style={{ padding: '12px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', color: '#15803D', fontWeight: 600, marginTop: '16px', textAlign: 'center' }}>
                ✓ Attendance saved successfully!
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#F8FAFC', borderRadius: '0 0 14px 14px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || workers.length === 0 || saveSuccess}
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                background: saving || workers.length === 0 || saveSuccess ? '#93C5FD' : '#2563EB',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: saving || workers.length === 0 || saveSuccess ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {saving && <Loader2 size={15} className="spin" />}
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

