// Esegui con: node import/import.js percorso/file.xlsx "NomeFornitore"
// Esempio:    node import/import.js ./dati/ferramenta.xlsx "FERRAMENTA SRL"

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

// ============================================================
// CONFIGURAZIONE — usa variabili d'ambiente locali
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key (solo locale!)

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Imposta SUPABASE_URL e SUPABASE_SERVICE_KEY come variabili d\'ambiente');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importaFornitore(filePath, nomeFornitore) {
  console.log(`\n📂 Lettura file: ${filePath}`);
  console.log(`🏭 Fornitore: ${nomeFornitore}`);

  // Leggi Excel
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const righe = XLSX.utils.sheet_to_json(ws, { defval: null });

  console.log(`📊 Righe trovate: ${righe.length}`);

  // Mappa colonne → DB
  const prodotti = righe.map(r => ({
    art:                String(r['ART'] || '').trim() || null,
    descrizione:        String(r['DESCRIZIONE'] || '').trim() || null,
    um:                 String(r['UM'] || '').trim() || null,
    prezzo:             parseNumero(r['PREZZO']),
    sconto1:            parseNumero(r['SCONTO1']),
    sconto2:            parseNumero(r['SCONTO2']),
    categoria:          String(r['CAT MERCE'] || '').trim() || null,
    ean:                r['EAN'] ? String(r['EAN']).trim() : null,
    fornitore:          nomeFornitore,
    data_aggiornamento: parseData(r['DATA ULTIMO AGGIORNAMENTO'])
  })).filter(p => p.art); // scarta righe senza codice articolo

  console.log(`✅ Prodotti validi: ${prodotti.length}`);

  // 1) ELIMINA vecchi record del fornitore
  console.log(`\n🗑️  Eliminazione vecchi dati per "${nomeFornitore}"...`);
  const { error: delErr } = await supabase
    .from('prodotti')
    .delete()
    .eq('fornitore', nomeFornitore);

  if (delErr) {
    console.error('❌ Errore eliminazione:', delErr.message);
    process.exit(1);
  }
  console.log('✅ Vecchi dati eliminati');

  // 2) INSERISCI nuovi dati (in batch da 500)
  console.log(`\n📥 Importazione nuovi dati...`);
  const BATCH = 500;
  for (let i = 0; i < prodotti.length; i += BATCH) {
    const batch = prodotti.slice(i, i + BATCH);
    const { error: insErr } = await supabase.from('prodotti').insert(batch);
    if (insErr) {
      console.error(`❌ Errore batch ${i}-${i+BATCH}:`, insErr.message);
      process.exit(1);
    }
    console.log(`   Importati ${Math.min(i + BATCH, prodotti.length)} / ${prodotti.length}`);
  }

  console.log(`\n🎉 Importazione completata! ${prodotti.length} prodotti caricati.`);
}

function parseNumero(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseData(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Data seriale Excel
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(val).trim();
}

// ESECUZIONE
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Uso: node import/import.js <file.xlsx> "<NomeFornitore>"');
  process.exit(1);
}

importaFornitore(path.resolve(args[0]), args[1]);
