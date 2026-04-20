import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Pricing — Sensebug',
}

export default function PricingPage() {
  redirect('/#pricing')
}
