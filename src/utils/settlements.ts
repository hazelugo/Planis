import type { Friend, Payment, Settlement } from '@/types/domain'

export interface MemberPaymentStat {
  /** This person's share of all logged trip expenses (from split rules). */
  amount: number
  /** Share of total logged expenses (sums to 100% across the crew). */
  percent: number
}

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

/** Round display percents to 1 decimal place; remainder goes to the largest fractional slice. */
function normalizePercents(shares: number[], total: number): number[] {
  if (total <= 0) return shares.map(() => 0)

  const raw = shares.map(s => (s / total) * 100)
  const rounded = raw.map(v => Math.floor(v * 10 + 1e-6) / 10)
  const drift = Math.round((100 - rounded.reduce((sum, v) => sum + v, 0)) * 10) / 10

  if (Math.abs(drift) >= 0.05) {
    const idx = raw.reduce((best, v, i, arr) => {
      const frac = v * 10 - Math.floor(v * 10 + 1e-6)
      const bestFrac = arr[best] * 10 - Math.floor(arr[best] * 10 + 1e-6)
      return frac > bestFrac ? i : best
    }, 0)
    rounded[idx] = Math.round((rounded[idx] + drift) * 10) / 10
  }

  return rounded
}

/**
 * Per-member share of all logged trip expenses (from each payment's split rules).
 * IOU settlement state does not change cost allocation — only who owes whom does.
 */
export function computeMemberPaymentStats(
  friends: Friend[],
  payments: Payment[],
): Map<string, MemberPaymentStat> {
  const stats = new Map<string, MemberPaymentStat>()
  friends.forEach(f => stats.set(f.id, { amount: 0, percent: 0 }))

  const total = payments.reduce((s, p) => s + p.amount, 0)
  if (friends.length === 0 || total <= 0) return stats

  const share: Record<string, number> = {}
  friends.forEach(f => { share[f.id] = 0 })

  for (const p of payments) {
    if (!p.splitAmong.length) continue
    for (const id of p.splitAmong) {
      const pct = p.splitPercentages?.[id] ?? (100 / p.splitAmong.length)
      share[id] = (share[id] ?? 0) + p.amount * pct / 100
    }
  }

  const shares = friends.map(f => share[f.id] ?? 0)
  const percents = normalizePercents(shares, total)

  friends.forEach((f, i) => {
    stats.set(f.id, {
      amount: Math.round(shares[i] * 100) / 100,
      percent: percents[i],
    })
  })

  return stats
}
