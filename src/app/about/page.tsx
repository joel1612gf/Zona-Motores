import { Car, Target, Eye, Heart, MapPin, Users, ShieldCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function AboutPage() {
    return (
        <div className="container max-w-4xl py-12 md:py-20">
            <div className="flex items-center gap-3 mb-2">
                <Car className="h-8 w-8 text-primary" />
                <h1 className="font-headline text-3xl md:text-4xl font-bold">Sobre Zona Motores</h1>
            </div>
            <p className="text-muted-foreground text-lg mb-10">Conectamos compradores y vendedores de vehículos en toda Venezuela.</p>

            <div className="space-y-10">
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold">¿Quiénes somos?</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        Zona Motores es una plataforma digital de clasificados vehiculares diseñada para el mercado venezolano. <strong>No somos un concesionario ni un intermediario de ventas</strong> — somos el punto de encuentro digital donde personas y concesionarios pueden publicar sus vehículos en venta, y donde compradores interesados pueden encontrar su próximo carro de manera fácil, rápida y segura.
                    </p>
                    <p className="text-muted-foreground leading-relaxed mt-3">
                        Nacimos con la convicción de que comprar y vender vehículos en Venezuela debería ser una experiencia moderna, transparente y accesible para todos. Nuestra plataforma ofrece herramientas avanzadas de búsqueda, filtros por ubicación, promoción de anuncios y un sistema de planes que se adapta a las necesidades de cada usuario.
                    </p>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold">Nuestra Misión</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        Facilitar la compra y venta de vehículos en Venezuela proporcionando una plataforma digital confiable, eficiente y fácil de usar que conecte directamente a compradores y vendedores, eliminando barreras y creando un mercado automotriz más transparente y accesible.
                    </p>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Eye className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold">Nuestra Visión</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        Ser la plataforma líder y referencia del mercado automotriz digital en Venezuela, reconocida por la calidad de nuestro servicio, la innovación tecnológica y la confianza que generamos en nuestra comunidad de usuarios.
                    </p>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Heart className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold">Nuestros Valores</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="rounded-lg border p-4 bg-card">
                            <h3 className="font-semibold mb-1">Transparencia</h3>
                            <p className="text-sm text-muted-foreground">Promovemos la honestidad en cada publicación y en cada interacción entre nuestros usuarios.</p>
                        </div>
                        <div className="rounded-lg border p-4 bg-card">
                            <h3 className="font-semibold mb-1">Innovación</h3>
                            <p className="text-sm text-muted-foreground">Usamos tecnología de punta para ofrecer la mejor experiencia de búsqueda y publicación de vehículos.</p>
                        </div>
                        <div className="rounded-lg border p-4 bg-card">
                            <h3 className="font-semibold mb-1">Accesibilidad</h3>
                            <p className="text-sm text-muted-foreground">Nuestra plataforma está diseñada para ser intuitiva y accesible para todos, sin importar su nivel tecnológico.</p>
                        </div>
                        <div className="rounded-lg border p-4 bg-card">
                            <h3 className="font-semibold mb-1">Comunidad</h3>
                            <p className="text-sm text-muted-foreground">Creemos en construir una comunidad automotriz activa, respetuosa y colaborativa en Venezuela.</p>
                        </div>
                    </div>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold">¿Dónde operamos?</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        Zona Motores opera a nivel nacional en toda Venezuela. Nuestra plataforma permite publicar y buscar vehículos en cualquier estado del país, con filtros y un mapa interactivo que facilita encontrar vehículos cerca de ti.
                    </p>
                </section>

                <Separator />

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="font-headline text-xl font-semibold">Compromiso con la seguridad</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                        Implementamos un sistema de mantenimiento automático que mantiene la plataforma limpia y actualizada: los anuncios inactivos son pausados automáticamente y eventualmente eliminados, asegurando que los compradores siempre encuentren ofertas reales y vigentes. Además, contamos con herramientas de verificación y moderación para proteger a nuestra comunidad.
                    </p>
                </section>
            </div>
        </div>
    );
}
