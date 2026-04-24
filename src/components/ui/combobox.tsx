"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { ScrollArea } from "./scroll-area"

interface ComboboxProps {
  options: { label: string; value: string }[]
  value?: string
  onChange: (value: string) => void
  placeholder: string
  notFoundMessage: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  notFoundMessage,
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Current selected object
  const selectedOption = React.useMemo(() =>
    options.find((opt) => opt.value === value),
  [value, options])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearchQuery("")
      }
    }

    // Use mousedown instead of click for faster response
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Close on Escape key
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setSearchQuery("")
        inputRef.current?.blur()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const filteredOptions = React.useMemo(() => {
    const search = searchQuery.toLowerCase().trim()
    if (!search) return options
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(search) ||
      opt.value.toLowerCase().includes(search)
    )
  }, [options, searchQuery])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (!open) setOpen(true)

    if (val === "") {
      onChange("")
      return
    }
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setSearchQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange("")
    setSearchQuery("")
  }

  const handleInputFocus = () => {
    setOpen(true)
    setSearchQuery("")
  }

  // Display value: when open, show search query; when closed, show selected label
  const displayValue = open ? searchQuery : (selectedOption?.label ?? "")

  return (
    <div className={cn("w-full relative", className)} ref={containerRef}>
      {/* Input trigger */}
      <div className={cn(
        "relative group w-full rounded-xl transition-all duration-300",
        open ? "ring-2 ring-primary/20 shadow-lg shadow-primary/5" : ""
      )}>
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
          <Search className="h-4 w-4" />
        </div>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={displayValue}
          autoComplete="off"
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={disabled}
          className={cn(
            "pl-11 pr-16 h-12 rounded-xl bg-muted/30 border-none font-medium transition-all focus:bg-background",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="w-[1px] h-4 bg-border/40 mx-0.5" />
          <button
            type="button"
            className="p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors rounded-lg"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (open) {
                setOpen(false)
                setSearchQuery("")
              } else {
                setOpen(true)
                inputRef.current?.focus()
              }
            }}
            disabled={disabled}
          >
            <ChevronsUpDown className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Dropdown - rendered inline (no portal) to avoid Dialog focus trap conflicts */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-2 p-2 border border-border/40 shadow-2xl rounded-2xl overflow-hidden bg-background/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 z-[200]"
        >
          <ScrollArea className={cn("max-h-[280px]", filteredOptions.length === 0 && "h-auto")}>
            <div className="flex flex-col gap-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    role="button"
                    tabIndex={-1}
                    className={cn(
                      "w-full flex items-center justify-between h-11 px-3 rounded-xl text-sm font-semibold transition-all outline-none select-none text-left cursor-pointer",
                      value === option.value
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "hover:bg-muted text-foreground/70 hover:text-foreground hover:translate-x-1"
                    )}
                    onMouseDown={(e) => {
                      // Prevent focus from shifting away from the container
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(option.value)
                    }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        value === option.value ? "bg-primary-foreground" : "bg-primary/20"
                      )} />
                      <span className="truncate">{option.label}</span>
                    </div>
                    {value === option.value && <Check className="h-4 w-4 shrink-0" />}
                  </div>
                ))
              ) : (
                <div className="py-8 px-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-muted mx-auto flex items-center justify-center">
                    <Search className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">
                    {notFoundMessage}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
