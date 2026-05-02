type Props = {
  variant?: "banner" | "empty";
  className?: string;
};

const MESSAGE = "The IOSoccer API is currently unreachable. Please try again in a few minutes.";

export default function ApiUnavailableNotice({ variant = "banner", className = "" }: Props) {
  if (variant === "empty") {
    return (
      <div className={`text-center py-16 text-chalk-400 font-body ${className}`}>
        {MESSAGE}
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 mb-6 text-sm font-body text-amber-100 ${className}`}
    >
      {MESSAGE}
    </div>
  );
}
