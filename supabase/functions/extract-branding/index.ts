import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Extracting branding from URL:', formattedUrl);

    const scrape = async (targetUrl: string, waitFor: number, timeout: number) => {
      return await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ['branding'],
          onlyMainContent: false,
          waitFor,
          timeout,
        }),
      });
    };

    // First attempt: original URL with shorter wait
    let response = await scrape(formattedUrl, 1000, 30000);
    let data = await response.json();

    // Fallback: if timeout/error, try the root domain (often loads faster than deep app routes)
    if (!response.ok) {
      try {
        const u = new URL(formattedUrl);
        const rootUrl = `${u.protocol}//${u.hostname}`;
        if (rootUrl !== formattedUrl) {
          console.log(`First attempt failed (${data?.code || response.status}), retrying with root URL: ${rootUrl}`);
          response = await scrape(rootUrl, 1000, 30000);
          data = await response.json();
        }
      } catch (e) {
        console.error('Failed to parse URL for fallback:', e);
      }
    }

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract branding data from the response
    // Firecrawl returns branding data directly in the response object or nested in data
    const branding = data.data?.branding || data.branding || data.data || data;
    
    // Check if we have any usable branding data (colors or images)
    const hasColors = branding?.colors && Object.keys(branding.colors).length > 0;
    const hasImages = branding?.images && Object.keys(branding.images).length > 0;
    
    if (!hasColors && !hasImages) {
      console.log('No branding data found in response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ success: false, error: 'No branding data could be extracted from this website' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Branding extracted successfully:', JSON.stringify(branding, null, 2));

    // Map branding to our format - use available colors from Firecrawl
    const colors = branding.colors || {};
    
    // Helper function to calculate relative luminance (0 = black, 1 = white)
    const getLuminance = (hex: string): number => {
      const rgb = hex.replace('#', '').match(/.{2}/g);
      if (!rgb || rgb.length < 3) return 0.5;
      const [r, g, b] = rgb.map(c => {
        const val = parseInt(c, 16) / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    
    // Firecrawl returns: primary, accent, background, textPrimary, link
    // We need: primary_color, secondary_color, accent_color
    // 
    // Smart logic for corporate sites:
    // - If primary is very light (luminance > 0.7), use textPrimary instead
    // - This handles cases like Postbank where primary=#CED6E4 (light gray) but brand color is in textPrimary
    let rawPrimary = colors.primary || colors.background || '#1a1a2e';
    const textPrimaryColor = colors.textPrimary || '#1a1a2e';
    
    // Check if primary is too light - if so, swap with textPrimary
    const primaryLuminance = getLuminance(rawPrimary);
    const isLightPrimary = primaryLuminance > 0.65;
    
    console.log(`Primary color ${rawPrimary} has luminance ${primaryLuminance.toFixed(2)}, isLight: ${isLightPrimary}`);
    
    const primaryColor = isLightPrimary ? textPrimaryColor : rawPrimary;
    const secondaryColor = isLightPrimary ? rawPrimary : (colors.textPrimary || colors.accent || '#ffffff');
    const accentColor = colors.link || colors.accent || textPrimaryColor || '#3b82f6';
    
    console.log(`Mapped colors - primary: ${primaryColor}, secondary: ${secondaryColor}, accent: ${accentColor}`);
    
    const result = {
      success: true,
      branding: {
        logo: branding.images?.logo || branding.logo || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        colors: colors,
        fonts: branding.fonts || [],
        typography: branding.typography || {},
      }
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting branding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract branding';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
