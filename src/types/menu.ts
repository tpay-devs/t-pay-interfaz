export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  badge?: 'hot' | 'discount' | 'popular' | 'night';
  discountPercent?: number;
  ingredients: string[];
  extras: { name: string; price: number }[];
}