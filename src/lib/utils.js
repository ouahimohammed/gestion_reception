import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// 🧩 دالة cn: كتدمج الكلاسات بطريقة ذكية (Tailwind + شرطية)
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Fonctions utilitaires supplémentaires
export const formatDate = (date) => {
  if (!date) return '';
  
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  return date.toLocaleDateString('fr-FR');
};

export const calculateExpirationDate = (productionDate, shelfLifeMonths) => {
  if (!productionDate || !shelfLifeMonths) return null;
  
  const date = new Date(productionDate);
  date.setMonth(date.getMonth() + parseInt(shelfLifeMonths));
  return date;
};

export const calculateStatus = (expirationDate) => {
  if (!expirationDate) return 'ok';
  
  const today = new Date();
  const expiration = new Date(expirationDate);
  const timeDiff = expiration.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff < 0) return 'expired';
  if (daysDiff < 30) return 'passedThird'; // Moins d'un mois
  return 'ok';
};

export const generateBarcode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const calculateTotalUnits = (cartons, unitsPerCarton) => {
  return parseInt(cartons || 0) * parseInt(unitsPerCarton || 0);
};

// Validation functions
export const validateForm = (formData) => {
  const errors = {};
  
  if (!formData.productName?.trim()) {
    errors.productName = 'Product name is required';
  }
  
  if (!formData.cartons || formData.cartons <= 0) {
    errors.cartons = 'Number of cartons must be greater than 0';
  }
  
  if (!formData.unitsPerCarton || formData.unitsPerCarton <= 0) {
    errors.unitsPerCarton = 'Units per carton must be greater than 0';
  }
  
  if (!formData.productionDate) {
    errors.productionDate = 'Production date is required';
  }
  
  if (!formData.expirationDate) {
    errors.expirationDate = 'Expiration date is required';
  }
  
  return errors;
};

// Storage utilities
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
};

// Export utilities as default object
const utils = {
  cn,
  formatDate,
  calculateExpirationDate,
  calculateStatus,
  generateBarcode,
  calculateTotalUnits,
  validateForm,
  storage
};

export default utils;