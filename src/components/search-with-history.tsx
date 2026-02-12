'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { useSearchHistory } from '@/hooks/use-search-history';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

interface SearchWithHistoryProps {
    initialValue?: string;
    onSearch: (term: string) => void;
    className?: string;
    inputClassName?: string;
    buttonClassName?: string;
}

export function SearchWithHistory({
    initialValue = '',
    onSearch,
    className,
    inputClassName,
    buttonClassName,
}: SearchWithHistoryProps) {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState(initialValue);
    const { history, addSearchTerm, clearSearchHistory } = useSearchHistory();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Sync state if initial value changes (e.g. from URL param)
        if (initialValue !== searchTerm) {
            setSearchTerm(initialValue);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialValue]);

    const handleSearch = (term: string) => {
        const trimmedTerm = term.trim();
        if (!trimmedTerm) return;
        if (user) {
            addSearchTerm(trimmedTerm);
        }
        onSearch(trimmedTerm);
        setIsPopoverOpen(false);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleSearch(searchTerm);
        inputRef.current?.blur();
    };

    const handleHistoryClick = (term: string) => {
        setSearchTerm(term);
        handleSearch(term);
    };

    return (
        <Popover open={isPopoverOpen && history.length > 0} onOpenChange={setIsPopoverOpen}>
            <PopoverAnchor asChild>
                 <form 
                    onSubmit={handleSubmit} 
                    className={cn(
                        "relative w-full rounded-full bg-card shadow-lg",
                        isPopoverOpen && history.length > 0 && "rounded-b-none",
                        className
                    )}
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                    <Input
                        ref={inputRef}
                        name="search"
                        type="search"
                        placeholder="Busca por marca, modelo o palabra clave..."
                        className={cn(
                            "w-full truncate bg-transparent p-2 pl-10 pr-[6.5rem] text-foreground h-12 text-base border-none focus-visible:ring-0",
                            inputClassName
                        )}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsPopoverOpen(true)}
                        autoComplete="off"
                    />
                    <Button type="submit" size="lg" variant="secondary" className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-9 shadow-md", buttonClassName)}>
                        Buscar
                    </Button>
                </form>
            </PopoverAnchor>
            <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0 bg-card border-none shadow-lg rounded-t-none rounded-b-2xl"
                onOpenAutoFocus={(e) => e.preventDefault()}
                sideOffset={-1}
                align="center"
            >
                {history.length > 0 && (
                    <div className="flex flex-col">
                        <div className="flex justify-between items-center px-4 py-2 border-b">
                            <h4 className="font-medium text-sm">Búsquedas Recientes</h4>
                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={clearSearchHistory}>Limpiar</Button>
                        </div>
                        <div className="p-1 max-h-60 overflow-y-auto">
                            {history.map((item, index) => (
                                <button
                                    key={index}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent"
                                    onClick={() => handleHistoryClick(item)}
                                >
                                    <History className="h-4 w-4 text-muted-foreground"/>
                                    <span>{item}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
