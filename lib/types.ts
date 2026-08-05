export type Product = { id: string; internal_name: string; full_name: string }
export type PriceDetail = { orders: number; units: number; organic: number; paid: number; refund: number }
export type DailyEntry = {
  product_id: string; date: string
  total_orders: number; total_units: number
  organic_orders: number; paid_orders: number; refund_orders: number
  prices: Record<string, PriceDetail>
}
export type CreatorDaily = {
  product_id: string; date: string; creator: string; channel: string
  orders: number; organic_orders: number; paid_orders: number; refund_orders: number
}
export type CreatorCommission = {
  product_id: string; date: string; creator: string
  commission_type: string; commission_rate: string; orders: number
}
export type BDMember = { id: string; name: string }
export type BDAssignment = {
  id: string
  creator: string
  product_id: string | null  // null = 全部产品
  bd_id: string
}
export type BDMode = 'creator' | 'product' | 'both'
