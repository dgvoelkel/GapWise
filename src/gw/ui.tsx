import {
  createElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
} from "react"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "plain" | "primary" | "secondary"
  size?: "normal" | "small" | "icon"
}

export function Button({
  variant = "plain",
  size = "normal",
  className = "",
  ...props
}: ButtonProps) {
  return createElement("button", {
    ...props,
    type: props.type ?? "button",
    className: `gw-button gw-button--${variant} gw-button--${size} ${className}`,
  })
}

export function Heading({
  as = "h2",
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" }) {
  return createElement(as, props)
}

export function RangeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return createElement("input", {
    ...props,
    type: "range",
    className: `gw-range ${props.className ?? ""}`,
  })
}
