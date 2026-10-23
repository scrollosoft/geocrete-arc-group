import { BankAccount } from '../models/BankAccount.js'

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
    const { accountNumber, accountNumberTag, bankName, accountCode, balance, credit, accentColor } = req.body
    if (!bankName || !accountCode) {
      return res.status(400).json({ error: 'Bank name and account code are required' })
    }
    const account = await BankAccount.create({
      accountNumber,
      accountNumberTag,
      bankName,
      accountCode,
      balance: balance !== undefined ? Number(balance) : 0,
      credit:  credit  !== undefined ? Number(credit)  : 0,
      accentColor: accentColor || '#3980FF',
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
