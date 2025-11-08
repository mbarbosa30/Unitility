import StatCard from '../StatCard';
import { TrendingUp, Zap, DollarSign } from 'lucide-react';

export default function StatCardExample() {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-3">
      <StatCard title="Total ETH" value="20.1" subtitle="+12% from last week" icon={DollarSign} trend="up" />
      <StatCard title="Total Fees" value="9,729" subtitle="Across all pools" icon={Zap} />
      <StatCard title="Avg APY" value="14.2%" subtitle="+2.1% this month" icon={TrendingUp} trend="up" />
    </div>
  );
}
