/**
 * Legacy redirect: /business/[slug]/finance/payables → /business/[slug]/payables
 * The canonical CXP module lives at /payables (linked from the sidebar).
 */
import { redirect } from 'next/navigation';

export default async function LegacyPayablesRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/business/${slug}/payables`);
}
