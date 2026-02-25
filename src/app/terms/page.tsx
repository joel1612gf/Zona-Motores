import { Car, Scale, FileText, Users, ShieldAlert, AlertTriangle, Ban, Gavel, UserCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function TermsPage() {
    return (
        <div className="container max-w-4xl py-12 md:py-20">
            <div className="flex items-center gap-3 mb-2">
                <Scale className="h-8 w-8 text-primary" />
                <h1 className="font-headline text-3xl md:text-4xl font-bold">Términos y Condiciones</h1>
            </div>
            <p className="text-muted-foreground mb-10">Última actualización: Febrero 2026</p>

            <div className="prose dark:prose-invert max-w-none space-y-8">
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">1. Descripción del Servicio</h2>
                    </div>
                    <p>
                        Zona Motores es una plataforma digital de clasificados vehiculares que opera en Venezuela. Nuestro servicio consiste exclusivamente en proporcionar un espacio en línea donde usuarios particulares y concesionarios pueden publicar anuncios de vehículos en venta, y donde compradores potenciales pueden buscar y contactar a los vendedores directamente.
                    </p>
                    <p>
                        <strong>Zona Motores NO es un concesionario, intermediario, corredor, ni agente de ventas.</strong> No participamos, mediamos ni intervenimos en ninguna transacción de compraventa entre usuarios.
                    </p>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">2. Limitación de Responsabilidad</h2>
                    </div>
                    <p>
                        Zona Motores <strong>no se responsabiliza</strong> de:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>La veracidad, exactitud o actualidad de la información publicada en los anuncios, incluyendo precio, kilometraje, estado mecánico, documentación legal o cualquier otro dato proporcionado por el vendedor.</li>
                        <li>El estado real, mecánico, legal o documental de los vehículos publicados.</li>
                        <li>Cualquier disputa, fraude, estafa, daño o perjuicio que surja de las transacciones realizadas entre usuarios fuera de la plataforma.</li>
                        <li>La conducta de los usuarios dentro o fuera de la plataforma.</li>
                        <li>Pérdidas económicas derivadas del uso de la plataforma.</li>
                    </ul>
                    <p className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                        <strong>⚠️ Importante:</strong> Toda transacción de compraventa se realiza bajo la exclusiva responsabilidad de las partes involucradas (comprador y vendedor). Recomendamos encarecidamente verificar personalmente toda la documentación del vehículo y realizar inspecciones mecánicas antes de concretar cualquier compra.
                    </p>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <UserCheck className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">3. Responsabilidades del Usuario</h2>
                    </div>
                    <p>Al utilizar Zona Motores, el usuario se compromete a:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Proporcionar información veraz, precisa y actualizada en sus publicaciones.</li>
                        <li>Ser el propietario legítimo del vehículo publicado o contar con la autorización legal del propietario para venderlo.</li>
                        <li>No publicar contenido fraudulento, engañoso, ofensivo, ilegal o que infrinja derechos de terceros.</li>
                        <li>No utilizar la plataforma para actividades ilícitas de ningún tipo.</li>
                        <li>Mantener actualizado el estado de sus publicaciones (marcar como vendido cuando corresponda).</li>
                        <li>Respetar a otros usuarios de la plataforma en toda comunicación.</li>
                    </ul>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">4. Contenido y Publicaciones</h2>
                    </div>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Zona Motores se reserva el derecho de eliminar, pausar o modificar cualquier publicación que considere que viola estos términos o las políticas de la plataforma, sin previo aviso ni obligación de justificación.</li>
                        <li>Las publicaciones activas tienen una vigencia máxima de <strong>7 días</strong>, tras los cuales serán pausadas automáticamente. Las publicaciones pausadas que no sean reactivadas serán eliminadas permanentemente tras <strong>14 días</strong> desde su creación.</li>
                        <li>Las fotos e imágenes subidas deben ser del vehículo real que se ofrece en venta. El uso de imágenes genéricas, de stock o de otros vehículos está prohibido.</li>
                        <li>Está prohibida la publicación de vehículos con documentación irregular, robados o con algún impedimento legal para su venta.</li>
                    </ul>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Ban className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">5. Cuentas de Usuario</h2>
                    </div>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Cada persona o entidad puede registrar una única cuenta.</li>
                        <li>El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
                        <li>Zona Motores se reserva el derecho de suspender o eliminar cuentas que violen estos términos, sin previo aviso.</li>
                        <li>Las cuentas de concesionarios están sujetas a verificación y pueden tener requisitos adicionales.</li>
                    </ul>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">6. Planes y Suscripciones</h2>
                    </div>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Los planes de suscripción otorgan beneficios adicionales según el nivel contratado.</li>
                        <li>Los beneficios de cada plan están sujetos a cambios y actualizaciones por parte de Zona Motores.</li>
                        <li>La cancelación de un plan no genera derecho a reembolso del período en curso.</li>
                        <li>Las promociones de vehículos adquiridas mediante el plan tienen una duración limitada y se rigen por las condiciones vigentes al momento de su activación.</li>
                    </ul>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Gavel className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold m-0">7. Disposiciones Generales</h2>
                    </div>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Zona Motores se reserva el derecho de modificar estos términos y condiciones en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación.</li>
                        <li>El uso continuado de la plataforma después de cualquier modificación constituye la aceptación de los nuevos términos.</li>
                        <li>En caso de conflicto, prevalecerán las leyes de la República Bolivariana de Venezuela.</li>
                        <li>Si alguna disposición de estos términos es declarada inválida, las demás disposiciones permanecerán en pleno vigor y efecto.</li>
                    </ul>
                </section>

                <Separator />

                <section className="bg-muted/50 rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        Al utilizar Zona Motores, confirmas que has leído, entendido y aceptado estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguno de estos términos, te pedimos que no utilices la plataforma.
                    </p>
                </section>
            </div>
        </div>
    );
}
