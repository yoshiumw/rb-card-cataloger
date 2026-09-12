import { Card } from '../types';

// Sample Riftbound card database
// In production, this would be imported from Firestore or a JSON/CSV file
// The architecture supports loading cards from Firestore via the cardLookupService

const sampleCards: Card[] = [
  // Core Set - Champions
  { cardId: 'CR-001', cardName: "Akali, Rogue Assassin", set: 'Core Release', cardNumber: '001', cardType: 'Champion', rarity: 'Legendary', imageUrl: '' },
  { cardId: 'CR-002', cardName: "Akali, Deadly Weapon", set: 'Core Release', cardNumber: '002', cardType: 'Champion', rarity: 'Legendary', imageUrl: '' },
  { cardId: 'CR-003', cardName: "Akali, Silent", set: 'Core Release', cardNumber: '003', cardType: 'Champion', rarity: 'Legendary', imageUrl: '' },
  { cardId: 'CR-004', cardName: "Kai'Sa, Survivor", set: 'Core Release', cardNumber: '004', cardType: 'Champion', rarity: 'Epic', imageUrl: '' },
  { cardId: 'CR-005', cardName: "Mischievous Marai", set: 'Core Release', cardNumber: '005', cardType: 'Unit', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-006', cardName: "Scuttle Crab", set: 'Core Release', cardNumber: '006', cardType: 'Unit', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-007', cardName: "Stellacorn Herder", set: 'Core Release', cardNumber: '007', cardType: 'Unit', rarity: 'Uncommon', imageUrl: '' },
  { cardId: 'CR-008', cardName: "Astral Heron", set: 'Core Release', cardNumber: '008', cardType: 'Unit', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-009', cardName: "Falling Star", set: 'Core Release', cardNumber: '009', cardType: 'Spell', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-010', cardName: "Defy", set: 'Core Release', cardNumber: '010', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-011', cardName: "Charm", set: 'Core Release', cardNumber: '011', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-012', cardName: "Discipline", set: 'Core Release', cardNumber: '012', cardType: 'Spell', rarity: 'Uncommon', imageUrl: '' },
  { cardId: 'CR-013', cardName: "Long Sword", set: 'Core Release', cardNumber: '013', cardType: 'Equipment', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-014', cardName: "Zhonya's Hourglass", set: 'Core Release', cardNumber: '014', cardType: 'Equipment', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-015', cardName: "Shuriken Flip", set: 'Core Release', cardNumber: '015', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-016', cardName: "Back Off", set: 'Core Release', cardNumber: '016', cardType: 'Spell', rarity: 'Uncommon', imageUrl: '' },
  { cardId: 'CR-017', cardName: "Pendulum Blade", set: 'Core Release', cardNumber: '017', cardType: 'Equipment', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-018', cardName: "Against the Odds", set: 'Core Release', cardNumber: '018', cardType: 'Spell', rarity: 'Epic', imageUrl: '' },
  { cardId: 'CR-019', cardName: "Emperor's Divide", set: 'Core Release', cardNumber: '019', cardType: 'Spell', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-020', cardName: "Not So Fast", set: 'Core Release', cardNumber: '020', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-021', cardName: "Sterak's Gage", set: 'Core Release', cardNumber: '021', cardType: 'Equipment', rarity: 'Epic', imageUrl: '' },
  { cardId: 'CR-022', cardName: "Adaptatron", set: 'Core Release', cardNumber: '022', cardType: 'Unit', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-023', cardName: "Ferrous Forerunner", set: 'Core Release', cardNumber: '023', cardType: 'Unit', rarity: 'Uncommon', imageUrl: '' },
  { cardId: 'CR-024', cardName: "Decree of Focus", set: 'Core Release', cardNumber: '024', cardType: 'Spell', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-025', cardName: "Decree of Rage", set: 'Core Release', cardNumber: '025', cardType: 'Spell', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-026', cardName: "Disarming Rake", set: 'Core Release', cardNumber: '026', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-027', cardName: "Crumbling Sands", set: 'Core Release', cardNumber: '027', cardType: 'Spell', rarity: 'Uncommon', imageUrl: '' },
  
  // Battlefields
  { cardId: 'CR-028', cardName: "Void Gate", set: 'Core Release', cardNumber: '028', cardType: 'Battlefield', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-029', cardName: "Forgotten Monument", set: 'Core Release', cardNumber: '029', cardType: 'Battlefield', rarity: 'Rare', imageUrl: '' },
  { cardId: 'CR-030', cardName: "Sigil of the Storm", set: 'Core Release', cardNumber: '030', cardType: 'Battlefield', rarity: 'Rare', imageUrl: '' },
  
  // Runes
  { cardId: 'CR-031', cardName: "Fury Rune", set: 'Core Release', cardNumber: '031', cardType: 'Rune', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-032', cardName: "Calm Rune", set: 'Core Release', cardNumber: '032', cardType: 'Rune', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-033', cardName: "Arcane Rune", set: 'Core Release', cardNumber: '033', cardType: 'Rune', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-034', cardName: "Nature Rune", set: 'Core Release', cardNumber: '034', cardType: 'Rune', rarity: 'Common', imageUrl: '' },
  { cardId: 'CR-035', cardName: "Shadow Rune", set: 'Core Release', cardNumber: '035', cardType: 'Rune', rarity: 'Common', imageUrl: '' },
  
  // Expansion Set - Riftborn
  { cardId: 'RB-001', cardName: "Vex, the Riftwalker", set: 'Riftborn', cardNumber: '001', cardType: 'Champion', rarity: 'Legendary', imageUrl: '' },
  { cardId: 'RB-002', cardName: "Vex, Dimensional Shift", set: 'Riftborn', cardNumber: '002', cardType: 'Champion', rarity: 'Legendary', imageUrl: '' },
  { cardId: 'RB-003', cardName: "Rift Stalker", set: 'Riftborn', cardNumber: '003', cardType: 'Unit', rarity: 'Common', imageUrl: '' },
  { cardId: 'RB-004', cardName: "Phase Walker", set: 'Riftborn', cardNumber: '004', cardType: 'Unit', rarity: 'Uncommon', imageUrl: '' },
  { cardId: 'RB-005', cardName: "Dimensional Tear", set: 'Riftborn', cardNumber: '005', cardType: 'Spell', rarity: 'Rare', imageUrl: '' },
  { cardId: 'RB-006', cardName: "Void Siphon", set: 'Riftborn', cardNumber: '006', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'RB-007', cardName: "Riftblade", set: 'Riftborn', cardNumber: '007', cardType: 'Equipment', rarity: 'Rare', imageUrl: '' },
  { cardId: 'RB-008', cardName: "Temporal Shield", set: 'Riftborn', cardNumber: '008', cardType: 'Spell', rarity: 'Uncommon', imageUrl: '' },
  { cardId: 'RB-009', cardName: "Reality Warp", set: 'Riftborn', cardNumber: '009', cardType: 'Spell', rarity: 'Epic', imageUrl: '' },
  { cardId: 'RB-010', cardName: "The Abyss", set: 'Riftborn', cardNumber: '010', cardType: 'Battlefield', rarity: 'Rare', imageUrl: '' },
  { cardId: 'RB-011', cardName: "Rift Rune", set: 'Riftborn', cardNumber: '011', cardType: 'Rune', rarity: 'Common', imageUrl: '' },
  { cardId: 'RB-012', cardName: "Echoing Presence", set: 'Riftborn', cardNumber: '012', cardType: 'Unit', rarity: 'Rare', imageUrl: '' },
  { cardId: 'RB-013', cardName: "Blink Strike", set: 'Riftborn', cardNumber: '013', cardType: 'Spell', rarity: 'Common', imageUrl: '' },
  { cardId: 'RB-014', cardName: "Chrono Armor", set: 'Riftborn', cardNumber: '014', cardType: 'Equipment', rarity: 'Epic', imageUrl: '' },
  { cardId: 'RB-015', cardName: "Phase Out", set: 'Riftborn', cardNumber: '015', cardType: 'Spell', rarity: 'Uncommon', imageUrl: '' },
];

// Card database stored in memory (simulates Firestore collection)
// In production, this would be loaded from Firestore's /cards collection
let cardDatabase: Map<string, Card> = new Map();

// Initialize the database with sample cards
function initializeDatabase() {
  const stored = localStorage.getItem('riftbound_card_database');
  if (stored) {
    const parsed: Card[] = JSON.parse(stored);
    cardDatabase = new Map(parsed.map(c => [c.cardId, c]));
  } else {
    cardDatabase = new Map(sampleCards.map(c => [c.cardId, c]));
    localStorage.setItem('riftbound_card_database', JSON.stringify(sampleCards));
  }
}

// Also index by card name for decklist matching
let nameIndex: Map<string, Card> = new Map();

function buildNameIndex() {
  nameIndex = new Map();
  cardDatabase.forEach(card => {
    nameIndex.set(card.cardName.toLowerCase(), card);
  });
}

initializeDatabase();
buildNameIndex();

export { sampleCards };
