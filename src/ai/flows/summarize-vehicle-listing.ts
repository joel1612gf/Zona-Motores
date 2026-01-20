'use server';

/**
 * @fileOverview Un flujo que resume un anuncio de vehículo usando IA generativa.
 *
 * - summarizeVehicleListing - Una función que resume un anuncio de vehículo.
 * - SummarizeVehicleListingInput - El tipo de entrada para la función summarizeVehicleListing.
 * - SummarizeVehicleListingOutput - El tipo de retorno para la función summarizeVehicleListing.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeVehicleListingInputSchema = z.object({
  make: z.string().describe('La marca del vehículo (ej: Toyota)'),
  model: z.string().describe('El modelo del vehículo (ej: Corolla)'),
  year: z.number().describe('El año de fabricación del vehículo'),
  trim: z.string().optional().describe('El nivel de equipamiento del vehículo (ej: LE, XLE)'),
  mileage: z.number().describe('El kilometraje del vehículo'),
  bodyType: z.string().describe('El tipo de carrocería del vehículo (ej: Sedan, SUV, Camioneta)'),
  exteriorColor: z.string().describe('El color exterior del vehículo'),
  interiorColor: z.string().describe('El color interior del vehículo'),
  features: z.array(z.string()).describe('Un arreglo de características clave del vehículo'),
  description: z.string().describe('Una descripción de texto libre del vehículo por parte del vendedor'),
  referenceListing: z.string().optional().describe('Una URL de un anuncio de referencia para un vehículo similar para guiar el resumen.'),
});
export type SummarizeVehicleListingInput = z.infer<typeof SummarizeVehicleListingInputSchema>;

const SummarizeVehicleListingOutputSchema = z.object({
  summary: z.string().describe('Un resumen conciso y atractivo del anuncio del vehículo.'),
});
export type SummarizeVehicleListingOutput = z.infer<typeof SummarizeVehicleListingOutputSchema>;

export async function summarizeVehicleListing(input: SummarizeVehicleListingInput): Promise<SummarizeVehicleListingOutput> {
  return summarizeVehicleListingFlow(input);
}

const summarizeVehicleListingPrompt = ai.definePrompt({
  name: 'summarizeVehicleListingPrompt',
  input: {schema: SummarizeVehicleListingInputSchema},
  output: {schema: SummarizeVehicleListingOutputSchema},
  prompt: `Eres un experto en escribir resúmenes atractivos para anuncios de vehículos. Tu respuesta debe ser en español.

  Dados los siguientes detalles sobre un vehículo, crea un resumen conciso y atractivo que atraiga a compradores potenciales. El resumen debe resaltar las características y beneficios clave del vehículo.

  Marca: {{{make}}}
  Modelo: {{{model}}}
  Año: {{{year}}}
  Versión: {{{trim}}}
  Kilometraje: {{{mileage}}}
  Tipo de Carrocería: {{{bodyType}}}
  Color Exterior: {{{exteriorColor}}}
  Color Interior: {{{interiorColor}}}
  Características: {{#each features}}{{{this}}}, {{/each}}
  Descripción: {{{description}}}
  {{#if referenceListing}}
  Anuncio de Referencia: {{{referenceListing}}}
  Usa este anuncio de referencia para guiar el resumen, particularmente en términos de resaltar características y beneficios comparables.
  {{/if}}

  Escribe un resumen de no más de 150 palabras. El resumen debe estar en español.
  `,
});

const summarizeVehicleListingFlow = ai.defineFlow(
  {
    name: 'summarizeVehicleListingFlow',
    inputSchema: SummarizeVehicleListingInputSchema,
    outputSchema: SummarizeVehicleListingOutputSchema,
  },
  async input => {
    const {output} = await summarizeVehicleListingPrompt(input);
    return output!;
  }
);
