import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { vehicleType, make, model, year } = await request.json();

    if (!make || !model || !year) {
      return NextResponse.json(
        { error: 'Se requieren make, model y year' },
        { status: 400 }
      );
    }

    const model_ai = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Eres un experto en vehículos del mercado venezolano. Para el siguiente vehículo (${vehicleType || 'Carro'}), proporciona datos técnicos reales y precisos.

Vehículo: ${year} ${make} ${model}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "engine": "descripción del motor (ej: 1.8L 4 cilindros, 140 HP)",
  "bodyType": "tipo de carrocería en español (Sedán, SUV, Pickup, Hatchback, Coupé, Van, Camioneta)",
  "transmission": "Automática o Sincrónica",
  "is4x4": true/false,
  "doorCount": "2 o 4",
  "description": "descripción breve del vehículo en español para una publicación de venta, máximo 3 oraciones"
}

IMPORTANTE:
- En Venezuela "Sincrónica" = transmisión manual
- Sé preciso con las especificaciones del motor para ese año y modelo específico
- La descripción debe ser atractiva para venta en el mercado venezolano`;

    const result = await model_ai.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = text;
    // Better markdown extraction logic using regex matching json block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else if (text.startsWith('```')) {
      jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const data = JSON.parse(jsonStr);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error('[vehicle-ai] JSON parsing error. Raw text:', text);
      return NextResponse.json(
        { error: 'Error al procesar la respuesta de la IA (formato incorrecto)', raw: text },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[vehicle-ai] Error:', error);
    
    let userMessage = error?.message || 'Error interno al procesar la solicitud de IA';
    if (userMessage.includes('leaked') || userMessage.includes('API key not valid')) {
      userMessage = 'Tu API Key de Gemini ha sido revocada o es inválida (filtrada). Por favor, actualiza GEMINI_API_KEY en .env.local';
    } else if (userMessage.includes('404')) {
      userMessage = 'El modelo de IA solicitado no está disponible. Verifica tu API Key o prueba con otro modelo.';
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
