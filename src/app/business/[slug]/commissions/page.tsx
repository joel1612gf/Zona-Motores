import { CommissionsDashboard } from '@/components/business/commissions-dashboard';

export default async function CommissionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  return <CommissionsDashboard slug={slug} />;
}
