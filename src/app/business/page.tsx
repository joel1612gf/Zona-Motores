'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Package,
  Handshake,
  LineChart,
  CheckCircle2,
  Gauge,
  Globe,
  AtSign,
  Youtube,
  ChevronRight
} from 'lucide-react';

export default function BusinessLandingPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    business: '',
    message: 'Estoy interesado en sus servicios'
  });

  const handleWhatsApp = () => {
    const phone = "584221756187";
    const text = `Hola Zona Motores Business, mi nombre es ${formData.name}.
Email: ${formData.email}
Negocio: ${formData.business}
${formData.message}`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');
  };

  return (
    <div className="bg-background text-foreground font-body selection:bg-primary/20 selection:text-primary overflow-x-hidden">

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-2xl shadow-sm border-b border-border">
        <div className="flex justify-between items-center px-6 md:px-16 py-4 max-w-full">
          <div className="text-xl font-bold tracking-tighter text-foreground">
            Zona Motores <span className="text-primary">Business</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#product" className="font-medium text-sm tracking-tight text-primary border-b-2 border-primary transition-all duration-300">
              Producto
            </Link>
            <Link href="#features" className="font-medium text-sm tracking-tight text-muted-foreground hover:scale-105 hover:text-primary transition-all duration-300">
              Características
            </Link>
            <Link href="#contact" className="font-medium text-sm tracking-tight text-muted-foreground hover:scale-105 hover:text-primary transition-all duration-300">
              Contacto
            </Link>
          </div>

          <div className="flex items-center">
            <button className="bg-gradient-to-br from-primary to-blue-700 text-primary-foreground px-6 py-2.5 rounded-full font-medium text-sm hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-primary/20">
              Empezar
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-24">
        {/* Hero Section */}
        <section id="product" className="relative min-h-[90vh] flex items-center px-6 md:px-16 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full max-w-7xl mx-auto">
            <div className="lg:col-span-7 space-y-8 z-10">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-widest uppercase">
                Sistema Premium para Concesionarios
              </div>
              <h1 className="text-5xl md:text-[5rem] leading-[1.05] font-extrabold tracking-tighter text-foreground">
                Gestiona tu <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-700">concesionario</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed font-light">
                Eleva tu negocio automotriz con un software profesional. Inventario preciso, descripciones con IA y datos en tiempo real al alcance de tu mano.
              </p>

              <div className="flex flex-wrap gap-4 pt-4">
                <button className="bg-gradient-to-br from-primary to-blue-700 text-primary-foreground px-8 py-4 rounded-full font-bold text-base hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-primary/20">
                  Comienza ahora
                  <ArrowRight className="w-5 h-5" />
                </button>
                <Link href="#contact" className="bg-card border border-border text-foreground px-8 py-4 rounded-full font-bold text-base hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">
                  Agendar Demo
                </Link>
              </div>
            </div>

            {/* Asymmetric Decorative Hero Element */}
            <div className="lg:col-span-5 relative hidden lg:block">
              <div className="relative z-10 p-4 bg-muted rounded-[2rem] shadow-2xl border border-border">
                <img
                  alt="Showroom de lujo"
                  className="rounded-xl object-cover aspect-[4/5] w-full"
                  src="https://i.ibb.co/zh5R7F0m/Generated-Image-March-26-2026-6-55-PM.jpg"
                />
                <div className="absolute bottom-10 left-[-2rem] bg-background/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl max-w-[240px] border border-border z-20">
                  <p className="text-[0.6875rem] font-bold text-primary uppercase tracking-widest mb-2">Inventario en Vivo</p>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold tracking-tighter">142</span>
                    <span className="text-sm text-green-500 font-medium pb-1">+12% esta semana</span>
                  </div>
                </div>
              </div>
              {/* Background Glow */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px] -z-10"></div>
            </div>
          </div>
        </section>

        {/* Why Use Our System: Bento Grid */}
        <section id="features" className="py-24 md:py-32 px-6 md:px-16 bg-muted/50 border-y border-border">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20 space-y-4">
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tighter uppercase text-muted-foreground">¿Por qué elegir Zona Motores Business?</h2>
              <p className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">Sistema elaborado a la medida para concesionarios.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
              {/* Feature 1: Inventory */}
              <div className="md:col-span-3 bg-card border border-border p-10 rounded-[2rem] flex flex-col justify-between hover:scale-[1.01] transition-transform duration-500 shadow-sm">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Gestión Profesional de Inventario</h3>
                  <p className="text-muted-foreground leading-relaxed">Control absoluto sobre cada unidad de tu stock. Organización impecable y búsqueda instantánea para que siempre tengas la respuesta correcta para tu cliente.</p>
                </div>
              </div>

              {/* Feature 2: Consignment System */}
              <div className="md:col-span-3 bg-card border border-border p-10 rounded-[2rem] flex flex-col justify-between hover:scale-[1.01] transition-transform duration-500 shadow-sm relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
                    <Handshake className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Sistema Integrado de Consignaciones</h3>
                  <p className="text-muted-foreground leading-relaxed">No pierdas ventas por falta de stock físico. Si no tienes el vehículo que te piden, nuestro sistema te ayuda a gestionarlo y conseguirlo para cerrar el trato.</p>
                </div>
              </div>

              {/* Feature 3: Web Integration */}
              <div className="md:col-span-2 bg-card border border-border p-10 rounded-[2rem] flex flex-col justify-between hover:scale-[1.01] transition-transform duration-500 shadow-sm text-center md:text-left">
                <div className="space-y-6">
                  <div className="w-14 h-14 mx-auto md:mx-0 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Integración con el Marketplace</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">Tus vehículos se publican automáticamente en nuestra web principal. Máxima visibilidad ante miles de compradores en toda Venezuela.</p>
                </div>
              </div>

              {/* Feature 4: Analytics & Reports */}
              <div className="md:col-span-4 bg-gradient-to-br from-primary to-blue-800 p-10 rounded-[2rem] flex flex-col md:flex-row items-center justify-between text-white hover:scale-[1.01] transition-transform duration-500 shadow-xl shadow-primary/20 relative overflow-hidden">
                <div className="space-y-6 md:max-w-md relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    <LineChart className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold tracking-tight">Informes y Datos en Tiempo Real</h3>
                  <p className="text-blue-100/90 leading-relaxed">Conoce rápidamente los precios del mercado para tasar con precisión. Generamos informes estratégicos que te brindan la claridad necesaria para hacer crecer tu negocio.</p>
                </div>
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 bg-white/10 rounded-full blur-[80px]"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features in Action: Visual Mockups */}
        <section className="py-24 md:py-32 px-6 md:px-16 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20 md:mb-24 max-w-3xl mx-auto space-y-6">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground">Herramientas diseñadas para el showroom moderno.</h2>
              <p className="text-lg text-muted-foreground">Hemos reemplazado las hojas de cálculo desordenadas por una interfaz que fluye con tu negocio.</p>
            </div>

            {/* Showcase Layout */}
            <div className="space-y-24 md:space-y-32">

              {/* Dashboard Mockup */}
              <div className="flex flex-col lg:flex-row items-center gap-12 md:gap-20">
                <div className="lg:w-1/2 space-y-8">
                  <div className="text-primary font-bold text-sm tracking-[0.2em] uppercase">El Centro de Mando</div>
                  <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Control en tiempo real.</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">Nuestro panel principal te brinda control total. Visualiza datos, operaciones pendientes y el estado de tu inventario en una perfectamente diseñada.</p>

                  <ul className="space-y-4">
                    <li className="flex items-center gap-3 text-foreground font-medium">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                      Calendario de eventos y citas
                    </li>
                    <li className="flex items-center gap-3 text-foreground font-medium">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                      Gestión de personal y roles
                    </li>
                  </ul>
                </div>

                <div className="lg:w-1/2 w-full">
                  <div className="bg-card/50 backdrop-blur-xl rounded-[2.5rem] p-4 md:p-8 shadow-2xl border border-border relative">
                    <div className="bg-muted rounded-xl bg-opacity-80 overflow-hidden aspect-video shadow-inner">
                      <img
                        alt="Dashboard Visual"
                        className="w-full h-full object-cover"
                        src="https://i.ibb.co/ccrf86Bm/Generated-Image-March-26-2026-7-16-PM.jpg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory Mockup */}
              <div className="flex flex-col lg:flex-row-reverse items-center gap-12 md:gap-20">
                <div className="lg:w-1/2 space-y-8">
                  <div className="text-accent font-bold text-sm tracking-[0.2em] uppercase">Stock Visual</div>
                  <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Vende en cualquier momento.</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">Administrar tu stock online desde cualquier dispositivo.</p>

                  <div className="bg-card border border-border p-6 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Gauge className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">El más rápido del mercado</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Publicación Optimizada</p>
                    </div>
                  </div>
                </div>

                <div className="lg:w-1/2 w-full">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted aspect-[3/4] rounded-3xl overflow-hidden shadow-lg relative group">
                      <img
                        alt="Item de Inventario"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        src="https://i.ibb.co/dswdPFhn/471162591-18475249933050064-3236233258478312925-n.jpg"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                      <div className="absolute bottom-6 left-4 right-4 text-white">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80">4Runner 2026</p>
                        <p className="text-xl font-bold">$90,000</p>
                      </div>
                    </div>

                    <div className="mt-12 bg-muted aspect-[3/4] rounded-3xl overflow-hidden shadow-lg relative group">
                      <img
                        alt="Item de Inventario"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        src="https://i.ibb.co/99y9VnFY/Generated-Image-March-26-2026-7-41-PM.jpg"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                      <div className="absolute bottom-6 left-4 right-4 text-white">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Jeep Wrangler 2022</p>
                        <p className="text-xl font-bold">$75,000</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Lead Generation: CTA Section */}
        <section id="contact" className="py-24 md:py-32 px-6 md:px-16 bg-slate-950 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] md:w-[800px] h-[500px] md:h-[800px] bg-primary/20 rounded-full blur-[100px] md:blur-[160px] translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 md:gap-20 items-center">
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-tight">¿Listo para transformar tu negocio?</h2>
                <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-lg">
                  Únete a la red de concesionarios que usan Zona Motores Business para escalar sus operaciones y redefinir la experiencia de ventas.
                </p>
                <div className="flex items-center gap-8 py-8 border-y border-white/10">
                  <div>
                    <p className="text-3xl md:text-4xl font-bold">20+</p>
                    <p className="text-xs md:text-sm uppercase tracking-widest text-slate-500 font-bold mt-1">Concesionarios</p>
                  </div>
                  <div className="w-px h-12 bg-white/10"></div>
                  <div>
                    <p className="text-3xl md:text-4xl font-bold">Autos</p>
                    <p className="text-xs md:text-sm uppercase tracking-widest text-slate-500 font-bold mt-1">Gestionados Diariamente</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl text-white">
                <h3 className="text-2xl font-bold tracking-tight mb-8">Contacta a Nuestro Equipo</h3>
                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Juan Pérez"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Correo Electrónico</label>
                      <input
                        type="email"
                        placeholder="juan@concesionario.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Nombre del Negocio</label>
                    <input
                      type="text"
                      placeholder="Motors Pro CA"
                      value={formData.business}
                      onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-slate-400">Mensaje (Opcional)</label>
                    <textarea
                      placeholder="Estoy interesado en sus servicios"
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/50 transition-all outline-none resize-none"
                    ></textarea>
                  </div>
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="w-full bg-gradient-to-br from-primary to-blue-700 text-white font-bold py-4 rounded-full shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Enviar Consulta
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 px-6 md:px-16 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 w-full mb-12">

            <div className="md:col-span-2 space-y-6">
              <div className="text-xl font-black text-foreground">
                Zona Motores <span className="text-primary">Business</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                Redefiniendo el estándar de la gestión automotriz mediante diseño cinético e integración de inteligencia artificial.
              </p>
            </div>

            <div className="space-y-4">
              <p className="font-body text-xs uppercase tracking-widest font-bold text-primary">Plataforma</p>
              <ul className="space-y-3">
                <li><Link href="#product" className="text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-primary transition-colors">Características</Link></li>
                <li><Link href="#contact" className="text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-primary transition-colors">Solicitar Demo</Link></li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="font-body text-xs uppercase tracking-widest font-bold text-primary">Legal</p>
              <ul className="space-y-3">
                <li><Link href="#" className="text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-primary transition-colors">Políticas de Privacidad</Link></li>
                <li><Link href="#" className="text-xs uppercase tracking-widest font-semibold text-muted-foreground hover:text-primary transition-colors">Términos del Servicio</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-body text-xs uppercase tracking-widest font-semibold text-muted-foreground">
              © {new Date().getFullYear()} Zona Motores Business. Todos los derechos reservados.
            </p>
            <div className="flex gap-6">
              <a href="https://zonamotores.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><Globe className="w-5 h-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><AtSign className="w-5 h-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Youtube className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
