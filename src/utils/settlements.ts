import type { Friend, Payment, Settlement } from '@/types/domain'

export interface MemberPaymentStat {
  /** Net $ this person has covered toward trip expenses (fronted + settled IOUs). */
  amount: number
  /** Share of total logged expenses (sums to ~100% across the crew). */
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

/**
 * Per-member contribution toward total logged expenses.
 * Uses unsettled splitter payments for fair-share math, then credits settled IOUs.
 * amount = fairShare + adjustedBalance → always sums to total active expense responsibility.
 */
export function computeMemberPaymentStats(
  friends: Friend[],
  payments: Payment[],
  settledPairs: string[] = [],
): Map<string, MemberPaymentStat> {
  const stats = new Map<string, MemberPaymentStat>()
  friends.forEach(f => stats.set(f.id, { amount: 0, percent: 0 }))

  const total = payments.reduce((s, p) => s + p.amount, 0)
  if (friends.length === 0 || total <= 0) return stats

  const bal: Record<string, number> = {}
  const fairShare: Record<string, number> = {}
  friends.forEach(f => { bal[f.id] = 0; fairShare[f.id] = 0 })

  payments.forEach(p => {
    if (!p.splitAmong.length || p.settled) return
    bal[p.paidById] = (bal[p.paidById] ?? 0) + p.amount
    p.splitAmong.forEach(id => {
      const pct = p.splitPercentages?.[id] ?? (100 / p.splitAmong.length)
      const portion = p.amount * pct / 100
      bal[id] = (bal[id] ?? 0) - portion
      fairShare[id] = (fairShare[id] ?? 0) + portion
    })
  })

  const allTxs = computeSettlements(friends, payments, [])
  const txByKey = new Map(allTxs.map(t => [`${t.from}→${t.to}`, t.amount]))

  for (const key of settledPairs) {
    const amt = txByKey.get(key) ?? 0
    if (amt <= 0) continue
    const [from, to] = key.split('→')
    bal[from] = (bal[from] ?? 0) + amt
    bal[to] = (bal[to] ?? 0) - amt
  }

  for (const f of friends) {
    const share = fairShare[f.id] ?? 0
    const balance = bal[f.id] ?? 0
    const amount = Math.round((share + balance) * 100) / 100
    const percent = Math.round((amount / total) * 1000) / 10
    stats.set(f.id, { amount, percent })
  }

  return stats
}
