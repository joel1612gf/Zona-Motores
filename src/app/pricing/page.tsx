import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="container max-w-4xl mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="font-headline text-4xl font-bold">Estimación de Costos Mensuales</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Zona Motores está construida sobre una arquitectura moderna que es increíblemente económica para empezar y escala de manera justa con tu crecimiento.
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Resumen: Tu Costo Probable es $0</CardTitle>
            <CardDescription>
              Gracias a los generosos niveles de uso gratuito que ofrecen Google Firebase y Google Cloud, es muy probable que no pagues nada hasta que la página tenga un volumen de tráfico considerable.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
            <p className="font-headline text-5xl font-bold text-green-600 dark:text-green-400">$0 / mes</p>
            <p className="text-green-700 dark:text-green-300 mt-2">Para tráfico bajo a moderado.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desglose de Servicios</CardTitle>
            <CardDescription>
              Estos son los servicios principales que utiliza la aplicación y sus respectivos niveles gratuitos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold font-headline mb-2">Firebase</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Autenticación de Usuarios:</span> Gratis hasta 10,000 usuarios activos al mes. Más que suficiente para construir una comunidad grande.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Base de Datos (Firestore):</span> El plan gratuito incluye 50,000 lecturas y 20,000 escrituras de documentos por día, además de 1 GiB de almacenamiento. Esto soporta miles de visitas y publicaciones diarias sin costo.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Almacenamiento de Fotos (Storage):</span> Gratis para los primeros 5 GiB de almacenamiento, 1 GB de descargas al día y 20,000 subidas al mes. La compresión de imágenes que implementamos ayuda a que este espacio rinda mucho.
                  </div>
                </li>
              </ul>
            </div>
            <hr/>
            <div>
              <h3 className="text-xl font-semibold font-headline mb-2">Google Maps Platform</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Crédito Mensual de $200:</span> Google Maps proporciona un crédito recurrente de $200 cada mes. Esto equivale a aproximadamente 28,000 cargas de mapa dinámico mensuales, por lo que es muy improbable que superes este límite.
                  </div>
                </li>
              </ul>
            </div>
             <hr/>
            <div>
              <h3 className="text-xl font-semibold font-headline mb-2">Inteligencia Artificial (Genkit)</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Generación de Descripciones:</span> El costo es por uso. Dado que esta función se utiliza solo al crear/editar un anuncio, el gasto inicial es prácticamente nulo y crecerá de manera muy predecible. Los modelos de Google AI suelen tener un nivel gratuito generoso para empezar.
                  </div>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10">
           <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle/>
              ¿Cuándo empezarías a pagar?
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-400">
              Solo incurrirás en costos si tu página web crece exponencialmente y supera los generosos límites gratuitos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              El modelo de "pago por uso" significa que la plataforma está lista para escalar. Si tu sitio se vuelve un éxito masivo con cientos de miles de visitas, los costos aumentarán, pero siempre en proporción al tráfico. Esto es un buen problema a tener, ya que significa que tu negocio está creciendo. La arquitectura está diseñada para ser eficiente y mantener los costos lo más bajos posible, incluso a gran escala.
            </p>
            <a href="https://firebase.google.com/pricing" target="_blank" rel="noopener noreferrer" className="text-sm mt-4 inline-flex items-center gap-2 text-primary hover:underline">
              Ver precios detallados de Firebase <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
