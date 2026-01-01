'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getImport, getImportRows, cancelImport, ImportBatch } from '@/lib/vendorApi';

export default function ImportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const importId = params.id as string;

  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsPage, setRowsPage] = useState(1);
  const [rowsFilter, setRowsFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [error, setError] = useState('');

  const limit = 20;

  useEffect(() => {
    fetchImport();
  }, [importId]);

  useEffect(() => {
    if (batch) {
      fetchRows();
    }
  }, [batch, rowsPage, rowsFilter]);

  const fetchImport = async () => {
    try {
      const response = await getImport(importId);
      setBatch(response as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRows = async () => {
    setIsLoadingRows(true);
    try {
      const response = await getImportRows(importId, {
        page: rowsPage,
        limit,
        status: rowsFilter || undefined,
      });
      setRows(response.rows || []);
      setRowsTotal(response.total);
    } catch (err: any) {
      console.error('Failed to load rows:', err.message);
    } finally {
      setIsLoadingRows(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this import?')) return;

    try {
      await cancelImport(importId);
      fetchImport();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      VALIDATED: 'bg-yellow-100 text-yellow-800',
      VALIDATING: 'bg-yellow-100 text-yellow-800',
      PENDING: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || colors.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getApprovalBadge = (status: string) => {
    const colors: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-800',
      AUTO_APPROVED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || colors.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getRowStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      VALID: 'bg-green-100 text-green-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      ERROR: 'bg-red-100 text-red-800',
      CREATED: 'bg-blue-100 text-blue-800',
      UPDATED: 'bg-purple-100 text-purple-800',
      SKIPPED: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || colors.VALID}`}>
        {status}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(rowsTotal / limit);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!batch && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Import not found</p>
        <Link href="/vendor/dashboard/imports" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
          Go to Import History
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Details</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Import Info */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{batch?.fileName}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {batch?.fileType} • Uploaded {batch && formatDate(batch.createdAt)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {batch && getStatusBadge(batch.status)}
            {batch && getApprovalBadge(batch.approvalStatus)}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total Rows</p>
            <p className="text-2xl font-bold text-gray-900">{batch?.totalRows ?? 0}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Valid</p>
            <p className="text-2xl font-bold text-green-700">{batch?.validRows ?? 0}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Created</p>
            <p className="text-2xl font-bold text-blue-700">{batch?.createdRows ?? 0}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">Errors</p>
            <p className="text-2xl font-bold text-red-700">{batch?.errorRows ?? 0}</p>
          </div>
        </div>

        {batch?.errorMessage && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{batch.errorMessage}</p>
          </div>
        )}

        {batch && ['PENDING', 'VALIDATING', 'VALIDATED'].includes(batch.status) && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              Cancel Import
            </button>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <h3 className="font-semibold text-gray-900">Import Rows</h3>
          <select
            value={rowsFilter}
            onChange={(e) => {
              setRowsFilter(e.target.value);
              setRowsPage(1);
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Rows</option>
            <option value="VALID">Valid</option>
            <option value="ERROR">Errors</option>
            <option value="WARNING">Warnings</option>
            <option value="CREATED">Created</option>
            <option value="UPDATED">Updated</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>

        {isLoadingRows ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No rows found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row, index) => (
                    <tr key={row.id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.rowNumber || index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {getRowStatusBadge(row.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] truncate">
                        {row.data?.name || row.rawData?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[300px]">
                        {row.errorMessage || row.warningMessage || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {((rowsPage - 1) * limit) + 1} to {Math.min(rowsPage * limit, rowsTotal)} of {rowsTotal} rows
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRowsPage(rowsPage - 1)}
                    disabled={rowsPage === 1}
                    className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Page {rowsPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setRowsPage(rowsPage + 1)}
                    disabled={rowsPage === totalPages}
                    className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
