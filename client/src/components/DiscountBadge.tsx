import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DiscountBadgeProps {
  discount: number;
}

export default function DiscountBadge({ discount }: DiscountBadgeProps) {
  const isDiscount = discount < 0;
  
  return (
    <Badge
      variant={isDiscount ? "default" : "secondary"}
      className={`gap-1 ${isDiscount ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
      data-testid="badge-discount"
    >
      {isDiscount ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUp className="h-3 w-3" />
      )}
      <span className="font-semibold">{Math.abs(discount).toFixed(1)}%</span>
    </Badge>
  );
}
