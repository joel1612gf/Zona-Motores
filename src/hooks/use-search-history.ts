'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase';

const MAX_HISTORY_LENGTH = 5;

export function useSearchHistory() {
    const { user } = useUser();
    const [history, setHistory] = useState<string[]>([]);
    const storageKey = user ? `search_history_${user.uid}` : null;

    useEffect(() => {
        if (storageKey) {
            try {
                const storedHistory = localStorage.getItem(storageKey);
                if (storedHistory) {
                    setHistory(JSON.parse(storedHistory));
                } else {
                    setHistory([]);
                }
            } catch (error) {
                console.error("Failed to read search history from localStorage", error);
                setHistory([]);
            }
        } else {
            setHistory([]);
        }
    }, [storageKey]);

    const addSearchTerm = useCallback((term: string) => {
        if (!storageKey || !term.trim()) return;

        setHistory(prevHistory => {
            const newHistory = [
                term,
                ...prevHistory.filter(item => item.toLowerCase() !== term.toLowerCase())
            ].slice(0, MAX_HISTORY_LENGTH);

            try {
                localStorage.setItem(storageKey, JSON.stringify(newHistory));
            } catch (error) {
                console.error("Failed to save search history to localStorage", error);
            }
            
            return newHistory;
        });
    }, [storageKey]);
    
    const clearSearchHistory = useCallback(() => {
        if (!storageKey) return;
        setHistory([]);
        try {
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error("Failed to clear search history from localStorage", error);
        }
    }, [storageKey]);

    return { history, addSearchTerm, clearSearchHistory };
}
