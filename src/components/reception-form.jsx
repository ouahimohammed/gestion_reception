import { useState } from 'react';
import { differenceInMonths } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Calculator, Package, Barcode, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { storage } from '../lib/storage';
import { useTheme } from '../components/theme-provider';
import { useTranslation } from '../lib/i18n';

export function ReceptionForm({ onReceptionAdded }) {
  const [productName, setProductName] = useState('');
  const [palletNumber, setPalletNumber] = useState('');
  const [cartons, setCartons] = useState('');
  const [unitsPerCarton, setUnitsPerCarton] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productionDate, setProductionDate] = useState();
  const [expirationDate, setExpirationDate] = useState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { language } = useTheme();
  const t = useTranslation();
  
  const translate = (key) => {
    try {
      return t(language, key) || key;
    } catch (error) {
      console.warn('Translation error for key:', key, error);
      return key;
    }
  };

  const totalUnits = cartons && unitsPerCarton
    ? parseInt(cartons) * parseInt(unitsPerCarton)
    : 0;

  const shelfLifeMonths = productionDate && expirationDate
    ? differenceInMonths(expirationDate, productionDate)
    : 0;

  const calculateStatus = () => {
    if (!productionDate || !expirationDate) return translate('status.ok');

    const now = new Date();
    const oneThirdShelfLife = shelfLifeMonths / 3;
    const monthsSinceProduction = differenceInMonths(now, productionDate);

    if (now >= expirationDate) {
      return translate('status.expired');
    } else if (monthsSinceProduction >= oneThirdShelfLife) {
      return translate('status.passedThird');
    }
    return translate('status.ok');
  };

  const getStatusColor = (status) => {
    const passedStatus = translate('status.passedThird');
    const expiredStatus = translate('status.expired');
    
    if (status === expiredStatus) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (status === passedStatus) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productionDate || !expirationDate) {
      alert(translate('form.requiredDates'));
      return;
    }

    setIsSubmitting(true);

    try {
      const receptionData = {
        product_name: productName,
        pallet_number: palletNumber || null,
        cartons: parseInt(cartons),
        units_per_carton: parseInt(unitsPerCarton),
        total_units: totalUnits,
        barcode,
        production_date: format(productionDate, 'yyyy-MM-dd'),
        expiration_date: format(expirationDate, 'yyyy-MM-dd'),
        shelf_life_months: shelfLifeMonths,
        status: calculateStatus(),
        created_at: new Date().toISOString(),
      };

      storage.addReception(receptionData);
      
      // Réinitialiser le formulaire
      setProductName('');
      setPalletNumber('');
      setCartons('');
      setUnitsPerCarton('');
      setBarcode('');
      setProductionDate(undefined);
      setExpirationDate(undefined);
      
      onReceptionAdded();
    } catch (error) {
      alert(translate('form.addingError') || 'Erreur lors de l\'ajout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const handleDateInputChange = (type, value) => {
    const date = value ? new Date(value) : undefined;
    if (type === 'production') {
      setProductionDate(date);
    } else {
      setExpirationDate(date);
    }
  };

  const isFormReady = productName && cartons && unitsPerCarton && barcode && productionDate && expirationDate;

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/25">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {translate('form.title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Ajoutez de nouvelles réceptions de produits
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            📦 Nouvelle Réception
          </span>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Section Informations Produit */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {/* Nom du produit */}
            <div className="space-y-2 sm:space-y-3 lg:col-span-2">
              <label htmlFor="productName" className="text-sm sm:text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Package className="h-4 w-4" />
                {translate('form.productName')}
              </label>
              <input
                id="productName"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                placeholder={translate('form.productNamePlaceholder')}
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white transition-all duration-200 backdrop-blur-sm"
              />
            </div>

            {/* Numéro de palette */}
            {/* <div className="space-y-2 sm:space-y-3">
              <label htmlFor="palletNumber" className="text-sm sm:text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Palette className="h-4 w-4" />
                {translate('table.columns.palette')}
              </label>
              <input
                id="palletNumber"
                type="text"
                value={palletNumber}
                onChange={(e) => setPalletNumber(e.target.value)}
                placeholder="PAL-001"
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white font-mono transition-all duration-200 backdrop-blur-sm"
              />
            </div> */}

            {/* Code-barres */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="barcode" className="text-sm sm:text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Barcode className="h-4 w-4" />
                {translate('form.barcode')}
              </label>
              <input
                id="barcode"
                type="text"
                maxLength={6}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
                required
                placeholder={translate('form.barcodePlaceholder')}
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white font-mono text-center transition-all duration-200 backdrop-blur-sm"
              />
            </div>
          </div>

          {/* Section Quantités */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Cartons */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="cartons" className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {translate('form.cartons')}
              </label>
              <input
                id="cartons"
                type="number"
                min="1"
                value={cartons}
                onChange={(e) => setCartons(e.target.value)}
                required
                placeholder={translate('form.cartonsPlaceholder')}
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white text-center transition-all duration-200 backdrop-blur-sm"
              />
            </div>

            {/* Unités par carton */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="unitsPerCarton" className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {translate('form.unitsPerCarton')}
              </label>
              <input
                id="unitsPerCarton"
                type="number"
                min="1"
                value={unitsPerCarton}
                onChange={(e) => setUnitsPerCarton(e.target.value)}
                required
                placeholder={translate('form.unitsPerCartonPlaceholder')}
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white text-center transition-all duration-200 backdrop-blur-sm"
              />
            </div>

            {/* Unités totales */}
            <div className="space-y-2 sm:space-y-3">
              <label className="text-sm sm:text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
                {translate('form.totalUnits')}
              </label>
              <input
                value={totalUnits.toLocaleString()}
                disabled
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-blue-200 dark:border-blue-800 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 font-bold text-center transition-all duration-200"
              />
            </div>

            {/* Statut */}
            <div className="space-y-2 sm:space-y-3">
              <label className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {translate('form.status')}
              </label>
              <div>
                <span className={`inline-flex w-full justify-center items-center py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-lg ${getStatusColor(calculateStatus())}`}>
                  {calculateStatus()}
                </span>
              </div>
            </div>
          </div>

          {/* Section Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Date de production */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="productionDate" className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {translate('form.productionDate')}
              </label>
              <div className="flex gap-2">
                <input
                  id="productionDate"
                  type="date"
                  value={formatDateForInput(productionDate)}
                  onChange={(e) => handleDateInputChange('production', e.target.value)}
                  className="flex-1 h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white transition-all duration-200 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Date d'expiration */}
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="expirationDate" className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {translate('form.expirationDate')}
              </label>
              <div className="flex gap-2">
                <input
                  id="expirationDate"
                  type="date"
                  value={formatDateForInput(expirationDate)}
                  onChange={(e) => handleDateInputChange('expiration', e.target.value)}
                  className="flex-1 h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white transition-all duration-200 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Durée de vie */}
            <div className="space-y-2 sm:space-y-3">
              <label className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {translate('form.shelfLife')}
              </label>
              <input
                value={`${shelfLifeMonths} mois`}
                disabled
                className="w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50/50 dark:bg-gray-900/20 text-gray-900 dark:text-white text-center transition-all duration-200 backdrop-blur-sm"
              />
            </div>

            {/* Bouton d'action */}
            <div className="space-y-2 sm:space-y-3 flex items-end">
              <button
                type="submit"
                disabled={isSubmitting || !isFormReady}
                className="w-full h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <div className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm sm:text-base">{translate('form.adding')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base">{translate('form.addButton')}</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Indicateur de progression */}
          <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-800 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-blue-700 dark:text-blue-300 text-center sm:text-left">
                Tous les champs sont requis pour ajouter une réception
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                isFormReady 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
              }`}>
                {isFormReady ? "✅ Prêt" : "⏳ En attente"}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}