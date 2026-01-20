'use server';

/**
 * @fileOverview A flow that summarizes a vehicle listing using generative AI.
 *
 * - summarizeVehicleListing - A function that summarizes a vehicle listing.
 * - SummarizeVehicleListingInput - The input type for the summarizeVehicleListing function.
 * - SummarizeVehicleListingOutput - The return type for the summarizeVehicleListing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeVehicleListingInputSchema = z.object({
  make: z.string().describe('The make of the vehicle (e.g., Toyota)'),
  model: z.string().describe('The model of the vehicle (e.g., Corolla)'),
  year: z.number().describe('The year the vehicle was manufactured'),
  trim: z.string().optional().describe('The trim level of the vehicle (e.g., LE, XLE)'),
  mileage: z.number().describe('The mileage of the vehicle'),
  bodyType: z.string().describe('The body type of the vehicle (e.g., Sedan, SUV, Truck)'),
  exteriorColor: z.string().describe('The exterior color of the vehicle'),
  interiorColor: z.string().describe('The interior color of the vehicle'),
  features: z.array(z.string()).describe('An array of key features of the vehicle'),
  description: z.string().describe('A free-text description of the vehicle from the seller'),
  referenceListing: z.string().optional().describe('A reference listing URL for a similar vehicle to guide the summarization.'),
});
export type SummarizeVehicleListingInput = z.infer<typeof SummarizeVehicleListingInputSchema>;

const SummarizeVehicleListingOutputSchema = z.object({
  summary: z.string().describe('A concise and engaging summary of the vehicle listing.'),
});
export type SummarizeVehicleListingOutput = z.infer<typeof SummarizeVehicleListingOutputSchema>;

export async function summarizeVehicleListing(input: SummarizeVehicleListingInput): Promise<SummarizeVehicleListingOutput> {
  return summarizeVehicleListingFlow(input);
}

const summarizeVehicleListingPrompt = ai.definePrompt({
  name: 'summarizeVehicleListingPrompt',
  input: {schema: SummarizeVehicleListingInputSchema},
  output: {schema: SummarizeVehicleListingOutputSchema},
  prompt: `You are an expert at writing compelling vehicle listing summaries.

  Given the following details about a vehicle, create a concise and engaging summary that will attract potential buyers. The summary should highlight the key features and benefits of the vehicle.

  Make: {{{make}}}
  Model: {{{model}}}
  Year: {{{year}}}
  Trim: {{{trim}}}
  Mileage: {{{mileage}}}
  Body Type: {{{bodyType}}}
  Exterior Color: {{{exteriorColor}}}
  Interior Color: {{{interiorColor}}}
  Features: {{#each features}}{{{this}}}, {{/each}}
  Description: {{{description}}}
  {{#if referenceListing}}
  Reference Listing: {{{referenceListing}}}
  Use this reference listing to guide the summarization, particularly in terms of highlighting comparable features and benefits.
  {{/if}}

  Write a summary of no more than 150 words.
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
