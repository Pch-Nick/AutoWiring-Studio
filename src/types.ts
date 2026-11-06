import { z } from 'zod'
export type Fn = 'pwr' | 'gnd' | 'sig'
export interface Pin { id: string; number: string; name: string; fn: Fn; side: 'left' | 'right'; x?: number; y?: number }
export interface CompData extends Record<string, unknown> {
  libId: string; name: string; category: string; pins: Pin[]
  switchState?: 'open' | 'closed'; value?: number; position?: string; notes?: string; source: 'library' | 'user' | 'ai'; verified: boolean
}
export interface WireData extends Record<string, unknown> { color: string; label?: string; dashed?: boolean; width?: number; crossSection?: string; points?: { x: number; y: number }[] }
export const ProjectSchema = z.object({
  version: z.literal(1), id: z.string(), name: z.string(),
  vehicleType: z.string().optional(), vehicleBrand: z.string().optional(), vehicleModel: z.string().optional(),
  createdAt: z.string(), updatedAt: z.string(),
  components: z.array(z.object({ id: z.string(), position: z.object({ x: z.number(), y: z.number() }), data: z.any() })),
  wires: z.array(z.object({ id: z.string(), source: z.string(), sourceHandle: z.string().nullable().optional(), target: z.string(), targetHandle: z.string().nullable().optional(), data: z.any() })),
})
export type ProjectFile = z.infer<typeof ProjectSchema>
