import React from "react"

const cn = (...inputs: any[]) => {
  return inputs.filter(Boolean).join(' ')
}

const Card = React.forwardRef((props: any, ref: any) => {
  const { className, ...otherProps } = props;
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-white text-gray-900 shadow-sm",
        className
      )}
      {...otherProps}
    />
  );
});
Card.displayName = "Card"

const CardHeader = React.forwardRef((props: any, ref: any) => {
  const { className, ...otherProps } = props;
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...otherProps}
    />
  );
});
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef((props: any, ref: any) => {
  const { className, ...otherProps } = props;
  return (
    <h3
      ref={ref}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...otherProps}
    />
  );
});
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef((props: any, ref: any) => {
  const { className, ...otherProps } = props;
  return (
    <p
      ref={ref}
      className={cn("text-sm text-gray-600", className)}
      {...otherProps}
    />
  );
});
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef((props: any, ref: any) => {
  const { className, ...otherProps } = props;
  return (
    <div 
      ref={ref} 
      className={cn("p-6 pt-0", className)} 
      {...otherProps} 
    />
  );
});
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef((props: any, ref: any) => {
  const { className, ...otherProps } = props;
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...otherProps}
    />
  );
});
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } 