import { createContext } from 'react'
import type { SimResult } from './sim'
export const SimCtx = createContext<SimResult | null>(null)
