import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-xs font-medium whitespace-nowrap transition-all duration-150 outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 [a]:hover:bg-primary/90',
        outline:
          'border-border/80 bg-card/80 text-foreground hover:bg-muted/70 hover:border-border hover:text-foreground shadow-xs dark:bg-card/40 dark:hover:bg-muted/60',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-xs',
        ghost:
          'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        destructive:
          'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/15 dark:hover:bg-destructive/25',
        link: 'text-primary underline-offset-4 hover:underline shadow-none h-auto p-0',
      },
      size: {
        default: 'h-9 gap-2 px-3.5 text-xs',
        xs: 'h-6 gap-1 rounded-md px-2 text-[11px] [&_svg:not([class*=\'size-\'])]:size-3',
        sm: 'h-8 gap-1.5 rounded-md px-2.5 text-xs [&_svg:not([class*=\'size-\'])]:size-3.5',
        lg: 'h-10 gap-2 rounded-xl px-4 text-sm [&_svg:not([class*=\'size-\'])]:size-4',
        icon: 'size-9 rounded-lg',
        'icon-xs': 'size-6 rounded-md [&_svg:not([class*=\'size-\'])]:size-3',
        'icon-sm': 'size-8 rounded-lg [&_svg:not([class*=\'size-\'])]:size-3.5',
        'icon-lg': 'size-10 rounded-xl [&_svg:not([class*=\'size-\'])]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
