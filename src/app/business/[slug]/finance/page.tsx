'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useBusinessAuth } from '@/context/business-auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Receipt, FileText, ArrowUpDown, Wallet2, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { ExpenseWizard } from '@/components/business/expense-wizard';
import { FiscalNoteDialog } from '@/components/business/fiscal-note-dialog';
import { FinanceHistoryTable } from '@/components/business/finance-history-table';

export default function FinancePage() {
  const { slug } = useParams();
  const { concesionario } = useBusinessAuth();
  const [showExpenseWizard, setShowExpenseWizard] = useState(false);
  const [fiscalNote, setFiscalNote] = useState<{ open: boolean, type: 'DEBIT' | 'CREDIT' }>({ open: false, type: 'DEBIT' });

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
              <Wallet2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión Financiera</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Control de egresos, notas fiscales y retenciones SENIAT
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => setFiscalNote({ open: true, type: 'DEBIT' })}
            className="flex-1 md:flex-none rounded-2xl h-12 px-6 border-primary/20 hover:bg-primary/5 gap-2 font-bold"
          >
            <ArrowUpCircle className="h-5 w-5 text-primary" /> Nota Débito
          </Button>
          <Button
            variant="outline"
            onClick={() => setFiscalNote({ open: true, type: 'CREDIT' })}
            className="flex-1 md:flex-none rounded-2xl h-12 px-6 border-emerald-500/20 hover:bg-emerald-500/5 gap-2 font-bold"
          >
            <ArrowDownCircle className="h-5 w-5 text-emerald-500" /> Nota Crédito
          </Button>
          <Button
            onClick={() => setShowExpenseWizard(true)}
            className="flex-1 md:flex-none rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold"
          >
            <Plus className="h-5 w-5" /> Registrar Gasto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="bg-muted/50 p-1 gap-1 mb-8 rounded-2xl h-auto md:h-14 border backdrop-blur-sm flex flex-col md:flex-row w-full overflow-hidden">
          <TabsTrigger value="expenses" className="flex-1 rounded-xl h-12 md:h-full gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold w-full md:w-auto">
            <TrendingDown className="h-4 w-4" /> Gastos
          </TabsTrigger>
          <TabsTrigger value="debit" className="flex-1 rounded-xl h-12 md:h-full gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold w-full md:w-auto">
            <ArrowUpDown className="h-4 w-4" /> Notas de Débito
          </TabsTrigger>
          <TabsTrigger value="credit" className="flex-1 rounded-xl h-12 md:h-full gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold w-full md:w-auto">
            <Receipt className="h-4 w-4" /> Notas de Crédito
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-6">
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-headline">Historial de Gastos</CardTitle>
              <CardDescription>Visualice y gestione los gastos operativos del negocio</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <FinanceHistoryTable type="EXPENSE" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debit">
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-headline text-primary flex items-center gap-3">
                <ArrowUpCircle className="h-6 w-6" /> Notas de Débito
              </CardTitle>
              <CardDescription>Incrementos en obligaciones por pagar a proveedores</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <FinanceHistoryTable type="DEBIT" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit">
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-headline text-emerald-600 flex items-center gap-3">
                <ArrowDownCircle className="h-6 w-6" /> Notas de Crédito
              </CardTitle>
              <CardDescription>Disminuciones en obligaciones por pagar (devoluciones/ajustes)</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <FinanceHistoryTable type="CREDIT" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showExpenseWizard && (
        <ExpenseWizard
          open={showExpenseWizard}
          onOpenChange={setShowExpenseWizard}
        />
      )}

      {fiscalNote.open && (
        <FiscalNoteDialog
          open={fiscalNote.open}
          onOpenChange={(open) => setFiscalNote(prev => ({ ...prev, open }))}
          type={fiscalNote.type}
        />
      )}
    </div>
  );
}
