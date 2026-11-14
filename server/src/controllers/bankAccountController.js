import { BankAccount } from '../models/BankAccount.js'
import { getPool } from '../config/db.js'

export const getBankAccounts = async (_req, res, next) => {
  try {
    const accounts = await BankAccount.findActive()
    res.json(accounts)
  } catch (error) {
    next(error)
  }
}

export const getBankAccountById = async (req, res, next) => {
  try {
    const account = await BankAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' })
    }
    res.json(account)
  } catch (error) {
    next(error)
  }
}

export const createBankAccount = async (req, res, next) => {
  try {
    const {
      bankName,
      ifscCode,
      accountHolderName,
      accountNumber,
      balance,
      credit,
      accountCode,
      accountNumberTag,
      accentColor,
    } = req.body

    // 1. Bank Name validation
    if (!bankName || !bankName.trim()) {
      return res.status(400).json({ error: 'Bank name is required' })
    }

    // 2. IFSC Code validation (Standard Indian IFSC: 4 alphabetic, 0, 6 alphanumeric)
    const trimmedIfsc = (ifscCode || '').trim().toUpperCase()
    if (!trimmedIfsc) {
      return res.status(400).json({ error: 'IFSC code is required' })
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
    if (!ifscRegex.test(trimmedIfsc)) {
      return res.status(400).json({ error: 'Invalid IFSC code format (must be 11 characters e.g. HDFC0001234)' })
    }

    // 3. Account Holder Name validation
    const trimmedHolder = (accountHolderName || '').trim()
    if (!trimmedHolder) {
      return res.status(400).json({ error: 'Account holder name is required' })
    }

    // 4. Account Number validation (preserve leading zeros, standard format 9 to 18 digits)
    const trimmedAccNum = String(accountNumber !== undefined && accountNumber !== null ? accountNumber : '').trim()
    if (!trimmedAccNum) {
      return res.status(400).json({ error: 'Account number is required' })
    }
    const accNumRegex = /^\d{9,18}$/
    if (!accNumRegex.test(trimmedAccNum)) {
      return res.status(400).json({ error: 'Account number must be between 9 and 18 digits' })
    }

    // Prevent duplicate account creation
    const existing = await BankAccount.findByAccountNumber(trimmedAccNum)
    if (existing) {
      return res.status(400).json({ error: 'A bank account with this account number already exists' })
    }

    // 5. Initial Deposit / Opening Balance validation (allow zero, reject negative/invalid)
    if (balance === undefined || balance === null || balance === '') {
      return res.status(400).json({ error: 'Initial deposit / opening balance is required' })
    }
    const numBalance = Number(balance)
    if (isNaN(numBalance) || numBalance < 0) {
      return res.status(400).json({ error: 'Opening balance must be 0 or a positive number' })
    }

    const account = await BankAccount.create({
      accountNumber: trimmedAccNum,
      accountNumberTag,
      bankName: bankName.trim(),
      accountHolderName: trimmedHolder,
      ifscCode: trimmedIfsc,
      accountCode,
      balance: numBalance,
      credit: credit !== undefined ? Number(credit) : 0,
      accentColor,
    })
    res.status(201).json(account)
  } catch (error) {
    next(error)
  }
}

export const updateBankAccount = async (req, res, next) => {
  try {
    const account = await BankAccount.update(req.params.id, req.body)
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' })
    }
    res.json(account)
  } catch (error) {
    next(error)
  }
}

export const deleteBankAccount = async (req, res, next) => {
  try {
    const account = await BankAccount.delete(req.params.id)
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' })
    }
    res.json({ message: 'Bank account deleted successfully' })
  } catch (error) {
    next(error)
  }
}

function formatActualDateTime(rawDbStr, fallbackDate) {
  const str = String(rawDbStr || fallbackDate || '').trim()
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (match) {
    const [_, y, m, d, hh, mm] = match
    const year = Number(y)
    const month = Number(m) - 1
    const day = Number(d)
    const hour24 = hh !== undefined ? Number(hh) : 12
    const minute = mm !== undefined ? Number(mm) : 0
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthName = months[month] || ''
    const period = hour24 >= 12 ? 'pm' : 'am'
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
    const minutePad = String(minute).padStart(2, '0')
    return {
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      dateTime: `${day} ${monthName} ${year}, ${hour12}:${minutePad} ${period}`,
      rawTimestamp: new Date(year, month, day, hour24, minute).getTime(),
    }
  }
  const d = new Date(str)
  return {
    date: isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
    dateTime: isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN'),
    rawTimestamp: isNaN(d.getTime()) ? 0 : d.getTime(),
  }
}

