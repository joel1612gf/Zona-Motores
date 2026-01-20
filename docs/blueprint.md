# **App Name**: Motores Zone

## Core Features:

- Vehicle Listing: Allow users to create and manage vehicle listings with detailed information, images, and pricing in USD.
- Currency Conversion: Display vehicle prices in both USD and VES (Bolivares) using the official BCV exchange rate, updated regularly. Provide a tool to display and control this process
- Advanced Search and Filters: Enable users to search and filter vehicles by make, model, year, price range, location, and other criteria.
- Location-Based Search: Allow users to find vehicles near their current location using the browser's geolocation API. Limit results using database proximity.
- Seller Verification: Implement a system for verifying sellers through phone number (via WhatsApp API) to increase trust and security.
- Image Compression: Compress images on the client-side before uploading to Supabase to reduce bandwidth usage and improve upload speeds, crucial in areas with limited connectivity. Reduce a 12MP photo (5MB) to a WebP of 1200px wide (~300KB).
- Listing summarization: Use generative AI to produce listing summaries from free text in order to standardize and improve quality of user-created vehicle listings. The LLM may use a tool to consult a reference listing for the given make and model.

## Style Guidelines:

- Primary color: Blue (#4988C4) to evoke professionalism and reliability.
- Accent color: Dark blue (#0F2854) to simulate engine heat and draw attention to CTAs.
- Background color: Light grayish-blue (#F1F0EC) to reduce eye strain and suggest polished metal.
- Body font: 'Inter' (sans-serif) for clear readability on small screens.
- Headline font: 'Oswald' (sans-serif) or 'Barlow Condensed' (sans-serif), to mimic license plate and technical document styling.
- Use lightweight SVG icons from Lucide React to ensure fast loading times.
- Employ a mobile-first design approach with a focus on clear, step-by-step forms for listing vehicles.