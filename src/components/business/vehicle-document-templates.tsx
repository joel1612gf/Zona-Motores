import React from 'react';
import { StockVehicle, Concesionario } from '@/lib/business-types';

export interface PrintProps {
  vehicle: StockVehicle;
  concesionario: Concesionario;
  sellerData: { nombre: string; cedula: string };
}

function getFormattedDate() {
  return new Date().toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}



export function ContratoCompraVentaPrint({ vehicle, concesionario, sellerData }: PrintProps) {
  const currentDate = getFormattedDate();

  return (
    <div className="print-page w-[210mm] min-h-[297mm] p-[25mm] bg-white text-black mx-auto relative font-serif text-[12pt] leading-[1.8]">

      
      <h1 className="text-center font-bold text-[14pt] mb-12 uppercase tracking-wide">
        Contrato de Compra-Venta de Vehículo
      </h1>
      
      <p className="text-justify mb-8">
        Entre <strong>{sellerData.nombre.toUpperCase()}</strong>, de nacionalidad venezolana, mayor de edad, civilmente hábil y titular de la Cédula de Identidad Nro. <strong>{sellerData.cedula}</strong>, por una parte quien en lo sucesivo y a los efectos de este contrato se denominará <strong>EL VENDEDOR</strong>, y por la otra parte la sociedad mercantil <strong>{concesionario.nombre_empresa}</strong>, inscrita con el RIF <strong>{concesionario.rif}</strong>, domiciliada en {concesionario.direccion}, quien en adelante se denominará <strong>EL COMPRADOR</strong>, se ha convenido en celebrar el presente Contrato de Compra-Venta, el cual se rige por las siguientes cláusulas:
      </p>

      <p className="text-justify mb-8">
        <strong>PRIMERA:</strong> EL VENDEDOR declara ser el único y legítimo propietario de un vehículo automotor con las siguientes características:
        Marca: <strong>{vehicle.make}</strong>, Modelo: <strong>{vehicle.model}</strong>, Año: <strong>{vehicle.year}</strong>, Color: <strong>{vehicle.exteriorColor}</strong>, 
        Clase: <strong>{vehicle.info_extra?.clase || 'N/A'}</strong>, Tipo: <strong>{vehicle.info_extra?.tipo || 'N/A'}</strong>, 
        Placas: <strong>{vehicle.info_extra?.placa || 'N/A'}</strong>, Serial de Carrocería: <strong>{vehicle.info_extra?.serial_carroceria || 'N/A'}</strong>, 
        y Serial de Motor: <strong>{vehicle.info_extra?.serial_motor || 'N/A'}</strong>.
      </p>

      <p className="text-justify mb-8">
        <strong>SEGUNDA:</strong> EL VENDEDOR da en venta, pura y simple, perfecta e irrevocable a EL COMPRADOR, el vehículo descrito en la cláusula anterior.
      </p>

      <p className="text-justify mb-8">
        <strong>TERCERA:</strong> EL VENDEDOR declara que el vehículo objeto de esta venta se encuentra libre de todo gravamen, multas o reserva de dominio, respondiendo en todo caso por el saneamiento de Ley.
      </p>

      <p className="text-justify mb-8">
        <strong>CUARTA:</strong> EL COMPRADOR declara que recibe el vehículo en las condiciones en que se encuentra, habiéndolo revisado a su entera satisfacción, eximiendo a EL VENDEDOR de vicios ocultos posteriores a esta fecha.
      </p>

      <p className="text-justify mb-8">
        Se hacen dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de {concesionario.direccion?.split(',')[0] || 'Venezuela'}, a los {currentDate}.
      </p>

      <div className="flex justify-between items-end mt-12 px-8 text-center">
        <div className="w-[40%] flex flex-col items-center">
          <div className="w-full border-t border-black mb-2"></div>
          <strong className="text-[11pt]">EL VENDEDOR</strong>
          <span className="text-[11pt]">{sellerData.nombre.toUpperCase()}</span>
          <span className="text-[11pt]">C.I: {sellerData.cedula}</span>
        </div>
        <div className="w-[40%] flex flex-col items-center">
          <div className="w-full border-t border-black mb-2"></div>
          <strong className="text-[11pt]">EL COMPRADOR</strong>
          <span className="text-[11pt]">{concesionario.nombre_empresa}</span>
          <span className="text-[11pt]">RIF: {concesionario.rif}</span>
        </div>
      </div>
    </div>
  );
}

