// lib/storage.js
export const storage = {
  getReceptions: () => {
    try {
      const stored = localStorage.getItem('warehouse-receptions');
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.error('Error reading receptions:', error);
      return [];
    }
  },

  addReception: (receptionData) => {
    try {
      const receptions = storage.getReceptions();
      const newReception = {
        ...receptionData,
        id: Math.random().toString(36).substring(2, 11),
      };
      receptions.push(newReception);
      localStorage.setItem('warehouse-receptions', JSON.stringify(receptions));
    } catch (error) {
      console.error('Error adding reception:', error);
      throw new Error('Failed to add reception');
    }
  },

  deleteReception: (id) => {
    try {
      const receptions = storage.getReceptions();
      const filtered = receptions.filter(reception => reception.id !== id);
      localStorage.setItem('warehouse-receptions', JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting reception:', error);
      throw new Error('Failed to delete reception');
    }
  },

  updateReception: (id, updates) => {
    try {
      const receptions = storage.getReceptions();
      const updated = receptions.map(reception =>
        reception.id === id ? { ...reception, ...updates } : reception
      );
      localStorage.setItem('warehouse-receptions', JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating reception:', error);
      throw new Error('Failed to update reception');
    }
  }
};