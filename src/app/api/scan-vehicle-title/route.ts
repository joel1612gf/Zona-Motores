import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, vehicleMake, vehicleModel, vehicleYear } = await request.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Se requiere imageBase64 y mimeType' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analiza la siguiente imagen de un título de vehículo venezolano${vehicleMake ? ` (${vehicleYear} ${vehicleMake} ${vehicleModel})` : ''}.

Extrae los siguientes datos del documento y responde ÚNICAMENTE con un JSON válido sin markdown ni backticks:
{
  "cedula_propietario": "cédula del propietario (con letra V- o E- si está disponible)",
  "placa": "placa del vehículo",
  "serial_niv": "número serial NIV o VIN",
  "serial_carroceria": "serial de carrocería",
  "serial_chasis": "serial de chasis",
  "serial_carrozado": "serial de carrozado (puede no existir, pon null)",
  "serial_motor": "serial del motor",
  "clase": "clase del vehículo (Automóvil, Camioneta, etc.)",
  "tipo": "tipo de carrocería (Sedán, SUV, etc.)"
}

Si un campo no se puede leer claramente o no existe en el documento, usa null. Prioriza la precisión — es mejor retornar null que un dato incorrecto.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      prompt,
    ]);

    const text = result.response.text().trim();

    // Parse JSON from response
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Clean nulls to empty strings for form usage
    const raw = JSON.parse(jsonStr);
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      cleaned[k] = (v !== null && v !== undefined) ? String(v) : '';
    }

    return NextResponse.json(cleaned);
  } catch (error: any) {
    console.error('[scan-vehicle-title] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al procesar el título con IA' },
      { status: 500 }
    );
  }
}
