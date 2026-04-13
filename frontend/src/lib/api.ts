import axios from "axios"
import { getSession } from "next-auth/react"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

api.interceptors.request.use(async (config) => {
  const session = await getSession()
  if (session) {
    const res = await fetch("/api/auth/token")
    if (res.ok) {
      const data = await res.json()
      config.headers.Authorization = `Bearer ${data.token}`
    }
  }
  return config
})

export default api