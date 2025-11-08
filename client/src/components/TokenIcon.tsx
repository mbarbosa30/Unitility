interface TokenIconProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
}

export default function TokenIcon({ symbol, size = "md" }: TokenIconProps) {
  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-12 w-12 text-lg",
  };

  // Generate a color based on the token symbol
  const getColor = (str: string) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    const index = str.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div
      className={`${sizeClasses[size]} ${getColor(symbol)} flex items-center justify-center rounded-full font-semibold text-white`}
      data-testid={`icon-token-${symbol.toLowerCase()}`}
    >
      {symbol.charAt(0)}
    </div>
  );
}
