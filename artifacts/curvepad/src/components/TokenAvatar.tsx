interface TokenAvatarProps {
  name: string;
  symbol: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base",
  xl: "w-24 h-24 text-2xl",
};

function colorFromAddress(str: string): string {
  const colors = [
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-purple-600",
    "from-orange-500 to-amber-600",
    "from-pink-500 to-rose-600",
    "from-blue-500 to-cyan-600",
    "from-lime-500 to-green-600",
    "from-fuchsia-500 to-pink-600",
    "from-yellow-500 to-orange-600",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function TokenAvatar({ name, symbol, imageUrl, size = "md", className = "" }: TokenAvatarProps) {
  const sizeClass = sizes[size];
  const gradient = colorFromAddress(symbol + name);
  const initials = symbol.slice(0, 2).toUpperCase();

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