export function ActaRecepcionPrint({ vehicle, concesionario, sellerData }: PrintProps) {
  const currentDate = getFormattedDate();

  return (
    <div className="print-page w-[210mm] min-h-[297mm] p-[25mm] bg-white text-black mx-auto relative font-serif text-[12pt] leading-[1.8]">


      <h1 className="text-center font-bold text-[14pt] mb-12 uppercase tracking-wide">
        Acta de Recepción Física y Deslinde de Responsabilidad
      </h1>
      
      <p className="text-justify mb-8">
        Quien suscribe, <strong>{sellerData.nombre.toUpperCase()}</strong>, titular de la Cédula de Identidad Nro. <strong>{sellerData.cedula}</strong>, actuando en este acto por sus propios derechos, hace entrega formal, material y jurídica a la empresa <strong>{concesionario.nombre_empresa}</strong> (RIF: {concesionario.rif}), del vehículo automotor cuyas características se detallan a continuación:
      </p>

      <div className="mx-12 mb-8 p-6 border border-black/20 bg-slate-50/30">
        <ul className="list-none space-y-2 font-medium">
          <li><span className="inline-block w-48 font-bold">Marca:</span> {vehicle.make}</li>
          <li><span className="inline-block w-48 font-bold">Modelo:</span> {vehicle.model}</li>
          <li><span className="inline-block w-48 font-bold">Año:</span> {vehicle.year}</li>
          <li><span className="inline-block w-48 font-bold">Placas:</span> {vehicle.info_extra?.placa || 'N/A'}</li>
          <li><span className="inline-block w-48 font-bold">Serial de Carrocería:</span> {vehicle.info_extra?.serial_carroceria || 'N/A'}</li>
          <li><span className="inline-block w-48 font-bold">Serial de Motor:</span> {vehicle.info_extra?.serial_motor || 'N/A'}</li>
        </ul>
      </div>

      <p className="text-justify mb-8">
        Mediante el presente documento, el declarante asume total y absoluta responsabilidad civil, penal y administrativa por cualquier acto, hecho, infracción o accidente de tránsito en el que se hubiere visto involucrado el vehículo antes identificado, hasta la fecha y hora de la firma de este documento.
      </p>

      <p className="text-justify mb-8">
        De igual manera, <strong>{concesionario.nombre_empresa}</strong> declara recibir el vehículo descrito a su entera satisfacción, asumiendo la responsabilidad sobre el mismo a partir de este momento.
      </p>

      <p className="text-justify mb-8">
        En {concesionario.direccion?.split(',')[0] || 'Venezuela'}, a los {currentDate}.
      </p>

      <div className="flex justify-between items-end mt-12 px-8 text-center">
        <div className="w-[40%] flex flex-col items-center">
          <div className="w-full border-t border-black mb-2"></div>
          <strong className="text-[11pt]">QUIEN ENTREGA</strong>
          <span className="text-[11pt]">{sellerData.nombre.toUpperCase()}</span>
          <span className="text-[11pt]">C.I: {sellerData.cedula}</span>
        </div>
        <div className="w-[40%] flex flex-col items-center">
          <div className="w-full border-t border-black mb-2"></div>
          <strong className="text-[11pt]">QUIEN RECIBE</strong>
          <span className="text-[11pt]">{concesionario.nombre_empresa}</span>
          <span className="text-[11pt]">RIF: {concesionario.rif}</span>
        </div>
      </div>
    </div>
  );
}

export function DeclaracionJuradaPrint({ vehicle, concesionario, sellerData }: PrintProps) {
  const currentDate = getFormattedDate();

  return (
    <div className="print-page w-[210mm] min-h-[297mm] p-[25mm] bg-white text-black mx-auto relative font-serif text-[12pt] leading-[1.8]">


      <h1 className="text-center font-bold text-[14pt] mb-12 uppercase tracking-wide">
        Declaración Jurada de Licitud de Fondos y Origen del Vehículo
      </h1>
      
      <p className="text-justify mb-8">
        Yo, <strong>{sellerData.nombre.toUpperCase()}</strong>, de nacionalidad venezolana, mayor de edad, titular de la Cédula de Identidad Nro. <strong>{sellerData.cedula}</strong>, actuando en mi propio nombre y derecho, declaro bajo fe de juramento y en pleno conocimiento de las disposiciones legales aplicables en la República Bolivariana de Venezuela, lo siguiente:
      </p>

      <p className="text-justify mb-8">
        <strong>PRIMERO:</strong> Que soy propietario legítimo del vehículo marca <strong>{vehicle.make}</strong>, modelo <strong>{vehicle.model}</strong>, año <strong>{vehicle.year}</strong>, Placas <strong>{vehicle.info_extra?.placa || 'N/A'}</strong>, Serial de Carrocería <strong>{vehicle.info_extra?.serial_carroceria || 'N/A'}</strong>.
      </p>

      <p className="text-justify mb-8">
        <strong>SEGUNDO:</strong> Que los recursos con los cuales fue adquirido originalmente dicho vehículo, así como el vehículo en sí mismo, provienen de actividades lícitas y de mi trabajo honesto, no teniendo vinculación alguna con actividades tipificadas en la Ley Orgánica Contra la Delincuencia Organizada y Financiamiento al Terrorismo, ni con la Ley Orgánica de Drogas.
      </p>

      <p className="text-justify mb-8">
        <strong>TERCERO:</strong> Que eximo a la empresa <strong>{concesionario.nombre_empresa}</strong>, inscrita con el RIF <strong>{concesionario.rif}</strong>, de cualquier responsabilidad solidaria o derivada que pudiera generarse por la falsedad o inexactitud de esta declaración, asumiendo frente a terceros y frente a las autoridades competentes, la responsabilidad exclusiva sobre la procedencia del vehículo objeto de la presente venta.
      </p>

      <p className="text-justify mb-8">
        Declaración que hago en la ciudad de {concesionario.direccion?.split(',')[0] || 'Venezuela'}, a los {currentDate}.
      </p>

      <div className="flex justify-center mt-12 text-center">
        <div className="w-[50%] flex flex-col items-center">
          <div className="w-full border-t border-black mb-2"></div>
          <strong className="text-[11pt]">EL DECLARANTE</strong>
          <span className="text-[11pt]">{sellerData.nombre.toUpperCase()}</span>
          <span className="text-[11pt]">C.I: {sellerData.cedula}</span>
        </div>
      </div>
    </div>
  );
}
