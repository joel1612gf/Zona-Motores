'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';

export type MakesAndModels = {
  [make: string]: string[];
};

export type MakesByType = {
  [type: string]: MakesAndModels;
};

type MakesContextType = {
  makesByType: MakesByType | null;
  isLoading: boolean;
};

// Example data as a fallback if the Firestore document doesn't exist.
// This structure is now categorized by vehicle type.
const fallbackData: MakesByType = {
  Carro: {
    Toyota: ['Corolla', 'Hilux', 'Land Cruiser', 'Machito', 'Autana', 'Roraima', 'Merú', 'Prado', '4Runner', 'Fortuner', 'Yaris', 'Belta', 'Camry', 'Tercel', 'Starlet', 'Sky', 'Baby Camry', 'Sapito', 'Pantallita', 'Araya', 'Celica', 'Supra', 'Previa', 'FJ Cruiser', 'Dyna', 'Coaster', 'Etios', 'Raize', 'Corolla Cross', 'Stout'],
    Chevrolet: ['Aveo', 'Optra', 'Spark', 'Cruze', 'Corsa', 'Chevy', 'Astra', 'Cavalier', 'Celebrity', 'Malibu', 'Caprice', 'Silverado', 'Cheyenne', 'Grand Blazer', 'Tahoe', 'Suburban', 'Trailblazer', 'Blazer', 'Luv D-Max', 'Grand Vitara', 'Jimny', 'Vitara', 'Swift', 'Esteem', 'Captiva', 'Onix', 'Groove', 'Montana', 'Colorado', 'Orlando', 'Epica', 'Zafira', 'Kodiak', 'N200', 'N300', 'C3500', 'C10', 'C30', 'S10'],
    Ford: ['Fiesta', 'EcoSport', 'Explorer', 'F-150', 'Fortaleza', 'Triton', 'F-350', 'Super Duty', 'Mustang', 'Focus', 'Laser', 'Festiva', 'Ka', 'Fusion', 'Escape', 'Ranger', 'Bronco', 'Sierra', 'Del Rey', 'Corcel', 'Fairlane', 'Zephyr', 'Conquistador', 'Maverick', 'Falcon', 'F-100', 'Territory', 'Edge', 'Expedition'],
    Mitsubishi: ['Lancer', 'Montero', 'Dakar', 'Sport', 'Montero Limited', 'Signo', 'MF', 'MS', 'MX', 'Galant', 'Eclipse', 'Outlander', 'ASX', 'L200', 'Sportero', 'Panel L300', 'Canter', 'Mirage', 'Space Wagon', 'Expo'],
    Hyundai: ['Accent', 'Getz', 'Elantra', 'Tucson', 'Santa Fe', 'Matrix', 'Atos', 'Excel', 'Sonata', 'Stellar', 'Pony', 'Tiburon', 'Genesis', 'H1', 'H100', 'Starex', 'Creta', 'Grand i10', 'Venue', 'Azera', 'Kona', 'Palisade'],
    Kia: ['Rio', 'Picanto', 'Sportage', 'Sorento', 'Cerato', 'Pregio', 'Carnival', 'Carens', 'K2700', 'Besta', 'Sephia', 'Spectra', 'Mohave', 'Stinger', 'Sonet', 'Seltos', 'Soluto', 'K5'],
    Honda: ['Civic', 'Accord', 'CR-V', 'Fit', 'City', 'HR-V', 'Pilot', 'Odyssey', 'Ridgeline', 'Legend', 'Prelude', 'Integra', 'Stream'],
    Nissan: ['Sentra', 'Tiida', 'Frontier', 'Pathfinder', 'Patrol', 'X-Terra', 'X-Trail', 'Murano', 'Almera', 'B13', 'AD Wagon', '350Z', '370Z', 'Altima', 'Maxima', 'Qashqai', 'Versa', 'Kicks', 'Navara', 'Urvan'],
    Jeep: ['CJ-5', 'CJ-7', 'Wrangler', 'Cherokee', 'Grand Cherokee', 'Wagoneer', 'Gladiator', 'Comanche', 'Renegade', 'Compass', 'Liberty', 'Commander', 'Patriot'],
    Fiat: ['Uno', 'Palio', 'Siena', 'Strada', 'Fiorino', '147', 'Premio', 'Ritmo', 'Regatta', 'Tempra', 'Marea', 'Idea', 'Punto', 'Stilo', 'Mobi', 'Cronos', 'Pulse', 'Fastback', 'Argos', 'Ducato', 'Spazio', 'Tucan'],
    Renault: ['Twingo', 'Clio', 'Logan', 'Sandero', 'Stepway', 'Megane', 'Scenic', 'Laguna', 'Kangoo', 'Duster', 'Oroch', 'Koleos', 'Fluence', 'Symbol', 'R19', 'R21', 'R18', 'R11', 'R12', 'R5', 'Fuego', 'Kwid'],
    Volkswagen: ['Beetle', 'Escarabajo', 'Gol', 'Fox', 'SpaceFox', 'CrossFox', 'Golf', 'Jetta', 'Bora', 'Passat', 'Amarok', 'Tiguan', 'Polo', 'Virtus', 'Nivus', 'Taos', 'T-Cross', 'Parati', 'Saveiro', 'Kombi', 'Transporter', 'Vento', 'Santana'],
    Mazda: ['3', '6', 'Allegro', '626', '323', 'BT-50', 'B2000', 'B2200', 'B2600', 'MX-5', 'Miata', 'CX-5', 'CX-7', 'CX-9', 'CX-30', 'CX-60', 'Demio', 'MPV'],
    Suzuki: ['Swift', 'Jimny', 'Vitara', 'Grand Vitara', 'Baleno', 'Samurai', 'Carry', 'Alto', 'Forsa', 'Sidekick', 'Ignis', 'Ciaz', 'S-Cross', 'Ertiga'],
    Subaru: ['Impreza', 'WRX', 'Forester', 'Outback', 'Legacy', 'XV', 'Crosstrek', 'Vivio', 'Loyale'],
    Peugeot: ['206', '207', '208', '307', '308', '405', '406', '407', '408', '508', '2008', '3008', '5008', 'Partner', 'Expert'],
    Isuzu: ['Trooper', 'LUV', 'Rodeo', 'Amigo', 'Pickup', 'NPR', 'NKR', 'NHR', 'FVR', 'FTR', 'D-Max'],
    Daewoo: ['Lanos', 'Nubira', 'Leganza', 'Cielo', 'Matiz', 'Tico', 'Damas', 'Labo', 'Tacuma', 'Espero', 'Racer'],
    Chery: ['Arauca', 'Orinoco', 'Tiggo', 'Tiggo 2', 'Tiggo 3', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8', 'QQ', 'Cowin', 'Grand Tiger', 'H5'],
    Changan: ['Alsvin', 'Hunter', 'CS15', 'CS35', 'CS55', 'CS75', 'CS85', 'CS95', 'Uni-T', 'Uni-K', 'Benni', 'Star', 'M90'],
    JAC: ['Arena', 'S2', 'S3', 'S5', 'T6', 'T8', 'T9', 'Sunray', 'HFC 1040', 'HFC 1042', 'J2', 'J3', 'J4'],
    Dongfeng: ['S50', 'SX5', 'SX6', 'T5L', 'Rich 6', 'Captain', 'Duolika', 'Aeolus', 'Nano Box'],
    GreatWall: ['Wingle 5', 'Wingle 7', 'Poer', 'Haval H3', 'Haval H5', 'Haval H6', 'Haval Jolion', 'Deer', 'Safe'],
    Baic: ['X25', 'X35', 'X55', 'BJ40', 'BJ80', 'D20'],
    Geely: ['Coolray', 'Azkarra', 'Emgrand', 'GX3', 'Okavango', 'CK', 'MK'],
    Venirauto: ['Turpial', 'Centauro'],
    Saipa: ['Saina', 'Quik', 'Tiba'],
    Ikco: ['Tara', 'Dena', 'Soren', 'Samand'],
    Jetour: ['X70', 'X70 Plus', 'X90 Plus', 'Dashing'],
    Foton: ['Tunland', 'View', 'Ollin', 'Aumark', 'Gratour'],
    MG: ['ZS', 'HS', 'GT', 'MG3', 'MG5', 'MG6', 'RX5', 'RX8'],
    BYD: ['F3', 'F0', 'Yuan', 'Yuan Plus', 'Tang', 'Han', 'Song', 'Dolphin', 'Seal'],
    BMW: ['Serie 1', 'Serie 3', 'Serie 5', 'Serie 7', 'X1', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z3', 'Z4', 'M3', 'M5', 'i3', 'iX'],
    MercedesBenz: ['Clase A', 'Clase B', 'Clase C', 'Clase E', 'Clase S', 'Clase G', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'ML', 'Sprinter', 'Vito', 'SLK', 'CLK'],
    Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8', 'E-Tron'],
    Porsche: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan', 'Boxster', 'Cayman'],
    LandRover: ['Range Rover', 'Range Rover Sport', 'Range Rover Evoque', 'Velar', 'Discovery', 'Defender', 'Freelander'],
    Volvo: ['S40', 'S60', 'S80', 'S90', 'XC40', 'XC60', 'XC90', 'V40', 'C30'],
    Mini: ['Cooper', 'Countryman', 'Clubman', 'Paceman'],
    Seat: ['Ibiza', 'Leon', 'Cordoba', 'Toledo', 'Altea', 'Inca'],
    Skoda: ['Octavia', 'Fabia', 'Felicia', 'Superb'],
    Citroen: ['C3', 'C4', 'C5', 'Berlingo', 'Jumper', 'Xantia', 'Xsara', 'ZX'],
    Dodge: ['Ram', 'Dakota', 'Durango', 'Dart', 'Neon', 'Caliber', 'Journey', 'Coronet', 'Aspen', 'Spirit'],
    Chrysler: ['Neon', 'Stratus', 'LeBaron', 'Sebring', '300C', 'Town & Country', 'Voyager', 'New Yorker'],   
    GAC: ['GS3', 'GS4', 'GS8', 'GA4', 'GN8', 'Emkoo'],    
    Maxus: ['T60', 'T90', 'G10', 'V80', 'D60'],    
    Kaiyi: ['X3', 'X3 Pro', 'X7'],    
    Bestune: ['T33', 'T77', 'T99', 'B70'],   
    Riddara: ['RD6'],  
    Zotye: ['Nomada', 'Hunter', 'Z100'],    
    Lada: ['Niva', 'Samara', '2105', '2107', 'Priora', 'Kalina'],
  },
  Camioneta: {
    Toyota: ['Fortuner', 'Land Cruiser', '4Runner', 'RAV4'],
    Mitsubishi: ['L200'],
    Jeep: ['Grand Cherokee', 'Wrangler', 'Cherokee'],
    Ford: ['Explorer', 'F-150', 'Bronco', 'Escape'],
    Chevrolet: ['Silverado', 'Tahoe', 'Trailblazer'],
  },
  Moto: {
    Kawasaki: ['Ninja 400', 'KLR 650', 'Versys', 'mamameelpipe'],
    Yamaha: ['R6', 'MT-03', 'XT660'],
    Honda: ['CBR600', 'Africa Twin'],
    Suzuki: ['V-Strom 650', 'DR-650'],
    KTM: ['Duke 200', '390 Adventure'],
    Benelli: ['TRK 502', 'Leoncino 500'],
  },
};

const MakesContext = createContext<MakesContextType | undefined>(undefined);

export function MakesProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();

  const makesDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'vehicle_meta', 'makes_and_models');
  }, [firestore]);

  const { data: fetchedData, isLoading, error } = useDoc<{ makesByType: MakesByType }>(makesDocRef);

  if (error) {
      console.error("Error fetching vehicle makes and models:", error);
  }

  const makesByType = useMemo(() => {
    if (isLoading) {
      return null;
    }
    if (fetchedData?.makesByType) {
      return fetchedData.makesByType;
    }
    return fallbackData;

  }, [fetchedData, isLoading]);


  const value = useMemo(() => ({ makesByType, isLoading }), [makesByType, isLoading]);

  return (
    <MakesContext.Provider value={value}>
      {children}
    </MakesContext.Provider>
  );
}

export function useMakes() {
  const context = useContext(MakesContext);
  if (context === undefined) {
    throw new Error('useMakes must be used within a MakesProvider');
  }
  return context;
}
