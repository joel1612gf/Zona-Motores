import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = 'image/jpeg' } = body as {
      imageBase64: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const prompt = `Analiza esta factura de compra y extrae la información en formato JSON.
Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta, sin markdown ni texto adicional:
{
  "numero_factura": "string o null",
  "proveedor": "nombre del proveedor en la factura o null",
  "items": [
    {
      "nombre": "nombre del producto",
      "codigo": "código o referencia del producto, o null",
      "cantidad": número,
      "costo_unitario_usd": número en dólares (si está en bolívares, intenta convertir o pon null),
      "aplica_iva": boolean
    }
  ]
}
Si no puedes determinar un valor con certeza, usa null. Los items deben ser solo productos/repuestos, no descuentos ni subtotales.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      prompt,
    ]);

    const rawText = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const cleaned = jsonMatch ? jsonMatch[1] : rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'No se pudo interpretar la factura. Intenta con una imagen más clara.' },
        { status: 422 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[parse-invoice] Error:', error);
    return NextResponse.json(
      { error: 'Error procesando la factura.' },
      { status: 500 }
    );
  }
}
