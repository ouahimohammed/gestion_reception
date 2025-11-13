import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Search, Trash2, Download, Filter, ArrowUpDown, ChevronUp, ChevronDown, Package, Palette, Box, Calculator, Barcode, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
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
    if (!confirm(confirmMessage)) return;

    try {
      storage.deleteReception(id);
      fetchReceptions();
    } catch (error) {
      const errorMessage = translate('table.deleteError');
      alert(errorMessage);
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
        translate('table.columns.palette'),
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
        reception.pallet_number || '',
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
          0: { cellWidth: 30 },
          1: { cellWidth: 15 },
          2: { cellWidth: 12 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 15 },
          6: { cellWidth: 18 },
          7: { cellWidth: 18 },
          8: { cellWidth: 15 }
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

  const statusOptions = [
    { value: 'all', label: translate('common.allStatus') },
    { value: translate('status.ok'), label: translate('status.ok') },
    { value: translate('status.passedThird'), label: translate('status.passedThird') },
    { value: translate('status.expired'), label: translate('status.expired') },
  ];

  const statusLabel = statusOptions.find(opt => opt.value === statusFilter)?.label || translate('common.allStatus');

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl shadow-lg shadow-green-500/25">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {translate('table.title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Liste des réceptions enregistrées
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
                className="pl-10 pr-4 h-10 w-full border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 dark:bg-slate-800/50 text-gray-900 dark:text-white transition-all duration-200 backdrop-blur-sm text-sm"
              />
            </div>

            {/* Filtre par statut */}
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setShowStatusFilter(!showStatusFilter)}
                className="inline-flex items-center gap-2 h-10 px-4 w-full sm:w-auto justify-center border border-gray-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm text-sm"
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
                  <div className="absolute top-full left-0 mt-1 w-full sm:w-48 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-20">
                    {statusOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value);
                          setShowStatusFilter(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
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

            {/* Bouton PDF */}
            <button
              onClick={generatePDF}
              disabled={filteredReceptions.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 backdrop-blur-sm text-sm w-full sm:w-auto justify-center"
            >
              <Download className="h-4 w-4" />
              {translate('table.downloadPDF')}
            </button>
          </div>
        </div>
        
        {/* Statistiques en temps réel */}
        {filteredReceptions.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800 backdrop-blur-sm">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 flex items-center gap-2">
                  <Box className="h-5 w-5 sm:h-7 sm:w-7" />
                  {filteredReceptions.length}
                </div>
                <div className="text-xs sm:text-sm text-blue-600/70 font-medium">
                  {translate('table.totalReceptions')}
                </div>
              </div>
              <div className="h-8 sm:h-12 w-px bg-blue-200 dark:bg-blue-800"></div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-indigo-600 flex items-center gap-2">
                  <Calculator className="h-5 w-5 sm:h-7 sm:w-7" />
                  {calculateTotalUnits().toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-indigo-600/70 font-medium">
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
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm backdrop-blur-sm"
              >
                <Filter className="h-4 w-4" />
                {translate('common.resetFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/50 backdrop-blur-sm">
                  {[
                    { key: 'product_name', icon: <Package className="h-3 w-3 sm:h-4 sm:w-4" /> },
                    { key: 'pallet_number', icon: <Palette className="h-3 w-3 sm:h-4 sm:w-4" /> },
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
                      className="cursor-pointer px-3 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-150"
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
                    {translate('table.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredReceptions.map((reception) => (
                  <tr 
                    key={reception.id} 
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors duration-150 group"
                  >
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2 max-w-[120px] sm:max-w-[200px]">
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                        <div className="truncate" title={reception.product_name}>
                          {reception.product_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono border border-gray-300 dark:border-slate-600 rounded-full bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300 backdrop-blur-sm">
                        <Palette className="h-3 w-3" />
                        {reception.pallet_number || ''}
                      </span>
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
                      <code className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-slate-800 rounded text-gray-900 dark:text-gray-100 font-mono">
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
                      <button
                        onClick={() => handleDelete(reception.id)}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 sm:p-2 rounded-lg transform hover:scale-110"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Ligne du total */}
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 font-bold border-t-2 border-gray-300 dark:border-slate-600">
                  <td colSpan={4} className="px-3 py-3 text-right text-sm sm:text-lg text-gray-900 dark:text-white">
                    {translate('table.generalTotal')} :
                  </td>
                  <td className="px-3 py-3 text-blue-600 dark:text-blue-400 text-sm sm:text-lg">
                    <div className="flex items-center justify-center gap-2">
                      <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
                      {calculateTotalUnits().toLocaleString()} {translate('table.totalUnits').toLowerCase()}
                    </div>
                  </td>
                  <td colSpan={6}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}