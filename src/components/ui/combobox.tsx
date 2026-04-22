"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
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

  // Separate state: what the user is typing to search
  const [searchQuery, setSearchQuery] = React.useState("")

  // Derived: label of the currently selected option (for display when closed)
  const selectedLabel = React.useMemo(() => {
    const selected = options.find((opt) => opt.value === value)
    return selected?.label ?? ""
  }, [value, options])

  // When closed → show the selected label; when open → show what user is typing
  const inputDisplayValue = open ? searchQuery : selectedLabel

  // Filter options only when user is actively searching
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options
    const search = searchQuery.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(search))
  }, [options, searchQuery])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Clear search when dropdown closes so next open shows all options
      setSearchQuery("")
    }
  }

  const handleFocus = () => {
    // Reset search so ALL options are visible when user clicks in
    setSearchQuery("")
    setOpen(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (!open) setOpen(true)

    if (val === "") {
      // User cleared the input — clear the selection
      onChange("")
      return
    }

    // Auto-select on exact case-insensitive match so typing the full name works
    const exactMatch = options.find(
      (opt) => opt.label.toLowerCase() === val.toLowerCase()
    )
    if (exactMatch) {
      onChange(exactMatch.value)
    }
    // While typing partial text, we don't propagate to parent (let user pick from list)
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setSearchQuery("")
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange("")
    setSearchQuery("")
    setOpen(false)
  }

  const handleToggle = () => {
    if (open) {
      setOpen(false)
      setSearchQuery("")
    } else {
      setSearchQuery("")
      setOpen(true)
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <div className="relative group w-full">
            <Input
              placeholder={placeholder}
              value={inputDisplayValue}
              autoComplete="off"
              onChange={handleInputChange}
              onFocus={handleFocus}
              disabled={disabled}
              className="pr-16 h-12 rounded-xl bg-muted/30 border-none focus:bg-background transition-all font-medium"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {value && !disabled && (
                <button
                  type="button"
                  onPointerDown={handleClear}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                  aria-label="Limpiar selección"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                onPointerDown={(e) => { e.preventDefault(); handleToggle(); }}
                disabled={disabled}
                aria-label="Abrir lista"
              >
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </button>
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="p-0 border border-border/40 shadow-2xl rounded-xl overflow-hidden bg-background"
          // Correct CSS variable for PopoverAnchor (not PopoverTrigger)
          style={{ width: "var(--radix-popover-anchor-width)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          align="start"
          sideOffset={5}
        >
          <ScrollArea className={cn("h-64", filteredOptions.length === 0 && "h-auto")}>
            <div className="flex flex-col p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "w-full flex items-center h-11 px-4 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer outline-none select-none",
                      value === option.value
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                    // onPointerDown fires before blur, ensuring the click registers
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(option.value)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </div>
                ))
              ) : (
                <div className="py-10 px-4 text-center">
                  <p className="text-sm text-muted-foreground font-medium">
                    {notFoundMessage}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}
