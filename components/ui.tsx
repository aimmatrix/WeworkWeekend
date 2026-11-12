import Link from "next/link"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"

const primaryClass =
  "flex h-14 w-full items-center justify-center bg-[#16140f] px-4 text-lg text-[#f3efe6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16140f] disabled:opacity-40"
const secondaryClass =
  "flex h-14 w-full items-center justify-center border border-[#16140f] bg-[#fffdf8] px-4 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16140f] disabled:opacity-40"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary"
}

export function Button({ tone = "primary", className = "", type = "button", ...props }: ButtonProps) {
  const toneClass = tone === "primary" ? primaryClass : secondaryClass
  return <button type={type} className={`${toneClass} ${className}`} {...props} />
}

export function PrimaryLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${primaryClass} ${className}`}>
      {children}
    </Link>
  )
}

export function SecondaryLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${secondaryClass} ${className}`}>
      {children}
    </Link>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function Field({ label, id, name, className = "", ...props }: FieldProps) {
  const fieldId = id ?? name
  return (
    <label className={`block ${className}`} htmlFor={fieldId}>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{label}</span>
      <input
        id={fieldId}
        name={name}
        className="mt-2 h-14 w-full border border-[#16140f] bg-[#fffdf8] px-3 text-lg outline-none focus:bg-white"
        {...props}
      />
    </label>
  )
}
