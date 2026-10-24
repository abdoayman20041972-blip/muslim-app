import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

export default function AppConvexProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
