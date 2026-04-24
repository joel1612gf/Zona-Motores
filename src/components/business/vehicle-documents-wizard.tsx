import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Printer,
  Download,
  ChevronRight,
  User,
  Check,
  AlertCircle,
  FileSignature
} from 'lucide-react';
import { useBusinessAuth } from '@/context/business-auth-context';
import type { StockVehicle } from '@/lib/business-types';
import { cn } from '@/lib/utils';
import { downloadPdf, printPdf } from '@/lib/download-pdf';
import {
  ContratoCompraVentaPrint,
  ActaRecepcionPrint,
  DeclaracionJuradaPrint
} from './vehicle-document-templates';
import { useToast } from '@/hooks/use-toast';

interface VehicleDocumentsWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: StockVehicle | null;
  onEditLegalData: () => void;
}

const STEPS = ['Opción', 'Vendedor', 'Documentos'];

export function VehicleDocumentsWizardDialog({ open, onOpenChange, vehicle, onEditLegalData }: VehicleDocumentsWizardDialogProps) {
  const { concesionario } = useBusinessAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(0);
  const [sellerNombre, setSellerNombre] = useState('');
  const [sellerCedula, setSellerCedula] = useState('');

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setSellerNombre('');
      setSellerCedula('');
    }
  }, [open]);

  if (!vehicle || !concesionario) return null;

  const handleNextToSeller = () => setStep(1);
  
  const handleNextToDocuments = () => {
    if (!sellerNombre.trim() || !sellerCedula.trim()) {
      toast({ variant: 'destructive', title: 'Faltan datos del vendedor' });
      return;
    }
    setStep(2);
  };

  const handlePrint = async (rootId: string) => {
    await printPdf({ elementId: rootId });
  };

  const handleDownload = async (rootId: string, docName: string) => {
    const filename = `${docName}_${vehicle.info_extra?.placa || vehicle.id}.pdf`;
    await downloadPdf({ elementId: rootId, filename });
  };

  const sellerData = { nombre: sellerNombre, cedula: sellerCedula };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-50/95 backdrop-blur-xl border-slate-200 shadow-2xl p-0 rounded-[2rem]">
        <DialogHeader className="p-6 pb-2 shrink-0 space-y-4 border-b border-slate-200/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold tracking-tight text-slate-700">
              <div className="p-2.5 bg-slate-200 rounded-xl"><FileSignature className="h-5 w-5 text-slate-600" /></div>
              Documentación Legal
            </DialogTitle>
            <Button variant="link" className="text-xs text-slate-400 hover:text-slate-600" onClick={() => { onOpenChange(false); onEditLegalData(); }}>
              Corregir Seriales
            </Button>
          </div>
          
          <div className="relative flex items-center justify-between px-8 pt-2">
            <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-200 -translate-y-1/2 -z-10 rounded-full" />
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-2 relative z-10">
                <div className={cn('flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all duration-500', i < step ? 'bg-slate-600 border-slate-600 text-white scale-90' : i === step ? 'bg-white border-slate-600 text-slate-700 ring-4 ring-slate-200 scale-110' : 'bg-slate-100 border-slate-200 text-slate-400')}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn('text-[10px] font-semibold uppercase tracking-wider', i === step ? 'text-slate-700' : 'text-slate-400')}>{s}</span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200">
                <p className="text-sm text-slate-600 text-center">
                  El vehículo <strong>{vehicle.make} {vehicle.model} ({vehicle.year})</strong> tiene sus datos legales completos. ¿Qué deseas hacer?
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => { onOpenChange(false); onEditLegalData(); }}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all group"
                >
                  <div className="p-4 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
                    <FileText className="h-8 w-8 text-slate-500 group-hover:text-slate-700" />
                  </div>
                  <span className="font-bold text-slate-700">Editar Datos Legales</span>
                  <span className="text-xs text-slate-400 text-center">Modificar placa, seriales o clase</span>
                </button>
                <button
                  onClick={handleNextToSeller}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-slate-600 bg-slate-600 text-white hover:bg-slate-700 transition-all group shadow-md"
                >
                  <div className="p-4 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                    <Printer className="h-8 w-8 text-white" />
                  </div>
                  <span className="font-bold">Generar Documentos</span>
                  <span className="text-xs text-slate-200 text-center">Contrato, Acta y Declaración Jurada</span>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-start gap-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Para generar los documentos de ingreso, necesitamos temporalmente los datos de la persona que entrega el vehículo. Esta información <strong>no se guardará en la base de datos</strong>, solo se utilizará para los PDFs.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" /> Nombre Completo del Vendedor
                  </Label>
                  <Input 
                    value={sellerNombre} 
                    onChange={e => setSellerNombre(e.target.value)} 
                    placeholder="Ej. Juan Pérez"
                    className="h-12 bg-white rounded-xl border-slate-200 focus:ring-slate-400/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" /> C.I. o RIF
                  </Label>
                  <Input 
                    value={sellerCedula} 
                    onChange={e => setSellerCedula(e.target.value)} 
                    placeholder="Ej. V-12345678"
                    className="h-12 bg-white rounded-xl border-slate-200 focus:ring-slate-400/20"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setStep(0)}>Atrás</Button>
                <Button onClick={handleNextToDocuments} className="rounded-xl bg-slate-700 hover:bg-slate-800 gap-2">
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid gap-3">
                {[
                  { id: 'print-contrato', title: 'Contrato de Compra-Venta', desc: 'Documento legal de adquisición del vehículo' },
                  { id: 'print-acta', title: 'Acta de Recepción Física', desc: 'Deslinde de responsabilidades y entrega' },
                  { id: 'print-declaracion', title: 'Declaración Jurada', desc: 'Licitud de fondos y origen del vehículo' }
                ].map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    <div>
                      <h4 className="font-bold text-slate-700">{doc.title}</h4>
                      <p className="text-xs text-slate-400">{doc.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handlePrint(doc.id)} className="h-9 gap-1.5 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50">
                        <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Imprimir</span>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleDownload(doc.id, doc.title.replace(/ /g, '_'))} className="h-9 gap-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                        <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">PDF</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                <Button variant="ghost" onClick={() => setStep(1)}>Atrás</Button>
                <Button onClick={() => onOpenChange(false)} className="rounded-xl bg-slate-700 hover:bg-slate-800">
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Print Roots */}
        <div className="hidden print-root" id="print-contrato">
          <ContratoCompraVentaPrint vehicle={vehicle} concesionario={concesionario} sellerData={sellerData} />
        </div>
        <div className="hidden print-root" id="print-acta">
          <ActaRecepcionPrint vehicle={vehicle} concesionario={concesionario} sellerData={sellerData} />
        </div>
        <div className="hidden print-root" id="print-declaracion">
          <DeclaracionJuradaPrint vehicle={vehicle} concesionario={concesionario} sellerData={sellerData} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
