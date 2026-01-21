import { motion } from 'framer-motion';

// Define the shape of a Category object
interface Category {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: Category[]; // NEW: Accept the list of categories
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const CategoryTabs = ({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) => {
  return (
    <div className="flex gap-2 px-4 py-4 overflow-x-auto scrollbar-hide">
      {categories.map((category, index) => (
        <motion.button
          key={category.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCategoryChange(category.id)}
          className={`relative px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
            activeCategory === category.id
              ? 'text-primary-foreground shadow-md'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
        >
          {activeCategory === category.id && (
            <motion.div
              layoutId="activeCategory"
              className="absolute inset-0 bg-primary rounded-full"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{category.name}</span>
        </motion.button>
      ))}
    </div>
  );
};

export default CategoryTabs;