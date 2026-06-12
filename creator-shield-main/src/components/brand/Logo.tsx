export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* TubeCheck icon: play button + checkmark fused */}
      <div className="relative grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-secondary text-primary-foreground hairline shrink-0">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
          aria-hidden="true"
        >
          {/* Play triangle */}
          <path
            d="M7 5.5L14.5 10L7 14.5V5.5Z"
            fill="currentColor"
            opacity="0.5"
          />
          {/* Checkmark over play */}
          <path
            d="M5 10.5L8.5 14L15 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight">
        Tube<span className="text-primary">Check</span>
      </span>
    </div>
  );
}
