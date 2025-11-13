import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Search, Trash2, Download, Filter, ArrowUpDown, ChevronUp, ChevronDown, Package, Box, Calculator, Barcode, Calendar, AlertTriangle, CheckCircle, XCircle, Printer, Palette, Edit, Save, X } from 'lucide-react';
import { storage } from '../lib/storage';
import { useTheme } from './theme-provider';
import { useTranslation } from '../lib/i18n';

// Import jsPDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function ReceptionTable({ refreshTrigger }) {
  const [receptions, setReceptions] = useState([]);
  const [filteredReceptions, setFilteredReceptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [editingPallet, setEditingPallet] = useState(null);
  const [editPalletData, setEditPalletData] = useState({
    cartons_per_row: '',
    rows_per_level: '',
    number_of_pallets: ''
  });

  const { language } = useTheme();
  const t = useTranslation();
  
  const translate = (key) => {
    try {
      if (!key || key === undefined) {
        console.warn('Translation key is undefined or empty');
        return 'Missing key';
      }
      return t(language, key) || key;
    } catch (error) {
      console.warn('Translation error for key:', key, error);
      return key || 'Translation error';
    }
  };

  const fetchReceptions = () => {
    setIsLoading(true);
    try {
      const data = storage.getReceptions();
      const sorted = [...data].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setReceptions(sorted);
      setFilteredReceptions(sorted);
    } catch (error) {
      console.error('Error fetching receptions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceptions();
  }, [refreshTrigger]);

  useEffect(() => {
    let filtered = receptions.filter((reception) =>
      Object.values(reception).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    if (statusFilter !== 'all') {
      filtered = filtered.filter(reception => reception.status === statusFilter);
    }

    setFilteredReceptions(filtered);
  }, [searchTerm, receptions, statusFilter]);

  const handleSort = (field) => {
    const direction =
      sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(direction);

    const sorted = [...filteredReceptions].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return direction === 'asc' ? -1 : 1;
      if (bValue == null) return direction === 'asc' ? 1 : -1;
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredReceptions(sorted);
  };

  const handleDelete = (id) => {
    const confirmMessage = translate('table.deleteConfirm');
    if (confirm(confirmMessage)) {
      try {
        storage.deleteReception(id);
        fetchReceptions();
      } catch (error) {
        const errorMessage = translate('table.deleteError');
        alert(errorMessage);
      }
    }
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    
    const passedStatus = translate('status.passedThird');
    const expiredStatus = translate('status.expired');
    
    if (status === expiredStatus) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (status === passedStatus) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  };

  const getStatusIcon = (status) => {
    if (!status) return <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
    
    const passedStatus = translate('status.passedThird');
    const expiredStatus = translate('status.expired');
    
    switch (status) {
      case expiredStatus: return <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
      case passedStatus: return <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />;
      default: return <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
    }
  };

  const calculateTotalUnits = () => {
    return filteredReceptions.reduce((total, reception) => total + (reception.total_units || 0), 0);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />;
    return sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />;
  };

  // Fonction pour démarrer l'édition
  const startEditPallet = (reception) => {
    setEditingPallet(reception.id);
    setEditPalletData({
      cartons_per_row: reception.pallet_config?.cartons_per_row || '',
      rows_per_level: reception.pallet_config?.rows_per_level || '',
      number_of_pallets: reception.pallet_config?.number_of_pallets || ''
    });
  };

  // Fonction pour annuler l'édition
  const cancelEditPallet = () => {
    setEditingPallet(null);
    setEditPalletData({
      cartons_per_row: '',
      rows_per_level: '',
      number_of_pallets: ''
    });
  };

  // Fonction pour sauvegarder les modifications
  const saveEditPallet = (receptionId) => {
    try {
      const updatedReception = receptions.find(r => r.id === receptionId);
      if (updatedReception) {
        // Calculer le nouveau nombre de cartons si tous les champs sont remplis
        let newCartons = updatedReception.cartons;
        if (editPalletData.cartons_per_row && editPalletData.rows_per_level && editPalletData.number_of_pallets) {
          newCartons = parseInt(editPalletData.cartons_per_row) * 
                       parseInt(editPalletData.rows_per_level) * 
                       parseInt(editPalletData.number_of_pallets);
        }

        const updatedData = {
          ...updatedReception,
          cartons: newCartons,
          total_units: newCartons * updatedReception.units_per_carton,
          pallet_config: {
            ...updatedReception.pallet_config,
            cartons_per_row: parseInt(editPalletData.cartons_per_row) || 0,
            rows_per_level: parseInt(editPalletData.rows_per_level) || 0,
            number_of_pallets: parseInt(editPalletData.number_of_pallets) || 0,
            use_auto_calculation: true
          }
        };

        storage.updateReception(receptionId, updatedData);
        fetchReceptions();
        setEditingPallet(null);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour des données de palette');
    }
  };

  // Fonction pour afficher la configuration de palette
  // Dans la fonction renderPalletConfig du ReceptionTable.js, modifiez cette partie :

// Fonction pour afficher la configuration de palette
const renderPalletConfig = (reception) => {
  if (!reception.pallet_config) {
    return (
      <div className="text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">Non configuré</span>
        <button
          onClick={() => startEditPallet(reception)}
          className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          <Edit className="h-3 w-3" />
          Ajouter
        </button>
      </div>
    );
  }
  
  const { cartons_per_row, rows_per_level, number_of_pallets, cartons_per_pallet } = reception.pallet_config;
  
  if (editingPallet === reception.id) {
    return (
      <div className="space-y-2 p-2 bg-white dark:bg-gray-800 rounded border">
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">Rangée</label>
            <input
              type="number"
              value={editPalletData.cartons_per_row}
              onChange={(e) => setEditPalletData(prev => ({...prev, cartons_per_row: e.target.value}))}
              placeholder="Rangée"
              className="w-full px-1 py-1 border rounded text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">Niveau</label>
            <input
              type="number"
              value={editPalletData.rows_per_level}
              onChange={(e) => setEditPalletData(prev => ({...prev, rows_per_level: e.target.value}))}
              placeholder="Niveau"
              className="w-full px-1 py-1 border rounded text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">Palettes</label>
            <input
              type="number"
              value={editPalletData.number_of_pallets}
              onChange={(e) => setEditPalletData(prev => ({...prev, number_of_pallets: e.target.value}))}
              placeholder="Palettes"
              className="w-full px-1 py-1 border rounded text-center"
            />
          </div>
        </div>
        
        {/* Calcul automatique en temps réel */}
        {editPalletData.cartons_per_row && editPalletData.rows_per_level && (
          <div className="text-xs text-green-600 dark:text-green-400 text-center">
            {editPalletData.cartons_per_row} × {editPalletData.rows_per_level} = {editPalletData.cartons_per_row * editPalletData.rows_per_level} cartons/palette
          </div>
        )}
        
        <div className="flex gap-1 justify-center">
          <button
            onClick={() => saveEditPallet(reception.id)}
            className="p-1 bg-green-500 hover:bg-green-600 text-white rounded"
            title="Sauvegarder"
          >
            <Save className="h-3 w-3" />
          </button>
          <button
            onClick={cancelEditPallet}
            className="p-1 bg-red-500 hover:bg-red-600 text-white rounded"
            title="Annuler"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (!cartons_per_row || !rows_per_level) {
    return (
      <div className="text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">Configuration incomplète</span>
        <button
          onClick={() => startEditPallet(reception)}
          className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          <Edit className="h-3 w-3" />
          Modifier
        </button>
      </div>
    );
  }
  
  const calculatedCartonsPerPallet = cartons_per_row * rows_per_level;
  const calculatedTotalCartons = calculatedCartonsPerPallet * (number_of_pallets || 1);
  const matchesActual = calculatedTotalCartons === reception.cartons;
  
  return (
    <div className="text-center group">
      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <div>
          <span className="font-medium">{cartons_per_row} × {rows_per_level}</span>
          <div className="text-[10px] text-green-600 dark:text-green-400">
            = {calculatedCartonsPerPallet} cartons/palette
          </div>
        </div>
        {number_of_pallets && (
          <div>
            <span className="font-medium">× {number_of_pallets} palettes</span>
            <div className="text-[10px] text-blue-600 dark:text-blue-400">
              = {calculatedTotalCartons} cartons totaux
            </div>
          </div>
        )}
        {matchesActual ? (
          <div className="text-green-600 dark:text-green-400 text-[10px] mt-1">
            ✓ Correspond aux cartons
          </div>
        ) : (
          <div className="text-orange-600 dark:text-orange-400 text-[10px] mt-1">
            ⚠️ Différent des cartons
          </div>
        )}
      </div>
      <button
        onClick={() => startEditPallet(reception)}
        className="mt-1 opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-all"
      >
        <Edit className="h-3 w-3" />
        Modifier
      </button>
    </div>
  );
};
  // Fonction pour générer le PDF
  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      
      const totalUnits = calculateTotalUnits();
      
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text(translate('pdf.title'), 105, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`${translate('pdf.generatedOn')} ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 105, 22, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(`${translate('pdf.receptionsCount')}: ${filteredReceptions.length}`, 14, 35);
      doc.text(`${translate('pdf.totalUnits')}: ${totalUnits.toLocaleString()}`, 14, 42);

      const headers = [
        translate('table.columns.product'),
        translate('table.columns.cartons'),
        translate('table.columns.unitsPerCarton'),
        translate('table.columns.totalUnits'),
        translate('table.columns.barcode'),
        translate('table.columns.production'),
        translate('table.columns.expiration'),
        translate('table.columns.status')
      ];

      const data = filteredReceptions.map(reception => [
        reception.product_name || '',
        (reception.cartons || 0).toString(),
        (reception.units_per_carton || 0).toString(),
        (reception.total_units || 0).toLocaleString(),
        reception.barcode || '',
        reception.production_date ? format(new Date(reception.production_date), 'dd/MM/yyyy') : '',
        reception.expiration_date ? format(new Date(reception.expiration_date), 'dd/MM/yyyy') : '',
        reception.status || ''
      ]);

      autoTable(doc, {
        startY: 50,
        head: [headers],
        body: data,
        theme: 'grid',
        styles: { 
          fontSize: 8, 
          cellPadding: 2,
          textColor: [0, 0, 0]
        },
        headStyles: { 
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: { 
          fillColor: [245, 245, 245] 
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 15 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 18 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 15 }
        }
      });

      const finalY = doc.lastAutoTable?.finalY + 10 || 100;
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.setFont(undefined, 'bold');
      doc.text(`${translate('pdf.generalTotal')}: ${totalUnits.toLocaleString()} ${translate('table.columns.totalUnits').toLowerCase()}`, 14, finalY);

      doc.save(`rapport-receptions-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert(translate('pdf.error'));
    }
  };

  // Fonction pour ouvrir la modal de sélection
  const openDateModal = () => {
    setShowDateModal(true);
    setSelectedProduct('');
  };

  // Fonction pour générer la date d'expiration en gros
  const generateExpirationDatePDF = () => {
    if (!selectedProduct) {
      alert('Veuillez sélectionner un produit');
      return;
    }

    try {
      const reception = filteredReceptions.find(r => r.id === selectedProduct);
      if (!reception || !reception.expiration_date) {
        alert('Date d\'expiration non trouvée pour ce produit');
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const expirationDate = new Date(reception.expiration_date);
      const month = (expirationDate.getMonth() + 1).toString().padStart(2, '0');
      const year = expirationDate.getFullYear();
      const dateText = `${month}/${year}`;

      // Dimensions de la page A4 en landscape
      const pageWidth = 297; // Largeur en landscape
      const pageHeight = 210; // Hauteur en landscape

      // Ajouter un cadre autour de la page
      doc.setDrawColor(0, 0, 0); // Couleur noire
      doc.setLineWidth(3); // Épaisseur du trait
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20); // Cadre avec marges

      // Ajouter un deuxième cadre plus épais pour plus de visibilité
      doc.setLineWidth(5);
      doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

      // Texte en très gros (160pt)
      doc.setFontSize(160);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');

      // Calculer la largeur et la hauteur du texte pour le centrage parfait
      const textWidth = doc.getTextWidth(dateText);
      
      // Pour le centrage vertical, on utilise la hauteur approximative du texte
      const textHeight = 160 * 0.35; // Approximation en mm (0.35mm par point)

      // Centrer horizontalement et verticalement
      const x = (pageWidth - textWidth) / 2;
      const y = (pageHeight + textHeight / 2) / 2;

      // Ajouter le texte parfaitement centré
      doc.text(dateText, x, y);

      doc.save(`EXP-${dateText.replace('/', '-')}.pdf`);
      setShowDateModal(false);
      setSelectedProduct('');

    } catch (error) {
      console.error('Erreur lors de la génération de la date:', error);
      alert('Erreur lors de la génération de la date dexpiration ');
    }
  };

  // Obtenir les produits avec dates d'expiration
  const getProductsWithExpiration = () => {
    return filteredReceptions
      .filter(reception => reception.expiration_date)
      .map(reception => ({
        id: reception.id,
        name: reception.product_name,
        expiration: reception.expiration_date,
        displayDate: format(new Date(reception.expiration_date), 'MM/yyyy')
      }));
  };

  const statusOptions = [
    { value: 'all', label: translate('common.allStatus') },
    { value: translate('status.ok'), label: translate('status.ok') },
    { value: translate('status.passedThird'), label: translate('status.passedThird') },
    { value: translate('status.expired'), label: translate('status.expired') },
  ];

  const statusLabel = statusOptions.find(opt => opt.value === statusFilter)?.label || translate('common.allStatus');

  const productsWithExpiration = getProductsWithExpiration();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl shadow-lg">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {translate('table.title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Liste des réceptions enregistrées - Modifiable
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Barre de recherche */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder={translate('table.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 h-10 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200 text-sm"
              />
            </div>

            {/* Filtre par statut */}
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setShowStatusFilter(!showStatusFilter)}
                className="inline-flex items-center gap-2 h-10 px-4 w-full sm:w-auto justify-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <Filter className="h-4 w-4" />
                <span>{translate('common.status')}</span>
              </button>
              
              {showStatusFilter && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowStatusFilter(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-full sm:w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
                    {statusOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value);
                          setShowStatusFilter(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                          statusFilter === option.value 
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bouton Imprimer Date Expiration */}
            <button
              onClick={openDateModal}
              disabled={productsWithExpiration.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-sm w-full sm:w-auto justify-center"
            >
              <Printer className="h-4 w-4" />
              Imprimer Date Exp
            </button>

            {/* Bouton PDF */}
            <button
              onClick={generatePDF}
              disabled={filteredReceptions.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm w-full sm:w-auto justify-center"
            >
              <Download className="h-4 w-4" />
              {translate('table.downloadPDF')}
            </button>
          </div>
        </div>
        
        {/* Statistiques en temps réel */}
        {filteredReceptions.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Box className="h-5 w-5 sm:h-7 sm:w-7" />
                  {filteredReceptions.length}
                </div>
                <div className="text-xs sm:text-sm text-blue-600/70 dark:text-blue-400/70 font-medium">
                  {translate('table.totalReceptions')}
                </div>
              </div>
              <div className="h-8 sm:h-12 w-px bg-blue-200 dark:bg-blue-800"></div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Calculator className="h-5 w-5 sm:h-7 sm:w-7" />
                  {calculateTotalUnits().toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-indigo-600/70 dark:text-indigo-400/70 font-medium">
                  {translate('table.totalUnits')}
                </div>
              </div>
            </div>
            
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
                {translate('common.filter')}: {statusLabel}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="h-4 w-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors flex items-center justify-center"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Modal de sélection de produit */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Sélectionner un produit
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Choisissez le produit pour imprimer sa date d'expiration
              </p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              {productsWithExpiration.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  Aucun produit avec date d'expiration trouvé
                </p>
              ) : (
                <div className="space-y-3">
                  {productsWithExpiration.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                        selectedProduct === product.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Expire le: {product.displayDate}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setSelectedProduct('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={generateExpirationDatePDF}
                disabled={!selectedProduct}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
              >
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Table Content */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="text-center py-12 sm:py-16">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
            <div className="text-gray-500 dark:text-gray-400 text-sm sm:text-lg">{translate('table.loading')}</div>
          </div>
        ) : filteredReceptions.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="text-gray-500 dark:text-gray-400 text-sm sm:text-lg mb-3 sm:mb-4">
              {searchTerm || statusFilter !== 'all' ? translate('table.noResults') : translate('table.noData')}
            </div>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <Filter className="h-4 w-4" />
                {translate('common.resetFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  {[
                    { key: 'product_name', icon: <Package className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'cartons', icon: <Box className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'units_per_carton', icon: <Calculator className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'total_units', icon: <Calculator className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'barcode', icon: <Barcode className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'production_date', icon: <Calendar className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'expiration_date', icon: <Calendar className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'shelf_life_months', icon: <Calendar className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'status', icon: <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" /> }
                  ].map(({ key, icon }) => (
                    <th
                      key={key}
                      className="cursor-pointer px-3 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      onClick={() => handleSort(key)}
                    >
                      <div className="flex items-center gap-1 sm:gap-2">
                        {icon}
                        <span className="hidden sm:inline">{translate(`table.columns.${key}`)}</span>
                        {getSortIcon(key)}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Palette className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Configuration Palette</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                    {translate('table.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredReceptions.map((reception) => (
                  <tr 
                    key={reception.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-150 group"
                  >
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2 max-w-[150px] sm:max-w-[200px]">
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                        <div className="truncate" title={reception.product_name}>
                          {reception.product_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-center font-semibold flex items-center justify-center gap-1 text-gray-900 dark:text-white">
                        <Box className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        {reception.cartons || 0}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-center flex items-center justify-center gap-1 text-gray-900 dark:text-white">
                        <Calculator className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        {reception.units_per_carton || 0}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-blue-600 dark:text-blue-400">
                      <div className="text-center flex items-center justify-center gap-1">
                        <Calculator className="h-3 w-3 sm:h-4 sm:w-4" />
                        {(reception.total_units || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <code className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100 font-mono">
                        <Barcode className="h-3 w-3" />
                        {reception.barcode || ''}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        {reception.production_date ? format(new Date(reception.production_date), 'dd/MM/yyyy') : '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className={`flex items-center gap-1 font-medium ${
                        reception.status === translate('status.expired') ? 'text-red-600 dark:text-red-400' :
                        reception.status === translate('status.passedThird') ? 'text-orange-600 dark:text-orange-400' :
                        'text-gray-900 dark:text-white'
                      }`}>
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                        {reception.expiration_date ? format(new Date(reception.expiration_date), 'dd/MM/yyyy') : '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-center flex items-center justify-center gap-1 text-gray-900 dark:text-white">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                        {reception.shelf_life_months || 0} mois
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(reception.status)}`}>
                        {getStatusIcon(reception.status)}
                        <span className="hidden sm:inline">{reception.status || translate('status.ok')}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {renderPalletConfig(reception)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(reception.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 sm:p-2 rounded-lg transition-all duration-200 transform hover:scale-110"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Ligne du total */}
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                  <td colSpan={3} className="px-3 py-3 text-right text-sm sm:text-lg text-gray-900 dark:text-white">
                    {translate('table.generalTotal')} :
                  </td>
                  <td className="px-3 py-3 text-blue-600 dark:text-blue-400 text-sm sm:text-lg">
                    <div className="flex items-center justify-center gap-2">
                      <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
                      {calculateTotalUnits().toLocaleString()} {translate('table.totalUnits').toLowerCase()}
                    </div>
                  </td>
                  <td colSpan={8}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}