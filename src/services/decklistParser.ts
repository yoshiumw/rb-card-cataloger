import { ParsedDecklist, DeckCardEntry, ParseError } from '../types';

/**
 * Decklist Parser Service
 * 
 * Parses a Riftbound decklist text into structured data.
 * 
 * Supported sections:
 * - Legend
 * - Champion
 * - MainDeck
 * - Battlefields
 * - Rune Pool
 * - Sideboard
 * 
 * Card entry format: "quantity card name"
 * Example: "3 Kai'Sa, Survivor"
 * 
 * The parser handles:
 * - Apostrophes in card names (Kai'Sa)
 * - Commas in card names (Akali, Rogue Assassin)
 * - Extra spaces and blank lines
 * - Different capitalization of section names
 * - Windows/Unix line endings
 */

// Section header patterns (case-insensitive)
const SECTION_PATTERNS: Record<string, keyof Omit<ParsedDecklist, 'errors'>> = {
  'legend': 'legend',
  'champion': 'champion',
  'maindeck': 'mainDeck',
  'main deck': 'mainDeck',
  'main': 'mainDeck',
  'battlefields': 'battlefields',
  'battlefield': 'battlefields',
  'rune pool': 'runePool',
  'runepool': 'runePool',
  'runes': 'runePool',
  'sideboard': 'sideboard',
  'side': 'sideboard',
  'sb': 'sideboard',
};

/**
 * Parse a decklist text into structured data
 * @param decklistText - Raw decklist text
 * @returns Parsed decklist with sections and any parse errors
 */
export function parseDecklist(decklistText: string): ParsedDecklist {
  const result: ParsedDecklist = {
    legend: [],
    champion: [],
    mainDeck: [],
    battlefields: [],
    runePool: [],
    sideboard: [],
    errors: [],
  };

  if (!decklistText || !decklistText.trim()) {
    return result;
  }

  // Normalize line endings (Windows → Unix)
  const normalizedText = decklistText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');

  let currentSection: keyof Omit<ParsedDecklist, 'errors'> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    // Skip blank lines
    if (!trimmedLine) continue;

    // Check if this is a section header
    const sectionKey = detectSectionHeader(trimmedLine);
    if (sectionKey !== null) {
      currentSection = sectionKey;
      continue;
    }

    // If we're not in a section yet, skip (or could treat as error)
    if (currentSection === null) {
      result.errors.push({
        lineNumber,
        line: trimmedLine,
        message: 'Card entry found before any section header. Please add a section header (e.g., "MainDeck:") first.',
      });
      continue;
    }

    // Parse card entry
    const cardEntry = parseCardLine(trimmedLine);
    if (cardEntry) {
      result[currentSection].push(cardEntry);
    } else {
      result.errors.push({
        lineNumber,
        line: trimmedLine,
        message: 'Could not parse this line. Expected format: "quantity card name" (e.g., "3 Kai\'Sa, Survivor")',
      });
    }
  }

  return result;
}

/**
 * Detect if a line is a section header
 * Returns the section key if it is, null otherwise
 */
function detectSectionHeader(line: string): keyof Omit<ParsedDecklist, 'errors'> | null {
  // Remove trailing colon if present
  let header = line.toLowerCase().replace(/:$/, '').trim();
  
  // Check against known section patterns
  if (SECTION_PATTERNS[header] !== undefined) {
    return SECTION_PATTERNS[header];
  }

  // Also check without spaces for compound names
  header = header.replace(/\s+/g, '');
  if (SECTION_PATTERNS[header] !== undefined) {
    return SECTION_PATTERNS[header];
  }

  return null;
}

/**
 * Parse a single card line
 * Expected format: "quantity card name"
 * Example: "3 Kai'Sa, Survivor"
 * 
 * The quantity is the first integer on the line.
 * Everything after the quantity (and separating space) is the card name.
 */
