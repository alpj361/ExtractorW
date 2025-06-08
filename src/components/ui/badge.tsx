import React from "react"

const cn = (...inputs: any[]) => {
  return inputs.filter(Boolean).join(' ')
}

const badgeVariants = {
  default: "bg-gray-900 text-gray-50 hover:bg-gray-900/80",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-100/80",
  destructive: "bg-red-500 text-red-50 hover:bg-red-500/80",
  outline: "text-gray-950 border border-gray-200 bg-white hover:bg-gray-100",
}

const Badge = React.forwardRef((props: any, ref: any) => {
  const { className, variant = "default", ...otherProps } = props;
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2",
        badgeVariants[variant as keyof typeof badgeVariants],
        className
      )}
      {...otherProps}
    />
  )
});
Badge.displayName = "Badge"

export { Badge, badgeVariants } 