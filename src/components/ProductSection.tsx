import { MenuItem } from '@/types/menu';
import ProductCard from './ProductCard';

interface ProductSectionProps {
  title: string;
  items: MenuItem[];
  showViewAll?: boolean;
}

const ProductSection = ({ title, items, showViewAll = false }: ProductSectionProps) => {
  return (
    <section className="px-4 mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {showViewAll && (
          <button className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ver todos
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};

export default ProductSection;
