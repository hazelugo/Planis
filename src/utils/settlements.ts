import type { Friend, Payment, Settlement } from '@/types/domain'

/**
 * Minimize-transactions debt settlement algorithm.
 * Pure function — no side effects, safe to call in a computed.
 *
 * Skips payments marked settled:true from the balance calculation.
 * Uses settledPairs string keys ("fromId→toId") to mark individual settlement transactions as paid.
 */
export function computeSettlements(
  friends: Friend[],
  payments: Payment[],
  settledPairs: string[] = []
): Settlement[] {
  if (friends.length < 2 || payments.length === 0) return []

  const bal: Record<string, number> = {}
  friends.forEach(f => { bal[f.id] = 0 })

  payments.forEach(p => {
    if (!p.splitAmong.length || p.settled) return
    bal[p.paidById] = (bal[p.paidById] ?? 0) + p.amount
    p.splitAmong.forEach(id => {
      const pct = p.splitPercentages?.[id] ?? (100 / p.splitAmong.length)
      bal[id] = (bal[id] ?? 0) - p.amount * pct / 100
    })
  })

  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  Object.entries(bal).forEach(([id, b]) => {
    const r = Math.round(b * 100) / 100
    if (r > 0.005) creditors.push({ id, amount: r })
    else if (r < -0.005) debtors.push({ id, amount: -r })
  })

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const txs: Settlement[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount)
    if (transfer > 0.005) {
      const key = `${debtors[di].id}→${creditors[ci].id}`
      if (!settledPairs.includes(key)) {
        txs.push({
          from: debtors[di].id,
          to: creditors[ci].id,
          amount: Math.round(transfer * 100) / 100,
        })
      }
    }
    creditors[ci].amount -= transfer
    debtors[di].amount -= transfer
    if (creditors[ci].amount < 0.005) ci++
    if (debtors[di].amount < 0.005) di++
  }

  return txs
}