export const getBankTransactions = async (req, res, next) => {
  try {
    const { bankAccountId, type, search, startDate, endDate, limit } = req.query
    const pool = getPool()

    // 1. Fetch active bank accounts to map balances and details
    const [bankRows] = await pool.query(
      'SELECT id, bank_name, account_number, balance FROM bank_accounts WHERE is_active = 1'
    )
    const bankMap = new Map()
    for (const b of bankRows) {
      bankMap.set(String(b.id), b)
    }

    // 2. Fetch incoming / credit transactions (client_payments)
    const [clientPayments] = await pool.query(`
      SELECT 
        cp.id,
        COALESCE(cp.type, 'credit') AS txn_type,
        cp.type,
        cp.amount,
        CAST(cp.created_at AS CHAR) AS created_at_str,
        CAST(cp.payment_date AS CHAR) AS payment_date_str,
        cp.payment_date,
        cp.created_at,
        cp.title,
        cp.payment_method,
        cp.reference,
        cp.status,
        cp.bank_account_id,
        ba.bank_name,
        ba.account_number,
        ba.balance AS bank_current_balance,
        cp.site_id,
        s.name AS site_name,
        s.location AS site_location,
        cp.client_id,
        COALESCE(so.name, s.site_owner) AS client_name,
        so.phone AS client_phone
      FROM client_payments cp
      INNER JOIN bank_accounts ba ON ba.id = cp.bank_account_id AND ba.is_active = 1
      LEFT JOIN sites s ON s.id = cp.site_id
      LEFT JOIN site_owners so ON so.id = cp.client_id
      WHERE cp.amount > 0
    `)

    // 3. Fetch outgoing / debit transactions (expense payments)
    const [expenses] = await pool.query(`
      SELECT 
        ep.id,
        'debit' AS txn_type,
        ep.amount,
        e.amount AS total_bill_amount,
        e.id AS expense_id,
        CAST(ep.created_at AS CHAR) AS created_at_str,
        CAST(ep.payment_date AS CHAR) AS payment_date_str,
        ep.payment_date,
        ep.created_at,
        e.category,
        ep.payment_method,
        ep.reference AS remark,
        ep.notes,
        e.status,
        e.applied_to_material,
        ep.bank_account_id,
        ba.bank_name,
        ba.account_number,
        ba.balance AS bank_current_balance,
        ep.site_id,
        s.name AS site_name,
        s.location AS site_location,
        ep.supplier_id,
        sup.name AS supplier_name,
        sup.company_name AS supplier_company
      FROM expense_payments ep
      INNER JOIN expenses e ON e.id = ep.expense_id
      INNER JOIN bank_accounts ba ON ba.id = ep.bank_account_id AND ba.is_active = 1
      INNER JOIN sites s ON s.id = ep.site_id
      LEFT JOIN suppliers sup ON sup.id = ep.supplier_id
      WHERE ep.amount > 0
    `)

    // 3b. Fetch worker initial advance payments paid from bank accounts on joining
    const [workerInitialAdvances] = await pool.query(`
      SELECT 
        l.id,
        'debit' AS txn_type,
        l.advance_amount AS amount,
        CAST(l.created_at AS CHAR) AS created_at_str,
        CAST(l.joining_date AS CHAR) AS payment_date_str,
        l.joining_date AS payment_date,
        l.created_at,
        l.name AS worker_name,
        l.phone AS worker_phone,
        l.trade,
        l.remarks,
        l.status,
        l.advance_amount,
        l.bank_account_id,
        ba.bank_name,
        ba.account_number,
        ba.balance AS bank_current_balance,
        l.site_id,
        s.name AS site_name,
        s.location AS site_location
      FROM labours l
      INNER JOIN bank_accounts ba ON ba.id = l.bank_account_id AND ba.is_active = 1
      LEFT JOIN sites s ON s.id = l.site_id
      WHERE l.advance_amount > 0
    `)

    // 3c. Fetch recorded worker payments (wage payments, additional advances, settlements)
    const [workerRecordedPayments] = await pool.query(`
      SELECT 
        wp.id,
        wp.worker_id,
        wp.site_id,
        wp.bank_account_id,
        wp.payment_date,
        wp.amount,
        wp.payment_type,
        wp.payment_method,
        wp.reference_id,
        wp.remarks,
        wp.created_by,
        wp.created_at,
        CAST(wp.created_at AS CHAR) AS created_at_str,
        CAST(wp.payment_date AS CHAR) AS payment_date_str,
        l.name AS worker_name,
        l.phone AS worker_phone,
        l.trade,
        s.name AS site_name,
        s.location AS site_location,
        ba.bank_name,
        ba.account_number,
        ba.balance AS bank_current_balance
      FROM worker_payments wp
      INNER JOIN labours l ON l.id = wp.worker_id
      INNER JOIN bank_accounts ba ON ba.id = wp.bank_account_id AND ba.is_active = 1
      LEFT JOIN sites s ON s.id = wp.site_id
      WHERE wp.amount > 0
    `)

    // 4. Map client payments into standardized transaction objects
    const creditTxns = clientPayments.map((cp) => {
      const isAdvance = cp.title && (cp.title.toLowerCase().includes('initial') || cp.title.toLowerCase().includes('advance'))
      const isRefund = cp.title && (cp.title.toLowerCase().includes('refund') || cp.title.toLowerCase().includes('credit'))
      const isDebit = cp.txn_type === 'debit' || cp.type === 'debit'
      const isConsulting = cp.title && cp.title.toLowerCase().includes('consulting')
      const isOther = cp.title && cp.title.toLowerCase().includes('other')

      let title = isAdvance ? 'Site Advance Received' : (cp.title || 'Client Payment Received')
      let category = isRefund ? 'Credit / Refund' : (isAdvance ? 'Site Advance' : (isDebit ? 'Debit / Expense' : 'Credit / Incoming'))
      if (isRefund) {
        title = cp.title || 'Material Purchase Refund'
      } else if (isDebit) {
        title = cp.title || 'Site Owner Payment'
      }

      if (isConsulting) {
        title = cp.title || 'Consulting Payment Received'
        category = 'Consulting'
      } else if (isOther) {
        title = cp.title || (isDebit ? 'Other - Send' : 'Other - Receive')
        category = 'Other'
      }

      const bankName = cp.bank_name || (cp.bank_account_id ? bankMap.get(String(cp.bank_account_id))?.bank_name : null) || 'Bank Account'
      const siteText = cp.site_name || 'Construction Site'
      let subtitle = isRefund ? `${siteText} · Refund to ${bankName}` : `${siteText} · ${bankName}`
      if (isOther) {
        subtitle = `${bankName} · Other Transaction`
      } else if (isConsulting) {
        subtitle = `${cp.site_name || 'Consulting'} · ${bankName}`
      }

      const numAmount = Number(cp.amount || 0)
      const parsedTime = formatActualDateTime(cp.created_at_str, cp.payment_date_str)

      let partyName = isRefund ? 'Material Purchase Refund' : (cp.client_name || 'Site Owner')
      let partyType = isRefund ? 'Supplier' : (isDebit ? 'Site Owner' : 'Client')
      if (isConsulting) {
        partyName = cp.client_name || cp.site_name || 'Consulting Client'
        partyType = 'Consulting'
      } else if (isOther) {
        partyName = cp.reference || (isDebit ? 'Other Payment' : 'Other Receipt')
        partyType = 'Other'
      }

      return {
        id: `cp-${cp.id}`,
        rawId: cp.id,
        type: isDebit ? 'debit' : 'credit',
        title,
        category,
        subtitle,
        amount: numAmount,
        formattedAmount: isDebit ? `−₹${numAmount.toLocaleString('en-IN')}` : `+₹${numAmount.toLocaleString('en-IN')}`,
        rawTimestamp: parsedTime.rawTimestamp,
        date: parsedTime.date,
        dateTime: parsedTime.dateTime,
        status: cp.status || 'Completed',
        bankAccountId: cp.bank_account_id || null,
        bankName,
        accountNumber: cp.account_number || '',
        siteId: cp.site_id || null,
        siteName: cp.site_name || '',
        siteLocation: cp.site_location || '',
        partyName,
        partyType,
        paymentMethod: cp.payment_method || 'Bank Transfer',
        referenceId: cp.reference || `TXN-CP-${String(cp.id).padStart(4, '0')}`,
        remark: cp.reference || cp.title || '',
        balanceAfter: null,
      }
    })

    // 5. Map expenses into standardized transaction objects
    const debitTxns = expenses.map((e) => {
      const numAmount = Number(e.amount || 0)
      const parsedTime = formatActualDateTime(e.created_at_str, e.payment_date_str)
      const isMaterial = Boolean(e.applied_to_material)
      const cat = (e.category || '').trim()
      const isLabour = cat.toLowerCase().includes('labour')
      const supplierParty = e.supplier_company || e.supplier_name || ''
      const bankName = e.bank_name || (e.bank_account_id ? bankMap.get(String(e.bank_account_id))?.bank_name : null) || (e.payment_method || 'Direct Payment')

      let title = 'Daily Site Expense'
      let category = cat || 'Daily Expense'
      let subtitle = ''
      let partyName = ''
      let partyType = null

      const isPartialPayment = Boolean(e.notes && e.notes !== 'Initial Expense Payment')

      if (isPartialPayment) {
        title = 'Expense Payment'
        category = cat || 'Expense Payment'
        partyName = supplierParty || e.site_name || 'Expense Payment'
        partyType = e.supplier_id ? 'Supplier' : 'Expense'
        subtitle = `${category} · ${e.site_name || 'Construction Site'}`
      } else if (isMaterial) {
        title = 'Material Purchase'
        category = cat || 'Material'
        partyName = supplierParty || 'Material Supplier'
        partyType = 'Supplier'
        subtitle = `${category} · ${partyName}`
      } else if (isLabour) {
        title = 'Daily Site Expense'
        category = 'Labour'
        partyName = 'Labour Payment'
        partyType = 'Labour'
        subtitle = `${e.site_name || 'Construction Site'} · Labour Payment`
      } else if (e.supplier_id) {
        title = 'Supplier Payment'
        category = cat || 'Supplier'
        partyName = supplierParty || 'Supplier'
        partyType = 'Supplier'
        subtitle = `${category} · ${partyName}`
      } else {
        title = 'Daily Site Expense'
        category = cat || 'General'
        partyName = e.site_name || 'Site'
        partyType = 'Site'
        subtitle = `${e.site_name || 'Construction Site'} · ${category}`
      }

      return {
        id: `ep-${e.id}`,
        rawId: e.id,
        type: 'debit',
        title,
        category,
        subtitle,
        amount: numAmount,
        formattedAmount: `−₹${numAmount.toLocaleString('en-IN')}`,
        rawTimestamp: parsedTime.rawTimestamp,
        date: parsedTime.date,
        dateTime: parsedTime.dateTime,
        status: e.status === 'Paid' || e.status === 'Partial' ? 'Completed' : 'Pending',
        bankAccountId: e.bank_account_id || null,
        bankName,
        accountNumber: e.account_number || '',
        siteId: e.site_id || null,
        siteName: e.site_name || '',
        siteLocation: e.site_location || '',
        partyName,
        partyType,
        paymentMethod: e.payment_method || 'Bank Transfer',
        referenceId: (e.remark && e.remark.trim()) || `TXN-EXP-${String(e.id).padStart(4, '0')}`,
        remark: e.remark || e.notes || '',
        balanceAfter: null,
      }
    })

    // 5b. Map worker initial advance payments into standardized transaction objects
    const workerAdvanceTxns = workerInitialAdvances.map((wp) => {
      const numAmount = Number(wp.amount || 0)
      const pDate = (wp.payment_date_str || '').slice(0, 10)
      const cTime = (wp.created_at_str || '').slice(11, 19) || '12:00:00'
      const parsedTime = formatActualDateTime(`${pDate} ${cTime}`, wp.payment_date_str)
      const title = 'Worker Advance Payment'
      const bankName = wp.bank_name || (wp.bank_account_id ? bankMap.get(String(wp.bank_account_id))?.bank_name : null) || 'Bank Account'
      const tradeText = wp.trade ? ` (${wp.trade})` : ''
      const subtitle = `${wp.worker_name}${tradeText} · ${bankName}`
      const defaultDesc = `Worker Advance Payment - ${wp.worker_name}`
      const description = wp.remarks && wp.remarks.trim() ? `${defaultDesc} (${wp.remarks.trim()})` : defaultDesc

      return {
        id: `labour-init-${wp.id}`,
        rawId: wp.id,
        type: 'debit',
        title,
        category: 'Worker Advance',
        subtitle,
        amount: numAmount,
        formattedAmount: `−₹${numAmount.toLocaleString('en-IN')}`,
        rawTimestamp: parsedTime.rawTimestamp,
        date: parsedTime.date,
        dateTime: parsedTime.dateTime,
        status: 'Completed',
        bankAccountId: wp.bank_account_id || null,
        bankName,
        accountNumber: wp.account_number || '',
        siteId: wp.site_id || null,
        siteName: wp.site_name || '',
        siteLocation: wp.site_location || '',
        workerId: wp.id,
        partyName: wp.worker_name || 'Worker',
        partyType: 'Worker',
        paymentMethod: 'Bank Transfer',
        referenceId: `TXN-WRK-INIT-${String(wp.id).padStart(4, '0')}`,
        remark: description,
        balanceAfter: null,
      }
    })

    // 5c. Map recorded worker payments into standardized transaction objects
    const workerWageTxns = workerRecordedPayments.map((wp) => {
      const numAmount = Number(wp.amount || 0)
      const pDate = (wp.payment_date_str || '').slice(0, 10)
      const cTime = (wp.created_at_str || '').slice(11, 19) || '12:00:00'
      const parsedTime = formatActualDateTime(`${pDate} ${cTime}`, wp.payment_date_str)
      const pType = wp.payment_type || 'Wage Payment'
      const title = pType === 'Advance Payment'
        ? 'Worker Advance Payment'
        : pType === 'Final Settlement'
        ? 'Worker Final Settlement'
        : 'Worker Wage Payment'
      const bankName = wp.bank_name || (wp.bank_account_id ? bankMap.get(String(wp.bank_account_id))?.bank_name : null) || 'Bank Account'
      const tradeText = wp.trade ? ` (${wp.trade})` : ''
      const subtitle = `${wp.worker_name}${tradeText} · ${bankName}`
      const defaultDesc = `${title} - ${wp.worker_name}`
      const description = wp.remarks && wp.remarks.trim() ? `${defaultDesc} (${wp.remarks.trim()})` : defaultDesc

      return {
        id: `wp-${wp.id}`,
        rawId: wp.id,
        type: 'debit',
        title,
        category: title,
        subtitle,
        amount: numAmount,
        formattedAmount: `−₹${numAmount.toLocaleString('en-IN')}`,
        rawTimestamp: parsedTime.rawTimestamp,
        date: parsedTime.date,
        dateTime: parsedTime.dateTime,
        status: 'Completed',
        bankAccountId: wp.bank_account_id || null,
        bankName,
        accountNumber: wp.account_number || '',
        siteId: wp.site_id || null,
        siteName: wp.site_name || '',
        siteLocation: wp.site_location || '',
        workerId: wp.worker_id,
        paymentRecordId: wp.id,
        partyName: wp.worker_name || 'Worker',
        partyType: 'Worker',
        paymentMethod: wp.payment_method || 'Bank Transfer',
        referenceId: wp.reference_id || `TXN-WRK-${String(wp.id).padStart(4, '0')}`,
        remark: description,
        balanceAfter: null,
      }
    })

    // 6. Combine all transactions and calculate accurate running balance per bank account
    const allCombined = [...creditTxns, ...debitTxns, ...workerAdvanceTxns, ...workerWageTxns]

    // Calculate running balance separately for each bank account
    for (const b of bankRows) {
      const bId = b.id
      const currentBal = Number(b.balance || 0)
      const bTxns = allCombined
        .filter((t) => String(t.bankAccountId) === String(bId))
        .sort((a, b) => a.rawTimestamp - b.rawTimestamp || a.rawId - b.rawId)

      // Step backwards from current balance so the latest transaction ends exactly at current balance
      let running = currentBal
      for (let i = bTxns.length - 1; i >= 0; i--) {
        bTxns[i].balanceAfter = running
        if (bTxns[i].type === 'credit') {
          running = Math.max(0, running - bTxns[i].amount)
        } else {
          running += bTxns[i].amount
        }
      }
    }

    // 7. Sort newest first
    allCombined.sort((a, b) => b.rawTimestamp - a.rawTimestamp || b.rawId - a.rawId)

    // 8. Apply filtering if query params are provided
    let filtered = allCombined

    if (bankAccountId && bankAccountId !== 'all') {
      filtered = filtered.filter((t) => String(t.bankAccountId) === String(bankAccountId))
    }

    if (type && type !== 'all') {
      const targetType = type === 'received' || type === 'credit' ? 'credit' : 'debit'
      filtered = filtered.filter((t) => t.type === targetType)
    }

    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate)
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.siteName.toLowerCase().includes(q) ||
        t.partyName.toLowerCase().includes(q) ||
        t.referenceId.toLowerCase().includes(q) ||
        t.remark.toLowerCase().includes(q) ||
        t.bankName.toLowerCase().includes(q)
      )
    }

    if (limit && !isNaN(Number(limit))) {
      filtered = filtered.slice(0, Number(limit))
    }

    // Calculate totals for quick summary
    const totalReceived = filtered.filter((t) => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0)
    const totalSent = filtered.filter((t) => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0)

    res.json({
      success: true,
      count: filtered.length,
      summary: {
        totalReceived,
        totalSent,
        netBalance: totalReceived - totalSent,
      },
      transactions: filtered,
    })
  } catch (error) {
    next(error)
  }
}
