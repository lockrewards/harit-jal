export interface GalleryItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  category: 'glass' | 'pet' | 'finedining' | 'dhaba' | 'cafe' | 'banquet';
  categories: string[];
  size: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  sizeLabel: string;
  material: string;
  capColor: string;
  wholesaleRate?: number;
  recommendedMRP?: number;
  badge?: string;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'harit_jal_gallery_catalog_v1';

export const DEFAULT_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'spiral-fluted-carafe',
    title: 'Spiral Fluted Carafe',
    subtitle: 'Murthal Highway Dining & Premium Dhabas',
    description: 'Signature spiral-fluted tapered carafe in heavy flint glass with polished champagne gold crown cap. Designed for high-volume highway tables and fine dining.',
    image: '/images/bottles/spiral_wave_studio.jpg',
    category: 'glass',
    categories: ['glass', 'dhaba', 'finedining'],
    size: '500ml',
    sizeLabel: '500ml Dine-In Glass',
    material: 'Flint Glass Carafe',
    capColor: 'Champagne Gold',
    wholesaleRate: 14.5,
    recommendedMRP: 40.0,
    badge: 'Signature Swirl',
    isVisible: true,
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'royal-darbar-decanter',
    title: 'Royal Darbar Decanter',
    subtitle: 'Palace Banquets, VIP Lounges & Wedding Feasts',
    description: 'Classic rounded-shoulder heavy glass decanter with ornate golden embossed palace crest. Delivers unmatched five-star majesty to luxury dining tables.',
    image: '/images/bottles/royal_darbar_studio.jpg',
    category: 'banquet',
    categories: ['glass', 'banquet', 'finedining'],
    size: '750ml_glass',
    sizeLabel: '750ml Heavy Decanter',
    material: 'Ultra-Clear Flint Glass',
    capColor: 'Royal Gold Stopper',
    wholesaleRate: 24.0,
    recommendedMRP: 60.0,
    badge: 'Royal Decanter',
    isVisible: true,
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cafe-terra-artisanal',
    title: 'Cafe Terra Artisanal Frosted',
    subtitle: 'Specialty Coffee Bars & Modern Urban Bistros',
    description: 'Satin velvet frosted mist glass bottle with botanical gold-leaf motif and scannable QR code linking diners to your seasonal digital menu.',
    image: '/images/bottles/frosted_mist_studio.jpg',
    category: 'cafe',
    categories: ['glass', 'cafe'],
    size: '250ml',
    sizeLabel: '250ml Pocket Mist',
    material: 'Frosted Translucent Mist Glass',
    capColor: 'Champagne Gold Cap',
    wholesaleRate: 11.0,
    recommendedMRP: 30.0,
    badge: 'Frosted Mist',
    isVisible: true,
    order: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grand-sapphire-slim',
    title: 'Grand Sapphire Slim Cylinder',
    subtitle: 'Executive Suites, Rooftop Bars & Five-Star Hotels',
    description: 'Nordic straight cylinder with royal navy wrap and geometric foil mandala. Engineered for modern contemporary dining and boutique table settings.',
    image: '/images/bottles/grand_sapphire_studio.jpg',
    category: 'finedining',
    categories: ['glass', 'finedining'],
    size: '500ml',
    sizeLabel: '500ml Slim Cylinder',
    material: 'Nordic Straight Flint Glass',
    capColor: 'Polished Gold Cap',
    wholesaleRate: 15.0,
    recommendedMRP: 45.0,
    badge: 'Nordic Cylinder',
    isVisible: true,
    order: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'vintage-heritage-arch',
    title: 'Vintage Heritage Arch',
    subtitle: 'Highway Diners, Resorts & Multi-Cuisine Family Tables',
    description: 'Heavy-base estate cylinder with arch crest and landscape engraving. Durable, elegant, and designed for memorable family gatherings.',
    image: '/images/bottles/heritage_arch_studio.jpg',
    category: 'dhaba',
    categories: ['glass', 'dhaba'],
    size: '1000ml',
    sizeLabel: '1000ml Family Estate',
    material: 'Heavy-Base Estate Glass',
    capColor: 'Polished Brass Gold',
    wholesaleRate: 18.0,
    recommendedMRP: 50.0,
    badge: 'Estate Arch',
    isVisible: true,
    order: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'diamond-cut-crystal',
    title: 'Diamond-Cut Crystal Silhouette',
    subtitle: 'Gala Receptions, Night Lounges & Luxury Celebrations',
    description: 'Prismatic geometric diamond facets reflecting ambient dining candlelight. Paired with a regal navy-and-gold crest for upscale celebrations.',
    image: '/images/bottles/diamond_cut_studio.jpg',
    category: 'banquet',
    categories: ['glass', 'banquet', 'finedining'],
    size: '750ml_glass',
    sizeLabel: '750ml Faceted Crystal',
    material: 'Prismatic Faceted Glass',
    capColor: 'Mirror Gold Cap',
    wholesaleRate: 26.0,
    recommendedMRP: 65.0,
    badge: 'Faceted Crystal',
    isVisible: true,
    order: 6,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'contoured-wave-decanter',
    title: 'Contoured Wave Decanter',
    subtitle: 'Boutique Hotels, Chef Counters & Sommelier Pairings',
    description: 'Sculpted curved wave lines in pure flint glass. Ergonomic pour grip designed for sommelier water pairings and fine dining banquets.',
    image: '/images/bottles/contoured_spiral_studio.jpg',
    category: 'glass',
    categories: ['glass', 'finedining'],
    size: '500ml',
    sizeLabel: '500ml Curved Decanter',
    material: 'Sculpted Fluted Glass',
    capColor: 'Champagne Gold Stopper',
    wholesaleRate: 16.0,
    recommendedMRP: 45.0,
    badge: 'Contoured Wave',
    isVisible: true,
    order: 7,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'classic-dining-table-bottle',
    title: 'Classic Chilled Dining Glass Bottle',
    subtitle: 'Casual Dining, Continental Cafes & Pizzerias',
    description: 'Crystal-clear glass bottle with natural chilled condensation drops, engineered for everyday upscale dining tables.',
    image: '/images/products/product-500ml-glass.jpg',
    category: 'finedining',
    categories: ['glass', 'finedining'],
    size: '500ml',
    sizeLabel: '500ml Dine-In Glass',
    material: 'Ultra-Clear Flint Glass',
    capColor: 'Champagne Gold',
    wholesaleRate: 14.0,
    recommendedMRP: 40.0,
    badge: 'Dine-In Classic',
    isVisible: true,
    order: 8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'artisan-cafe-rpet',
    title: 'Artisanal Cafe Grab-and-Go',
    subtitle: 'Takeaway Counters, Garden Patios & Coffee Bars',
    description: 'Recyclable food-grade pocket bottle with Scandinavian typography and dynamic QR linking to menus or loyalty programs.',
    image: '/images/products/product-250ml-cafe.jpg',
    category: 'pet',
    categories: ['pet', 'cafe'],
    size: '250ml',
    sizeLabel: '250ml Pocket rPET',
    material: 'Food-Grade Recyclable rPET',
    capColor: 'Midnight Navy',
    wholesaleRate: 7.5,
    recommendedMRP: 20.0,
    badge: 'Eco Pocket',
    isVisible: true,
    order: 9,
    createdAt: new Date().toISOString(),
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Gallery service listener error:', e);
    }
  });
}

