'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { previewFile, uploadFile, validateImport, submitImport } from '@/lib/vendorApi';

type Step = 'upload' | 'mapping' | 'validation' | 'complete';

interface PreviewData {
  fileType: string;
  stats: { totalRows: number; columns: number };
  headers: string[];
  suggestedMappings: Record<string, string>;
}

const ACTIVITY_FIELDS = [
  { key: 'name', label: 'Activity Name', required: true },
  { key: 'externalId', label: 'External ID', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'subcategory', label: 'Subcategory', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'dateStart', label: 'Start Date', required: false },
  { key: 'dateEnd', label: 'End Date', required: false },
  { key: 'startTime', label: 'Start Time', required: false },
  { key: 'endTime', label: 'End Time', required: false },
  { key: 'dayOfWeek', label: 'Days of Week', required: false },
  { key: 'cost', label: 'Cost', required: false },
  { key: 'ageMin', label: 'Minimum Age', required: false },
  { key: 'ageMax', label: 'Maximum Age', required: false },
  { key: 'locationName', label: 'Location Name', required: false },
  { key: 'fullAddress', label: 'Full Address', required: false },
  { key: 'spotsAvailable', label: 'Spots Available', required: false },
  { key: 'totalSpots', label: 'Total Spots', required: false },
  { key: 'registrationStatus', label: 'Registration Status', required: false },
  { key: 'registrationUrl', label: 'Registration URL', required: false },
];

export default function NewImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Mapping state
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Validation state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const hasValidExtension = validExtensions.some(ext =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!validTypes.includes(selectedFile.type) && !hasValidExtension) {
      setError('Please upload a CSV or Excel file (.csv, .xls, .xlsx)');
      return;
    }

    setFile(selectedFile);
    setError('');
    setIsLoading(true);

    try {
      const previewData = await previewFile(selectedFile);
      setPreview(previewData);

      // Initialize field mapping with suggested mappings
      setFieldMapping(previewData.suggestedMappings || {});

      setStep('mapping');
    } catch (err: any) {
      setError(err.message);
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (fileHeader: string, activityField: string) => {
    setFieldMapping(prev => {
      const newMapping = { ...prev };

      // Remove previous mapping if this field was already mapped
      for (const [key, value] of Object.entries(newMapping)) {
        if (value === activityField && key !== fileHeader) {
          delete newMapping[key];
        }
      }

      if (activityField) {
        newMapping[fileHeader] = activityField;
      } else {
        delete newMapping[fileHeader];
      }

      return newMapping;
    });
  };

  const handleUploadAndValidate = async () => {
    if (!file) return;

    // Check required fields
    const mappedFields = Object.values(fieldMapping);
    if (!mappedFields.includes('name')) {
      setError('Activity Name is required. Please map a column to it.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Upload file
      const uploadResponse = await uploadFile(file, fieldMapping);
      setBatchId(uploadResponse.batch.id);

      // Validate
      const validateResponse = await validateImport(uploadResponse.batch.id, fieldMapping);
      setValidation(validateResponse.validation);

      setStep('validation');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!batchId) return;

    setIsLoading(true);
    setError('');

    try {
      await submitImport(batchId);
      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreview(null);
    setFieldMapping({});
    setBatchId(null);
    setValidation(null);
    setStep('upload');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/vendor/dashboard/imports"
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Import Activities</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {['upload', 'mapping', 'validation', 'complete'].map((s, index) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step === s
                  ? 'bg-purple-600 text-white'
                  : ['upload', 'mapping', 'validation', 'complete'].indexOf(step) > index
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {['upload', 'mapping', 'validation', 'complete'].indexOf(step) > index ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className={`ml-2 text-sm ${step === s ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
                {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Fields' : s === 'validation' ? 'Validate' : 'Complete'}
              </span>
              {index < 3 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  ['upload', 'mapping', 'validation', 'complete'].indexOf(step) > index
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl shadow p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              isDragging
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />

            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                <p className="text-gray-600">Processing file...</p>
              </div>
            ) : (
              <>
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your file here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    browse
                  </button>
                </p>
                <p className="text-gray-500">Supports CSV, XLS, and XLSX files</p>
              </>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">File Format Tips</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• First row should contain column headers</li>
              <li>• Required field: Activity Name</li>
              <li>• Dates should be in YYYY-MM-DD format</li>
              <li>• Times should be in HH:MM format (24-hour)</li>
              <li>• Days of week can be comma-separated (e.g., "Monday,Wednesday,Friday")</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step: Mapping */}
      {step === 'mapping' && preview && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Map Your Columns</h2>
            <p className="text-gray-600 mt-1">
              Match your file columns to activity fields. We&apos;ve auto-detected some mappings for you.
            </p>
          </div>

          <div className="mb-4 p-4 bg-purple-50 rounded-lg">
            <p className="text-purple-800">
              <span className="font-medium">{preview.stats.totalRows}</span> rows found with{' '}
              <span className="font-medium">{preview.stats.columns}</span> columns
            </p>
          </div>

          <div className="space-y-3">
            {preview.headers.map((header) => (
              <div key={header} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{header}</span>
                  <span className="text-gray-400 ml-2 text-sm">(Your column)</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex-1">
                  <select
                    value={fieldMapping[header] || ''}
                    onChange={(e) => handleMappingChange(header, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Skip this column --</option>
                    {ACTIVITY_FIELDS.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label} {field.required && '*'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={resetImport}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Start Over
            </button>
            <button
              onClick={handleUploadAndValidate}
              disabled={isLoading}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Validation */}
      {step === 'validation' && validation && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Validation Results</h2>
            <p className="text-gray-600 mt-1">
              Review the validation results before submitting your import.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Valid Rows</p>
              <p className="text-2xl font-bold text-green-700">{validation.validRows || 0}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-600">Warnings</p>
              <p className="text-2xl font-bold text-yellow-700">{validation.warningRows || 0}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">Errors</p>
              <p className="text-2xl font-bold text-red-700">{validation.errorRows || 0}</p>
            </div>
          </div>

          {validation.errors && validation.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Errors</h3>
              <div className="max-h-48 overflow-y-auto border border-red-200 rounded-lg">
                {validation.errors.slice(0, 20).map((err: any, index: number) => (
                  <div key={index} className="p-3 border-b border-red-100 last:border-0">
                    <span className="text-sm text-red-600">
                      Row {err.row}: {err.message}
                    </span>
                  </div>
                ))}
                {validation.errors.length > 20 && (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    And {validation.errors.length - 20} more errors...
                  </div>
                )}
              </div>
            </div>
          )}

          {validation.validRows > 0 && (
            <div className="p-4 bg-purple-50 rounded-lg mb-6">
              <p className="text-purple-800">
                <span className="font-medium">{validation.validRows}</span> activities will be imported.
                {validation.existingActivities > 0 && (
                  <span> ({validation.existingActivities} will update existing activities)</span>
                )}
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={resetImport}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Start Over
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || validation.validRows === 0}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Submitting...' : 'Submit Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your import has been submitted for processing. You can track its progress in the import history.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={resetImport}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Import Another File
            </button>
            <Link
              href="/vendor/dashboard/imports"
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg hover:opacity-90"
            >
              View Import History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
