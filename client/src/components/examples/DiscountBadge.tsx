import DiscountBadge from '../DiscountBadge';

export default function DiscountBadgeExample() {
  return (
    <div className="flex items-center gap-4 p-4">
      <DiscountBadge discount={-12.3} />
      <DiscountBadge discount={0.2} />
      <DiscountBadge discount={-5.1} />
    </div>
  );
}
