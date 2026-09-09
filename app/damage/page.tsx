import { redirect } from 'next/navigation';

// Canonical damage management lives under /ops/damage. This root path is a legacy alias.
export default function DamageRedirect() {
  redirect('/ops/damage');
}
