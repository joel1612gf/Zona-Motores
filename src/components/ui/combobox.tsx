"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "./input"
import { ScrollArea } from "./scroll-area"

interface ComboboxProps {
  options: { label: string; value: string }[]
  value?: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  notFoundMessage: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  notFoundMessage,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {value
            ? options.find((option) => option.value.toLowerCase() === value.toLowerCase())?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <div className="p-2">
            <Input 
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                autoFocus
            />
        </div>
        <ScrollArea className="h-48">
            <div className="flex flex-col p-1">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                    <Button
                        key={option.value}
                        variant="ghost"
                        className={cn("w-full justify-start", value === option.value && "font-bold")}
                        onClick={() => {
                            onChange(option.value)
                            setOpen(false)
                            setSearchValue("")
                        }}
                    >
                        <Check
                        className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                        )}
                        />
                        {option.label}
                    </Button>
                    ))
                ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">{notFoundMessage}</p>
                )}
            </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
