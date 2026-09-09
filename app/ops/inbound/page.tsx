import { redirect } from 'next/navigation';

// Consolidated into the GRN receiving flow (/ops/receiving).
export default function InboundRedirect() {
  redirect('/ops/receiving');
}
