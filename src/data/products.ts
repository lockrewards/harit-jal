export interface ProductBottle {
  id: string;
  title: string;
  subtitle: string;
  category: 'glass' | 'pet' | 'finedining' | 'dhaba' | 'cafe' | 'banquet';
  categories: string[];
  size: '250ml' | '500ml' | '750ml_glass' | '1000ml';
  sizeLabel: string;
  material: string;
  capColor: string;
  capColorId: 'royal_gold' | 'emerald_green' | 'deep_blue' | 'pearl_white';
  labelTheme: 'classic_luxury' | 'dhaba_heritage' | 'bistro_minimal' | 'regal_crest';
  image: string;
  description: string;
  tablePlacement: string;
  wholesaleRate: number;
  recommendedMRP: number;
}

export const PRODUCT_COLLECTIONS: ProductBottle[] = [
  {
    id: 'classic-500ml-glass',
    title: '500ml Classic Dining Glass Bottle',
    subtitle: 'Boutique Restaurants & Upscale Dining',
    category: 'finedining',
    categories: ['glass', 'finedining'],
    size: '500ml',
    sizeLabel: '500ml Dine-In Glass',
    material: 'Ultra-Clear Flint Glass',
    capColor: 'Polished Champagne Gold',
    capColorId: 'royal_gold',
    labelTheme: 'classic_luxury',
    image: '/images/products/product-500ml-glass.jpg',
    description: 'Cylindrical crystal-clear glass bottle with chilled condensation beads, designed for upscale restaurant dining tables.',
    tablePlacement: 'Fine dining rooms, boutique bistros & tasting menus',
    wholesaleRate: 14.0,
    recommendedMRP: 40.0,
  },
  {
    id: 'decanter-750ml-glass',
    title: '750ml Grand Reserve Decanter',
    subtitle: 'Palace Dining & VIP Hospitality',
    category: 'banquet',
    categories: ['glass', 'banquet', 'finedining'],
    size: '750ml_glass',
    sizeLabel: '750ml Heavy Decanter',
    material: 'Fluted Flint Glass',
    capColor: 'Royal Gold Stopper Cap',
    capColorId: 'royal_gold',
    labelTheme: 'regal_crest',
    image: '/images/products/product-750ml-decanter.jpg',
    description: 'Opulent fluted decanter crafted for VIP banquet tables, palace feasts, and luxury tableware settings.',
    tablePlacement: 'Wedding banquets, five-star hotel dining & gala ballrooms',
    wholesaleRate: 24.0,
    recommendedMRP: 60.0,
  },
  {
    id: 'cafe-250ml-pet',
    title: '250ml Artisanal Cafe Pocket Bottle',
    subtitle: 'Specialty Cafes & Modern QSR',
    category: 'cafe',
    categories: ['pet', 'cafe'],
    size: '250ml',
    sizeLabel: '250ml Pocket rPET',
    material: 'Food-Grade Recyclable rPET',
    capColor: 'Midnight Navy Cap',
    capColorId: 'deep_blue',
    labelTheme: 'bistro_minimal',
    image: '/images/products/product-250ml-cafe.jpg',
    description: 'Compact bottle with minimalist Scandinavian label and dynamic QR code linking guests to your digital seasonal menu.',
    tablePlacement: 'Espresso coffee bars, takeaway bags & patio brunch',
    wholesaleRate: 6.5,
    recommendedMRP: 20.0,
  },
  {
    id: 'dhaba-1000ml-pet',
    title: '1000ml Heritage Dhaba Family Bottle',
    subtitle: 'Highway Dining & Family Feast Tables',
    category: 'dhaba',
    categories: ['pet', 'dhaba'],
    size: '1000ml',
    sizeLabel: '1000ml Family Format',
    material: 'Food-Grade Virgin & Recyclable PET',
    capColor: 'Forest Olive Green Cap',
    capColorId: 'emerald_green',
    labelTheme: 'dhaba_heritage',
    image: '/images/products/product-1000ml-dhaba.jpg',
    description: 'Robust 1-litre family format with amber-gold heritage branding, built for high-turnover dhaba and resort tables.',
    tablePlacement: 'Highway dhabas, family resorts & outdoor lawn dining',
    wholesaleRate: 11.0,
    recommendedMRP: 30.0,
  },
  {
    id: 'hotel-500ml-executive',
    title: '500ml Hotel Executive Dining Bottle',
    subtitle: 'Metropolitan Hotels & Corporate Lounges',
    category: 'finedining',
    categories: ['glass', 'finedining'],
    size: '500ml',
    sizeLabel: '500ml Executive Glass',
    material: 'Contemporary Clear Glass',
    capColor: 'Brushed Metallic Silver',
    capColorId: 'royal_gold',
    labelTheme: 'classic_luxury',
    image: '/images/products/product-500ml-executive.jpg',
    description: 'Sleek contemporary glass bottle with deep royal navy foil labeling for luxury hotel dining and executive boardrooms.',
    tablePlacement: 'Metropolitan hotel dining, executive lounges & summits',
    wholesaleRate: 15.0,
    recommendedMRP: 45.0,
  },
  {
    id: 'banquet-750ml-celebration',
    title: '750ml Grand Banquet Celebration Bottle',
    subtitle: 'Luxury Weddings & Grand Receptions',
    category: 'banquet',
    categories: ['glass', 'banquet'],
    size: '750ml_glass',
    sizeLabel: '750ml Celebration Glass',
    material: 'Pristine Heavy Glass',
    capColor: 'Champagne Gold Cap',
    capColorId: 'royal_gold',
    labelTheme: 'regal_crest',
    image: '/images/products/product-750ml-banquet.jpg',
    description: 'Bespoke banquet edition with ivory and champagne-gold branding, tailored to harmonize with luxury wedding decor.',
    tablePlacement: 'Palace wedding banquets, corporate summits & gala dinners',
    wholesaleRate: 22.0,
    recommendedMRP: 55.0,
  },
];

