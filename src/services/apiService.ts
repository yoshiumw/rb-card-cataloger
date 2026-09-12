import { RiftboundCard, RiftboundApiResponse, Card } from '../types';

const API_BASE = 'https://api.riftcodex.com/cards';

/**
 * Convert API response to our internal Card format
 */
export function mapApiCardToCard(api: RiftboundCard): Card {
  // Convert "Kai'Sa - Survivor" to "Kai'Sa, Survivor" for decklist matching
  const displayName = api.name.replace(/ - /g, ', ');
  
  return {
    cardId: api.riftbound_id,
    cardName: api.name,
    displayName,
    set: api.set.label,
    setId: api.set.set_id,
    cardNumber: String(api.collector_number),
    cardType: api.classification.type,
    supertype: api.classification.supertype,
    imageUrl: api.media.image_url,
    rarity: api.classification.rarity,
    domain: api.classification.domain,
    energy: api.attributes.energy,
    might: api.attributes.might,
    power: api.attributes.power,
    cardText: api.text.plain,
    artist: api.media.artist,
    tags: api.tags,
    alternateArt: api.metadata.alternate_art,
  };
}

/**
 * Fetch card by Riftbound ID (e.g., "ven-131" or "ogn-039-298")
 */
export async function fetchCardById(riftboundId: string): Promise<Card | null> {
  try {
    const url = `${API_BASE}/riftbound/${riftboundId.toLowerCase()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: RiftboundCard[] = await response.json();
    
    // API returns an array; pick the first result
    if (!Array.isArray(data) || data.length === 0) return null;
    
    // Prefer non-alternate-art, non-signature, non-overnumbered version
    const preferred = data.find(c => !c.metadata.alternate_art && !c.metadata.signature && !c.metadata.overnumbered) || data[0];
    return mapApiCardToCard(preferred);
  } catch (error) {
    console.error('Error fetching card by ID:', error);
    return null;
  }
}

/**
 * Search cards by name (fuzzy search)
 * Tries both comma and dash formats for better matching
 */
export async function searchCardsByName(query: string, page = 1, size = 50): Promise<{ cards: Card[]; total: number }> {
  try {
    // Try the query as-is first
    let params = new URLSearchParams({
      fuzzy: query,
      dir: '1',
      page: String(page),
      size: String(size),
    });
    
    let url = `${API_BASE}/name?${params}`;
    let response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    let data: RiftboundApiResponse = await response.json();
    let cards = data.items.map(mapApiCardToCard);
    
    // If no results and query contains comma, try with dash
    if (cards.length === 0 && query.includes(',')) {
      const dashQuery = query.replace(/,\s*/g, ' - ');
      params = new URLSearchParams({
        fuzzy: dashQuery,
        dir: '1',
        page: String(page),
        size: String(size),
      });
      
      url = `${API_BASE}/name?${params}`;
      response = await fetch(url);
      
      if (response.ok) {
        data = await response.json();
        cards = data.items.map(mapApiCardToCard);
      }
    }
    
    // If no results and query contains dash, try with comma
    if (cards.length === 0 && query.includes(' - ')) {
      const commaQuery = query.replace(/\s*-\s*/g, ', ');
      params = new URLSearchParams({
        fuzzy: commaQuery,
        dir: '1',
        page: String(page),
        size: String(size),
      });
      
      url = `${API_BASE}/name?${params}`;
      response = await fetch(url);
      
      if (response.ok) {
        data = await response.json();
        cards = data.items.map(mapApiCardToCard);
      }
    }
    
    return {
      cards,
      total: data.total,
    };
  } catch (error) {
    console.error('Error searching cards by name:', error);
    return { cards: [], total: 0 };
  }
}

/**
 * Find best matching card by name using fuzzy search
 * Trusts the API's fuzzy matching and prefers base cards over alternates
 */
export async function findCardByName(cardName: string): Promise<Card | null> {
  const { cards } = await searchCardsByName(cardName, 1, 10);
  
  if (cards.length === 0) return null;
  
  // Prefer base cards (not alternate art, overnumbered, or signature)
  const baseCard = cards.find(c => 
    !c.alternateArt && 
    !c.cardId.includes('a-') && // overnumbered variant
    !c.rarity.toLowerCase().includes('signature')
  );
  
  return baseCard || cards[0];
}
