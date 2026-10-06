import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

// Declare EdgeRuntime for Deno edge functions
declare const EdgeRuntime: { waitUntil?: (promise: Promise<any>) => void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Escape special characters for Telegram HTML parse mode
function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Delete a Telegram message
async function deleteTelegramMessage(botToken: string, chatId: number, messageId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    console.log("Deleted Telegram message:", messageId, "in chat:", chatId);
  } catch (e) {
    console.log("Could not delete Telegram message:", messageId);
  }
}

// Schedule message deletion after delay (3 minutes = 180000ms)
function scheduleSmsDeletion(botToken: string, chatId: number, messageId: number, delayMs: number = 180000) {
  const deleteTask = (async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await deleteTelegramMessage(botToken, chatId, messageId);
  })();
  
  // Use EdgeRuntime.waitUntil if available
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(deleteTask);
  }
}

// Extract sender name from SMS text (e.g., "PayPal: 311771..." -> "PayPal")
function extractSenderFromText(text: string): string | null {
  if (!text) return null;
  
  // Pattern: Text starts with a name followed by colon (e.g., "PayPal: ...")
  const colonPattern = text.match(/^([A-Za-z0-9._-]+):\s/);
  if (colonPattern && colonPattern[1]) {
    return colonPattern[1];
  }
  
  // Pattern: "Von/From SENDER:" or "[SENDER]" at start
  const fromPattern = text.match(/^(?:Von|From)\s+([A-Za-z0-9._-]+)/i);
  if (fromPattern && fromPattern[1]) {
    return fromPattern[1];
  }
  
  // Pattern: "[Crypto.com App Login Attempt]" -> extract first word/domain
  const bracketPattern = text.match(/^\[([A-Za-z0-9._-]+)/);
  if (bracketPattern && bracketPattern[1]) {
    return bracketPattern[1];
  }
  
  // Pattern: "Your SENDER verification code" -> extract brand name
  const yourPattern = text.match(/^Your\s+([A-Za-z0-9._-]+)\s+(?:verification|code|PIN|OTP)/i);
  if (yourPattern && yourPattern[1]) {
    return yourPattern[1];
  }
  
  return null;
}

// Extract verification code from SMS text using context-aware logic
function extractVerificationCode(text: string): string | null {
  if (!text) return null;
  
  // Common patterns for verification codes with context
  const contextPatterns = [
    /(?:code|код|kode|código|codice)[:\s]*(\d{4,8})/i,
    /(?:pin|otp|tan)[:\s]*(\d{4,8})/i,
    /(?:bestätigungscode|verifizierungscode|sicherheitscode)[:\s]*(\d{4,8})/i,
    /(?:verification|confirm|verify)[:\s]*(\d{4,8})/i,
    /(\d{4,8})(?:\s*(?:is your|ist dein|lautet|eingeben))/i,
    /(?:enter|eingeben|use)[:\s]*(\d{4,8})/i,
  ];
  
  // Try context patterns first
  for (const pattern of contextPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Fallback: find standalone 4-8 digit codes (not part of URLs or long numbers)
  // Exclude numbers that look like years (19xx, 20xx) or phone numbers
  const standaloneMatch = text.match(/(?<![0-9\/\-])(\d{4,8})(?![0-9\/\-])/);
  if (standaloneMatch && standaloneMatch[1]) {
    const code = standaloneMatch[1];
    // Skip if it looks like a year
    if (/^(19|20)\d{2}$/.test(code)) return null;
    // Skip if all same digits (like 0000, 1111)
    if (/^(\d)\1+$/.test(code)) return null;
    return code;
  }
  
  return null;
}

// NOTE: Telegram notifications for SMS codes are DISABLED
// SMS codes should only be visible in the admin dashboard, not in Telegram
async function sendSmsTelegramNotification(
  _supabase: any,
  _smsInfo: {
    phoneNumber: string;
    verificationCode: string;
    fullText: string;
    senderInfo?: string;
  }
) {
  // DISABLED: SMS codes should NOT be sent to Telegram
  // They are only visible in the admin SMS-Panel
  console.log('[ANOSIM->Telegram] SMS notification DISABLED - codes only in admin dashboard');
  return;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anosimApiKey = Deno.env.get('ANOSIM_API_KEY');

    console.log('[ANOSIM-API] Request received:', { 
      method: req.method,
      url: req.url,
      hasAnosimKey: !!anosimApiKey 
    });

    if (!anosimApiKey) {
      console.error('[ANOSIM-API] Missing ANOSIM_API_KEY');
      return new Response(
        JSON.stringify({ success: false, error: 'ANOSIM_API_KEY not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, data } = await req.json();
    console.log('[ANOSIM-API] Action:', action, 'Data:', data);

    switch (action) {
      case 'getCountries': {
        const url = new URL('https://anosim.net/api/v1/Countries');
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching countries from:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get countries error:', errorText);
          throw new Error(`Failed to get countries: ${response.status} - ${errorText}`);
        }

        const countries = await response.json();
        console.log('Countries from Anosim:', countries);

        return new Response(
          JSON.stringify({ success: true, data: countries }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAvailableNumbers': {
        const { countryId } = data;
        
        const url = new URL('https://anosim.net/api/v1/Products');
        url.searchParams.append('apikey', anosimApiKey);
        if (countryId) {
          url.searchParams.append('countryId', String(countryId));
        }

        console.log('Fetching products from:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim API error:', errorText);
          throw new Error(`Anosim API error: ${response.status} - ${errorText}`);
        }

        const products = await response.json();
        console.log('Products from Anosim:', products);

        return new Response(
          JSON.stringify({ success: true, data: products }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getProduct': {
        const { id } = data;
        if (!id) throw new Error('id is required');

        const url = new URL(`https://anosim.net/api/v1/Products/${id}`);
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching product:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get product error:', errorText);
          throw new Error(`Failed to get product: ${response.status} - ${errorText}`);
        }

        const product = await response.json();
        console.log('Product from Anosim:', product);

        return new Response(
          JSON.stringify({ success: true, data: product }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createOrder': {
        const { productId, amount, providerId } = data;

        if (!productId) throw new Error('productId is required');
        if (!amount || amount < 1) throw new Error('amount must be at least 1');

        const url = new URL('https://anosim.net/api/v1/Orders');
        url.searchParams.append('apikey', anosimApiKey);
        url.searchParams.append('productId', String(productId));
        url.searchParams.append('amount', String(amount));
        url.searchParams.append('providerId', String(providerId ?? 0));

        console.log('Creating order:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim create order error:', errorText);
          throw new Error(`Failed to create order: ${response.status} - ${errorText}`);
        }

        const order = await response.json();
        console.log('Order created:', order);

        // Store the bookings from the order in our database
        if (order.bookings && Array.isArray(order.bookings)) {
          for (const booking of order.bookings) {
            const { error: insertError } = await supabase
              .from('phone_numbers')
              .insert({
                phone_number: booking.number,
                country: booking.country,
                provider: 'Anosim',
                service_name: booking.service || null,
                number_type: booking.rentalType,
                monthly_cost: booking.priceInUSD,
                rental_duration_days: Math.round(booking.durationInMinutes / 1440),
                status: booking.state === 'Active' ? 'active' : 'available',
                rented_since: new Date(booking.startDate).toISOString().split('T')[0],
                available_numbers: 1,
                rent_type: booking.rentalType === 'RentalFull' ? 'full_number' : 'service',
                notes: `Order ID: ${order.id}, Booking ID: ${booking.id}`,
              });

            if (insertError) {
              console.error('Database insert error for booking:', insertError);
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, data: order }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getOrder': {
        const { id } = data;
        if (!id) throw new Error('id is required');

        const url = new URL(`https://anosim.net/api/v1/Orders/${id}`);
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching order:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get order error:', errorText);
          throw new Error(`Failed to get order: ${response.status} - ${errorText}`);
        }

        const order = await response.json();
        console.log('Order from Anosim:', order);

        return new Response(
          JSON.stringify({ success: true, data: order }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getOrders': {
        const url = new URL('https://anosim.net/api/v1/Orders');
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching all orders:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get orders error:', errorText);
          throw new Error(`Failed to get orders: ${response.status} - ${errorText}`);
        }

        const orders = await response.json();
        console.log('Orders from Anosim:', orders);

        return new Response(
          JSON.stringify({ success: true, data: orders }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getOrderBooking': {
        const { id } = data;
        if (!id) throw new Error('id is required');

        const url = new URL(`https://anosim.net/api/v1/OrderBookings/${id}`);
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching order booking:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get order booking error:', errorText);
          throw new Error(`Failed to get order booking: ${response.status} - ${errorText}`);
        }

        const booking = await response.json();
        console.log('Order booking from Anosim:', booking);

        return new Response(
          JSON.stringify({ success: true, data: booking }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getOrderBookings': {
        const url = new URL('https://anosim.net/api/v1/OrderBookings');
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching all order bookings:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get order bookings error:', errorText);
          throw new Error(`Failed to get order bookings: ${response.status} - ${errorText}`);
        }

        const bookings = await response.json();
        console.log('Order bookings from Anosim:', bookings);

        return new Response(
          JSON.stringify({ success: true, data: bookings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'extendBooking': {
        const { orderBookingId, extentionInMinutes } = data;

        if (!orderBookingId) throw new Error('orderBookingId is required');
        if (!extentionInMinutes || extentionInMinutes < 1) {
          throw new Error('extentionInMinutes must be at least 1');
        }

        const url = new URL('https://anosim.net/api/v1/OrderBookings');
        url.searchParams.append('apikey', anosimApiKey);
        url.searchParams.append('orderBookingId', String(orderBookingId));
        url.searchParams.append('extentionInMinutes', String(extentionInMinutes));

        console.log('Extending booking:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim extend booking error:', errorText);
          throw new Error(`Failed to extend booking: ${response.status} - ${errorText}`);
        }

        const extendOrder = await response.json();
        console.log('Extended booking order:', extendOrder);

        return new Response(
          JSON.stringify({ success: true, data: extendOrder }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getSimCards': {
        const url = new URL('https://anosim.net/api/v1/SimCards');
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching SIM cards from:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get SIM cards error:', errorText);
          throw new Error(`Failed to get SIM cards: ${response.status} - ${errorText}`);
        }

        const simCards = await response.json();
        console.log('SIM cards from Anosim:', simCards);

        return new Response(
          JSON.stringify({ success: true, data: simCards }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAllSms': {
        const { saveToHistory } = data || {};
        const url = new URL('https://anosim.net/api/v1/Sms');
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching all SMS from:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get all SMS error:', errorText);
          throw new Error(`Failed to get all SMS: ${response.status} - ${errorText}`);
        }

        const smsMessages = await response.json();
        console.log('All SMS messages from Anosim:', smsMessages);

        // Save SMS to history if requested or by default
        // ONLY send the NEWEST SMS to Telegram (sort by date, take first new one)
        if (saveToHistory !== false && Array.isArray(smsMessages) && smsMessages.length > 0) {
          // Sort SMS by date descending (newest first)
          const sortedSms = [...smsMessages].sort((a, b) => {
            const dateA = new Date(a.messageDate || a.date || 0).getTime();
            const dateB = new Date(b.messageDate || b.date || 0).getTime();
            return dateB - dateA;
          });

          let newestSmsForwarded = false;
          
          for (const sms of sortedSms) {
            // Extract verification code using context-aware logic
            const messageText = sms.text || '';
            const extractedCode = extractVerificationCode(messageText);
            const verificationCode = extractedCode || messageText.substring(0, 20) || 'N/A';
            
            // Check if this SMS already exists (by anosim SMS id or combination of phone+text+date)
            const { data: existing } = await supabase
              .from('sms_forwards')
              .select('id')
              .eq('phone_number', sms.number || sms.phoneNumber || 'unknown')
              .eq('verification_code', verificationCode)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(1);

            if (!existing || existing.length === 0) {
              const phoneNum = sms.number || sms.phoneNumber || 'unknown';
              const { error: insertError } = await supabase
                .from('sms_forwards')
                .insert({
                  phone_number: phoneNum,
                  verification_code: verificationCode,
                  anosim_response: sms,
                  status: 'received',
                  submission_id: null,
                });

              if (insertError) {
                console.error('Error saving SMS to history:', insertError);
              } else {
                console.log('SMS saved to history:', phoneNum, verificationCode);
                
                // ONLY send Telegram notification for the NEWEST unseen SMS
                if (!newestSmsForwarded) {
                  await sendSmsTelegramNotification(supabase, {
                    phoneNumber: phoneNum,
                    verificationCode,
                    fullText: sms.text || '',
                    senderInfo: sms.messageSender || sms.senderId || sms.sender || undefined,
                  });
                  newestSmsForwarded = true;
                }
              }
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, data: smsMessages }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getSms': {
        const { orderbookingId, saveToHistory } = data || {};
        if (!orderbookingId) throw new Error('orderbookingId is required');

        const url = new URL(`https://anosim.net/api/v1/Sms/${orderbookingId}`);
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching SMS from:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get SMS error:', errorText);
          throw new Error(`Failed to get SMS: ${response.status} - ${errorText}`);
        }

        const smsMessages = await response.json();
        console.log('SMS messages from Anosim:', smsMessages);

        // Persist incoming SMS to history (default on)
        // ONLY send the NEWEST SMS to Telegram (sort by date, take first new one)
        if (saveToHistory !== false && Array.isArray(smsMessages) && smsMessages.length > 0) {
          // Sort SMS by date descending (newest first)
          const sortedSms = [...smsMessages].sort((a, b) => {
            const dateA = new Date(a.messageDate || a.date || 0).getTime();
            const dateB = new Date(b.messageDate || b.date || 0).getTime();
            return dateB - dateA;
          });

          let newestSmsForwarded = false;
          
          for (const sms of sortedSms) {
            const phoneNumber = sms.simCardNumber || sms.number || sms.phoneNumber || 'unknown';
            const messageText = sms.messageText || sms.text || sms.message || '';
            const messageDate = sms.messageDate || null;

            // Extract verification code using context-aware logic
            const extractedCode = extractVerificationCode(String(messageText));
            const verificationCode = extractedCode || String(messageText).substring(0, 20) || 'N/A';

            const { data: existing, error: existingError } = await supabase
              .from('sms_forwards')
              .select('id')
              .eq('phone_number', phoneNumber)
              .eq('verification_code', verificationCode)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(1);

            if (existingError) {
              console.error('Error checking existing SMS history:', existingError);
            }

            if (!existing || existing.length === 0) {
              const { error: insertError } = await supabase
                .from('sms_forwards')
                .insert({
                  phone_number: phoneNumber,
                  verification_code: verificationCode,
                  anosim_response: {
                    ...sms,
                    messageText,
                    messageDate,
                    orderbookingId,
                  },
                  status: 'received',
                  submission_id: null,
                });

              if (insertError) {
                console.error('Error saving SMS to history:', insertError);
              } else {
                console.log('SMS saved to history:', phoneNumber, verificationCode);
                
                // ONLY send Telegram notification for the NEWEST unseen SMS
                if (!newestSmsForwarded) {
                  await sendSmsTelegramNotification(supabase, {
                    phoneNumber,
                    verificationCode,
                    fullText: String(messageText),
                    senderInfo: sms.messageSender || sms.senderId || sms.sender || undefined,
                  });
                  newestSmsForwarded = true;
                }
              }
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, data: smsMessages }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getOrderBookingsCurrent': {
        const url = new URL('https://anosim.net/api/v1/OrderBookingsCurrent');
        url.searchParams.append('apikey', anosimApiKey);

        console.log('Fetching current order bookings:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim get current order bookings error:', errorText);
          throw new Error(`Failed to get current order bookings: ${response.status} - ${errorText}`);
        }

        const bookings = await response.json();
        console.log('Current order bookings from Anosim:', bookings);

        return new Response(
          JSON.stringify({ success: true, data: bookings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'setAutoRenewal': {
        const { enable, orderBookingId } = data;

        if (enable === undefined || enable === null) {
          throw new Error('enable parameter is required');
        }

        const url = new URL('https://anosim.net/api/v1/OrderBookingsAutoRenewal/SetAutoRenewalAsync');
        url.searchParams.append('apiKey', anosimApiKey);
        url.searchParams.append('enable', enable ? '1' : '0');
        if (orderBookingId) {
          url.searchParams.append('orderBookingId', String(orderBookingId));
        }

        console.log('Setting auto-renewal:', url.toString().replace(anosimApiKey, 'XXX'));

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anosim set auto-renewal error:', errorText);
          throw new Error(`Failed to set auto-renewal: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Auto-renewal result:', result);

        return new Response(
          JSON.stringify({ success: result.Success, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        console.error('[ANOSIM-API] Unknown action:', action);
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error('[ANOSIM-API] Error in function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: 'Check function logs for more information'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
