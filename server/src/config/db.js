import mysql from 'mysql2/promise'

let pool = null

export const connectDB = async () => {
  const configuredHost = process.env.DB_HOST || '127.0.0.1'
  const host = configuredHost === 'localhost' ? '127.0.0.1' : configuredHost
  const port = Number(process.env.DB_PORT) || 3306
  const database = process.env.DB_NAME || 'geocrete_arc'
  const user = process.env.DB_USER || 'root'
  const password = process.env.DB_PASSWORD || ''

  if (!database) {
    throw new Error('DB_NAME environment variable is required')
  }

  pool = mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+05:30',
    dateStrings: false,
  })

  // Verify the connection works
  try {
    const conn = await pool.getConnection()
    console.log(`MySQL Connected: ${host}:${port}/${database}`)
    conn.release()
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to MySQL at ${host}:${port}.`)
    }
    throw error
  }

  return pool
}

export const getPool = () => {
  if (!pool) throw new Error('Database not initialised. Call connectDB() first.')
  return pool
}