function parseCardLine(line: string): DeckCardEntry | null {
  // Match: optional leading whitespace, one or more digits, then whitespace, then the rest is the card name
  const match = line.match(/^(\d+)\s+(.+)$/);
  
  if (!match) return null;

  const quantity = parseInt(match[1], 10);
  const cardName = match[2].trim();

  // Validate
  if (isNaN(quantity) || quantity < 1) return null;
  if (!cardName || cardName.length === 0) return null;

  return {
    cardName,
    quantity,
  };
}

/**
 * Validate a parsed decklist
 * Returns an array of validation warnings
 */
export function validateDecklist(parsed: ParsedDecklist): string[] {
  const warnings: string[] = [];

  // Check for Legend section
  if (parsed.legend.length === 0) {
    warnings.push('No Legend card specified. A deck typically requires exactly 1 Legend.');
  } else if (parsed.legend.length > 1) {
    warnings.push(`Multiple Legend cards found (${parsed.legend.length}). A deck should have exactly 1 Legend.`);
  } else {
    const legendTotal = parsed.legend.reduce((sum, c) => sum + c.quantity, 0);
    if (legendTotal > 1) {
      warnings.push(`Legend has ${legendTotal} copies. A deck should have exactly 1 Legend.`);
    }
  }

  // Check for Champion section
  if (parsed.champion.length === 0) {
    warnings.push('No Champion card specified. A deck typically requires exactly 1 Champion.');
  } else if (parsed.champion.length > 1) {
    warnings.push(`Multiple Champion cards found (${parsed.champion.length}). A deck should have exactly 1 Champion.`);
  }

  // Check MainDeck size
  const mainDeckTotal = parsed.mainDeck.reduce((sum, c) => sum + c.quantity, 0);
  if (mainDeckTotal < 40) {
    warnings.push(`Main Deck has only ${mainDeckTotal} cards. Minimum deck size is typically 40.`);
  } else if (mainDeckTotal > 60) {
    warnings.push(`Main Deck has ${mainDeckTotal} cards. Maximum deck size is typically 60.`);
  }

  // Check Rune Pool
  const runePoolTotal = parsed.runePool.reduce((sum, c) => sum + c.quantity, 0);
  if (runePoolTotal < 6) {
    warnings.push(`Rune Pool has only ${runePoolTotal} runes. A deck typically requires 6 runes.`);
  }

  // Check for parse errors
  if (parsed.errors.length > 0) {
    warnings.push(`${parsed.errors.length} line(s) could not be parsed. Check the decklist for errors.`);
  }

  return warnings;
}

/**
 * Get total card count across all sections (excluding sideboard)
 */
export function getDeckCardCount(parsed: ParsedDecklist): { main: number; sideboard: number; total: number } {
  const main = 
    parsed.legend.reduce((s, c) => s + c.quantity, 0) +
    parsed.champion.reduce((s, c) => s + c.quantity, 0) +
    parsed.mainDeck.reduce((s, c) => s + c.quantity, 0) +
    parsed.battlefields.reduce((s, c) => s + c.quantity, 0) +
    parsed.runePool.reduce((s, c) => s + c.quantity, 0);
  
  const sideboard = parsed.sideboard.reduce((s, c) => s + c.quantity, 0);
  
  return { main, sideboard, total: main + sideboard };
}

/**
 * Reconstruct decklist text from parsed data
 */
export function decklistToString(parsed: ParsedDecklist): string {
  const sections: { header: string; key: keyof Omit<ParsedDecklist, 'errors'> }[] = [
    { header: 'Legend:', key: 'legend' },
    { header: 'Champion:', key: 'champion' },
    { header: 'MainDeck:', key: 'mainDeck' },
    { header: 'Battlefields:', key: 'battlefields' },
    { header: 'Rune Pool:', key: 'runePool' },
    { header: 'Sideboard:', key: 'sideboard' },
  ];

  const lines: string[] = [];

  for (const section of sections) {
    const cards = parsed[section.key];
    if (cards.length > 0) {
      lines.push('');
      lines.push(section.header);
      for (const card of cards) {
        lines.push(`${card.quantity} ${card.cardName}`);
      }
    }
  }

  return lines.join('\n').trim();
}
