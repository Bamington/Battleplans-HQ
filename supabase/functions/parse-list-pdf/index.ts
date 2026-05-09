/**
 * parse-list-pdf — Supabase Edge Function
 *
 * Receives a PDF (or image) as base64, sends it to Google Gemini's
 * vision API, and returns structured army list data.
 *
 * Environment variables required:
 *   GEMINI_API_KEY — Google AI Studio API key (free tier)
 *
 * Request body:
 *   { fileBase64: string, fileName: string, mimeType: string }
 *
 * Response:
 *   ParsedList JSON (same shape as the client-side parser output)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const EXTRACTION_PROMPT = `You are a data extraction tool for the tabletop game Halo: Flashpoint.

Analyze the provided PDF/image of an army list from the Mantic list builder. Extract ALL unit cards and return structured JSON.

For each unit card, extract:
- name: The unit name (e.g. "ODST 2ND LIEUTENANT")
- pointsCost: The points value in brackets (e.g. [28] → 28)
- keywords: Comma-separated unit keywords below the name (e.g. "Scout, Tactician(1)")
- ra: Ranged Attack stat (the number before the +, e.g. "4+" → 4)
- fi: Fight stat (same format)
- sv: Survive stat (same format)
- advance: First number from SP (e.g. "SP 1/2" → 1)
- sprint: Second number from SP (e.g. "SP 1/2" → 2)
- ar: Armour value (e.g. "AR1" → 1)
- hp: Hit Points (e.g. "HP3" → 3)
- weapons: Array of weapon objects, each with:
  - name: Weapon name (e.g. "BR55 Battle Rifle")
  - range: Range value (e.g. "CC", "R3", "R5")
  - ap: AP value (e.g. "-", "AP1")
  - keywords: Weapon keywords as a string (e.g. "Optics, Weight of Fire(1)")

Also extract the list header:
- name: List name (e.g. "ODST Copy")
- pointsUsed: Points used (e.g. 150)
- pointsMax: Points maximum (e.g. 150)

Also extract any special orders:
- specialOrders: Array of { name, target, pointsCost }

Also extract keyword definitions from the "Keywords" / "Description" section (if present):
- keywordDefs: Array of { name, description, hasParam }
  - hasParam is true if the keyword uses a numeric parameter like (n) or (X)

Return ONLY valid JSON matching this exact structure:
{
  "name": "string",
  "pointsUsed": number,
  "pointsMax": number,
  "units": [...],
  "specialOrders": [...],
  "keywordDefs": [...]
}

Important:
- Do NOT include any markdown formatting, code fences, or explanatory text
- Return ONLY the raw JSON object
- If a weapon keyword field is empty or shows "-", use an empty string ""
- If a unit has no keywords line, use an empty string ""
- Parse ALL units visible across ALL pages`

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const { fileBase64, fileName, mimeType } = await req.json()

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Determine MIME type
    let mediaType = mimeType || 'application/pdf'
    if (fileName?.endsWith('.pdf')) mediaType = 'application/pdf'
    else if (fileName?.endsWith('.png')) mediaType = 'image/png'
    else if (fileName?.endsWith('.jpg') || fileName?.endsWith('.jpeg')) mediaType = 'image/jpeg'
    else if (fileName?.endsWith('.webp')) mediaType = 'image/webp'

    // Call Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mediaType,
                  data: fileBase64,
                },
              },
              {
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Gemini API error:', response.status, errBody)
      throw new Error(`Gemini API error ${response.status}: ${errBody.substring(0, 200)}`)
    }

    const result = await response.json()

    // Extract text from Gemini response
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      const blockReason = result.candidates?.[0]?.finishReason
      const promptFeedback = result.promptFeedback?.blockReason
      console.error('Empty Gemini response. finishReason:', blockReason, 'promptFeedback:', promptFeedback, 'raw:', JSON.stringify(result).substring(0, 500))
      throw new Error(`No response from Gemini (finishReason: ${blockReason || 'unknown'})`)
    }

    // Parse JSON — Gemini with responseMimeType: 'application/json' should return clean JSON,
    // but strip code fences as a safety net
    let parsed
    try {
      let jsonStr = text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse Gemini response as JSON:', text.substring(0, 500))
      throw new Error('Failed to parse extraction results')
    }

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
})
