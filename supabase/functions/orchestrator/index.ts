import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Initialize Supabase Client (Service Role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Environment Variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 3. Parse Body
    const { action, ...params } = await req.json()
    let result = { data: null, error: null }

    console.log(`[Orchestrator] Action: ${action}`)

    // 4. Route Logic
    switch (action) {
      case 'fetch_core_data':
        const [books, themes, aliases] = await Promise.all([
          supabase.from('books').select('id, name, chapters, amharicName, testament, order, name_en').order('order'),
          supabase.from('themes').select('name, bookIds'),
          supabase.from('book_aliases').select('alias, book_id')
        ])
        result.data = { books: books.data, themes: themes.data, aliases: aliases.data }
        if (books.error || themes.error) result.error = books.error || themes.error
        break;

      case 'fetch_votd':
        // Default to 'am' if not provided
        const votdLang = params.language || 'am'; 
        const votdRef = await supabase.from('daily_verses').select('*').order('verse_date', { ascending: false }).limit(1).single()
        
        if (votdRef.data) {
          const { book_id, chapter_num, verse_num } = votdRef.data
          // Dynamic table selection
          const textData = await supabase.from(`verses_${votdLang}`)
            .select('verse_text')
            .match({ book_id, chapter_num, verse_num })
            .single()
          
          result.data = { ...votdRef.data, verse_text: textData.data?.verse_text }
        } else {
          // Fallback if table is empty (prevents crash)
          result.error = votdRef.error || { message: "No daily verse found" }
        }
        break;

      case 'fetch_chapter_content':
        const { bookId, chapter, language: lang } = params
        const [versesRes, commRes] = await Promise.all([
            supabase.from(`verses_${lang}`)
                .select(`book_id, chapter_num, verse_num, verse_display_num, verse_text, chapters_${lang}(header_text)`)
                .eq("book_id", bookId).eq("chapter_num", chapter).order("verse_num", { ascending: true }),
            supabase.from(`commentary_${lang}`)
                .select("verse_num, commentary_text")
                .eq("book_id", bookId).eq("chapter_num", chapter)
        ])
        if (versesRes.data) {
            const commentaries = commRes.data || []
            result.data = versesRes.data.map(v => ({
                ...v,
                commentary_text: commentaries.find(c => c.verse_num === v.verse_num)?.commentary_text || null
            }))
        } else { result.error = versesRes.error }
        break;

      case 'fetch_book_full':
        const pageSize = 1000
        const offset = (params.page || 0) * pageSize
        const downloadPromises = []
        
        if (params.includeVerses) {
             downloadPromises.push(
                 supabase.from(`verses_${params.language}`)
                 .select("book_id, chapter_num, verse_num, verse_display_num, verse_text")
                 .eq("book_id", params.bookId)
                 .order("chapter_num", { ascending: true }).order("verse_num", { ascending: true })
                 .range(offset, offset + pageSize - 1)
             )
        } else { downloadPromises.push(Promise.resolve({ data: [] })) }

        if (params.includeCommentary) {
             downloadPromises.push(
                 supabase.from(`commentary_${params.language}`)
                 .select("chapter_num, verse_num, commentary_text")
                 .eq("book_id", params.bookId)
                 .range(offset, offset + pageSize - 1)
             )
        } else { downloadPromises.push(Promise.resolve({ data: [] })) }

        const [dlVerses, dlComm] = await Promise.all(downloadPromises)
        const versesFull = dlVerses.data && dlVerses.data.length === pageSize;
        const commFull = dlComm.data && dlComm.data.length === pageSize;
        result.data = { verses: dlVerses.data || [], commentaries: dlComm.data || [], hasMore: versesFull || commFull }
        break;

      case 'fetch_cross_refs':
        const refPageSize = 1000
        const refOffset = (params.page || 0) * refPageSize
        const refs = await supabase.from('cross_references')
            .select('doc_id, related_refs').order('doc_id', { ascending: true })
            .range(refOffset, refOffset + refPageSize - 1)
        result.data = { crossrefs: refs.data || [], hasMore: refs.data?.length === refPageSize }
        result.error = refs.error
        break;

      case 'search':
        const searchRes = await supabase.rpc("search_verses", {
            language_code: params.language, keyword_term: params.keyword,
            limit_count: 50, offset_count: 0,
        })
        result.data = searchRes.data
        result.error = searchRes.error
        break;

      case 'get_audio_url':
        const audioRes = await supabase.from('audio_tracks').select('audio_url')
            .eq('book_id', params.bookId).eq('chapter_num', params.chapter).eq('language', params.language).single()
        result.data = audioRes.data
        break;

      case 'fetch_verse_text':
        const vQuery = supabase.from(`verses_${params.language}`)
            .select("verse_num, verse_text")
            .eq("book_id", params.bookId).eq("chapter_num", params.chapter)
            .gte("verse_num", params.startVerse).order("verse_num", { ascending: true })
        if (params.endVerse) vQuery.lte("verse_num", params.endVerse)
        const vRes = await vQuery
        result.data = vRes.data; result.error = vRes.error
        break;

      case 'fetch_chapter_refs':
        const pat = `${params.bookId}-${params.chapter}-%`
        const refIds = await supabase.from('cross_references').select('doc_id').like('doc_id', pat)
        result.data = refIds.data
        break;

      case 'fetch_ref_details':
        const refDet = await supabase.from('cross_references').select('related_refs').eq('doc_id', params.docId).single()
        result.data = refDet.data
        break;

      case 'fetch_setting':
        const setRes = await supabase.from('app_settings').select('name, value').eq('name', params.settingName).single()
        result.data = setRes.data
        break;

      default:
        return new Response(JSON.stringify({ error: `Invalid Action: ${action}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (err) {
    console.error("Critical Orchestrator Error:", err.message)
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    })
  }
})
