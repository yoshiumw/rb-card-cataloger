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
    
    const data: RiftboundCard = await response.json();
    return mapApiCardToCard(data);
  } catch (error) {
    console.error('Error fetching card by ID:', error);
    return null;
  }
}

/**
 * Search cards by name (fuzzy search)
 */
export async function searchCardsByName(query: string, page = 1, size = 50): Promise<{ cards: Card[]; total: number }> {
  try {
    const params = new URLSearchParams({
      fuzzy: query,
      dir: '1',
      page: String(page),
      size: String(size),
    });
    
    const url = `${API_BASE}/name?${params}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: RiftboundApiResponse = await response.json();
    const cards = data.items.map(mapApiCardToCard);
    
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
 * Find best matching card by name from search results
 */
export async function findCardByName(cardName: string): Promise<Card | null> {
  const { cards } = await searchCardsByName(cardName, 1, 10);
  
  if (cards.length === 0) return null;
  
  // Try exact match first (case-insensitive)
  const normalizedName = cardName.toLowerCase().trim();
  const exactMatch = cards.find(c => 
    c.displayName.toLowerCase() === normalizedName ||
    c.cardName.toLowerCase() === normalizedName
  );
  
  if (exactMatch) return exactMatch;
  
  // Otherwise return first result (fuzzy match)
  return cards[0];
}
