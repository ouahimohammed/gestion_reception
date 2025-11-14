import { useState, useEffect } from 'react';
import { differenceInMonths } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Calculator, Package, Barcode, Palette, Edit, CalculatorIcon, Trash2, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { storage } from '../lib/storage';
import { useTheme } from '../components/theme-provider';
import { useTranslation } from '../lib/i18n';

export function ReceptionForm({ onReceptionAdded }) {
  const [productName, setProductName] = useState('');
  const [cartons, setCartons] = useState('');
  const [unitsPerCarton, setUnitsPerCarton] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productionDate, setProductionDate] = useState();
  const [expirationDate, setExpirationDate] = useState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // États pour le calcul automatique avec palettes multiples
  const [pallets, setPallets] = useState([
    { id: 1, cartonsPerRow: '', rowsPerLevel: '', cartonsPerPallet: '' }
  ]);
  const [useAutoCalculation, setUseAutoCalculation] = useState(false);

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

  // Calcul automatique du nombre de cartons par palette
  const calculateCartonsPerPallet = (cartonsPerRow, rowsPerLevel) => {
    if (cartonsPerRow && rowsPerLevel) {
      return parseInt(cartonsPerRow) * parseInt(rowsPerLevel);
    }
    return 0;
  };

  // Calcul du total des cartons de toutes les palettes
  const calculateTotalCartons = () => {
    return pallets.reduce((total, pallet) => {
      return total + (parseInt(pallet.cartonsPerPallet) || 0);
    }, 0);
  };

  // Mettre à jour les calculs automatiquement
  useEffect(() => {
    const updatedPallets = pallets.map(pallet => ({
      ...pallet,
      cartonsPerPallet: calculateCartonsPerPallet(pallet.cartonsPerRow, pallet.rowsPerLevel).toString()
    }));
    
    setPallets(updatedPallets);
    
    if (useAutoCalculation) {
      const totalCartons = calculateTotalCartons();
      if (totalCartons > 0) {
        setCartons(totalCartons.toString());
      }
    }
  }, [pallets, useAutoCalculation]);

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
        cartons: parseInt(cartons),
        units_per_carton: parseInt(unitsPerCarton),
        total_units: totalUnits,
        barcode,
        production_date: format(productionDate, 'yyyy-MM-dd'),
        expiration_date: format(expirationDate, 'yyyy-MM-dd'),
        shelf_life_months: shelfLifeMonths,
        status: calculateStatus(),
        created_at: new Date().toISOString(),
        // Sauvegarder les données de configuration des palettes multiples
        pallet_config: {
          pallets: pallets.map(pallet => ({
            cartons_per_row: parseInt(pallet.cartonsPerRow) || 0,
            rows_per_level: parseInt(pallet.rowsPerLevel) || 0,
            cartons_per_pallet: parseInt(pallet.cartonsPerPallet) || 0
          })),
          use_auto_calculation: useAutoCalculation,
          total_pallets: pallets.length
        }
      };

      storage.addReception(receptionData);
      
      // Réinitialiser le formulaire
      setProductName('');
      setCartons('');
      setUnitsPerCarton('');
      setBarcode('');
      setProductionDate(undefined);
      setExpirationDate(undefined);
      setPallets([{ id: 1, cartonsPerRow: '', rowsPerLevel: '', cartonsPerPallet: '' }]);
      setUseAutoCalculation(false);
      
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

  const handlePalletChange = (palletId, field, value) => {
    const numValue = value.replace(/\D/g, '');
    
    setPallets(prevPallets => 
      prevPallets.map(pallet => 
        pallet.id === palletId 
          ? { ...pallet, [field]: numValue }
          : pallet
      )
    );
  };

  const addPallet = () => {
    const newId = Math.max(...pallets.map(p => p.id), 0) + 1;
    setPallets(prev => [
      ...prev,
      { id: newId, cartonsPerRow: '', rowsPerLevel: '', cartonsPerPallet: '' }
    ]);
  };

  const removePallet = (palletId) => {
    if (pallets.length > 1) {
      setPallets(prev => prev.filter(pallet => pallet.id !== palletId));
    }
  };

  const handleManualCartonsChange = (value) => {
    setCartons(value);
    // Si l'utilisateur modifie manuellement les cartons, désactiver le calcul auto
    if (value && useAutoCalculation) {
      setUseAutoCalculation(false);
    }
  };

  const applyAutoCalculation = () => {
    const totalCartons = calculateTotalCartons();
    if (totalCartons > 0) {
      setCartons(totalCartons.toString());
      setUseAutoCalculation(true);
    }
  };

  const resetAutoCalculation = () => {
    setUseAutoCalculation(false);
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

          {/* Section Configuration des Palettes Multiples */}
          <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Configuration des Palettes ({pallets.length} palette{pallets.length > 1 ? 's' : ''})
              </h3>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addPallet}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-200 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une palette
                </button>
                
                <button
                  type="button"
                  onClick={applyAutoCalculation}
                  disabled={!pallets.some(p => p.cartonsPerRow && p.rowsPerLevel)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 text-sm"
                >
                  <CalculatorIcon className="h-4 w-4" />
                  Appliquer le calcul
                </button>
              </div>
            </div>

            {/* Liste des palettes */}
            <div className="space-y-4">
              {pallets.map((pallet, index) => (
                <div key={pallet.id} className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Palette {index + 1}
                    </h4>
                    {pallets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePallet(pallet.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                        title="Supprimer cette palette"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Cartons par rangée */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cartons par rangée
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pallet.cartonsPerRow}
                        onChange={(e) => handlePalletChange(pallet.id, 'cartonsPerRow', e.target.value)}
                        placeholder="Ex: 5"
                        className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-center transition-all duration-200"
                      />
                    </div>

                    {/* Rangées par niveau */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Rangées par niveau
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pallet.rowsPerLevel}
                        onChange={(e) => handlePalletChange(pallet.id, 'rowsPerLevel', e.target.value)}
                        placeholder="Ex: 4"
                        className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-center transition-all duration-200"
                      />
                    </div>

                    {/* Cartons par palette (calculé) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cartons par palette
                      </label>
                      <input
                        type="number"
                        value={pallet.cartonsPerPallet}
                        readOnly
                        placeholder="Calculé automatiquement"
                        className="w-full h-10 px-3 text-sm border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-semibold text-center transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* Résultat du calcul pour cette palette */}
                  {pallet.cartonsPerRow && pallet.rowsPerLevel && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                      <div className="text-sm text-green-700 dark:text-green-400 text-center">
                        <strong>Calcul :</strong> {pallet.cartonsPerRow} × {pallet.rowsPerLevel} = {pallet.cartonsPerPallet} cartons
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Résultat total */}
            {pallets.some(p => p.cartonsPerRow && p.rowsPerLevel) && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    Total : {calculateTotalCartons()} cartons
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Répartis sur {pallets.length} palette{pallets.length > 1 ? 's' : ''}
                  </div>
                  {useAutoCalculation && (
                    <div className="mt-2 text-green-600 dark:text-green-400 text-sm">
                      ✓ Appliqué automatiquement au nombre de cartons
                    </div>
                  )}
                </div>
              </div>
            )}
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
                onChange={(e) => handleManualCartonsChange(e.target.value)}
                required
                placeholder={translate('form.cartonsPlaceholder')}
                className={`w-full h-10 sm:h-12 px-3 sm:px-4 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center transition-all duration-200 backdrop-blur-sm ${
                  useAutoCalculation
                    ? 'border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-300 font-bold'
                    : 'border-gray-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white'
                }`}
              />
              <p className={`text-xs text-center ${
                useAutoCalculation
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-blue-600 dark:text-blue-400'
              }`}>
                {useAutoCalculation ? '✓ Calculé automatiquement' : '📝 Saisie manuelle'}
              </p>
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