export const GalleryService = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getAllItems(): GalleryItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse gallery items from storage:', e);
    }
    // Seed default items
    this.saveAllItems(DEFAULT_GALLERY_ITEMS);
    return DEFAULT_GALLERY_ITEMS;
  },

  getPublicItems(): GalleryItem[] {
    return this.getAllItems()
      .filter((item) => item.isVisible !== false)
      .sort((a, b) => a.order - b.order);
  },

  saveAllItems(items: GalleryItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      notify();
    } catch (e) {
      console.error('Failed to save gallery items:', e);
    }
  },

  addItem(newItem: Omit<GalleryItem, 'id' | 'createdAt' | 'order'>): GalleryItem {
    const all = this.getAllItems();
    const item: GalleryItem = {
      ...newItem,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order: all.length + 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...all, item];
    this.saveAllItems(updated);
    return item;
  },

  updateItem(id: string, updates: Partial<GalleryItem>): boolean {
    const all = this.getAllItems();
    const index = all.findIndex((i) => i.id === id);
    if (index === -1) return false;
    all[index] = {
      ...all[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveAllItems(all);
    return true;
  },

  toggleVisibility(id: string): boolean {
    const all = this.getAllItems();
    const item = all.find((i) => i.id === id);
    if (!item) return false;
    item.isVisible = !item.isVisible;
    item.updatedAt = new Date().toISOString();
    this.saveAllItems(all);
    return item.isVisible;
  },

  deleteItem(id: string): boolean {
    const all = this.getAllItems();
    if (all.length <= 1) {
      alert('The gallery must have at least one product.');
      return false;
    }
    const updated = all.filter((i) => i.id !== id);
    this.saveAllItems(updated);
    return true;
  },

  resetToDefault() {
    this.saveAllItems(DEFAULT_GALLERY_ITEMS);
  },
};

